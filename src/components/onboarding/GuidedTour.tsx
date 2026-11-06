import * as Dialog from "@radix-ui/react-dialog";
import { Button, Flex, IconButton, Text, Theme } from "@radix-ui/themes";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
} from "@/lib/motion";
import "./onboarding.css";

export interface GuideStep {
  target: string;
  title: string;
  description: string;
}

interface GuidedTourProps {
  steps: GuideStep[];
  step: number;
  onStepChange: (step: number) => void;
  onDismiss: () => void;
  onShown: () => void;
  action?: { label: string; onClick: () => void };
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export default function GuidedTour({
  steps,
  step,
  onStepChange,
  onDismiss,
  onShown,
  action,
}: GuidedTourProps) {
  const { t } = useTranslation();
  const current = steps[step];
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const [rect, setRect] = useState<Rect | null>(null);
  const [position, setPosition] = useState({ left: 16, top: 16, maxHeight: window.innerHeight - 32 });
  const [ready, setReady] = useState(false);
  // 步骤方向：前进/后退用不同的位移方向，让「往回翻」在视觉上也是往回走（Staging）
  const [direction, setDirection] = useState(1);
  const previousStep = useRef(step);
  const shown = useRef(false);
  const actionTaken = useRef(false);
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;

  useEffect(() => {
    if (!ready) return;
    contentRef.current?.focus();
    if (shown.current) return;
    shown.current = true;
    onShownRef.current();
  }, [ready]);

  useLayoutEffect(() => {
    setReady(false);
    const started = performance.now();
    let frame = 0;
    let scrolledElement: HTMLElement | null = null;
    let repositioned = false;
    const measure = () => {
      const element = document.querySelector<HTMLElement>(current.target);
      if (element && element !== scrolledElement) {
        element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        scrolledElement = element;
      }
      const bounds = element?.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const visible = bounds && bounds.width > 4 && bounds.height > 4 &&
        bounds.right > 0 && bounds.bottom > 0 && bounds.left < width && bounds.top < height &&
        (!element?.checkVisibility || element.checkVisibility({ checkVisibilityCSS: true }));
      const next = visible ? {
        left: Math.max(4, bounds.left - 5),
        top: Math.max(4, bounds.top - 5),
        width: Math.max(0, Math.min(width - 4, bounds.right + 5) - Math.max(4, bounds.left - 5)),
        height: Math.max(0, Math.min(height - 4, bounds.bottom + 5) - Math.max(4, bounds.top - 5)),
      } : null;
      setRect((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      const card = contentRef.current;
      if (card) {
        const cardWidth = card.offsetWidth;
        const cardHeight = Math.min(card.scrollHeight + 2, height - 32);
        let left = (width - cardWidth) / 2;
        let top = (height - cardHeight) / 2;
        let maxHeight = height - 32;
        if (next) {
          if (width >= 700 && next.left + next.width + 16 + cardWidth <= width - 16) {
            left = next.left + next.width + 16;
            top = next.top;
          } else if (next.top + next.height + 16 + cardHeight <= height - 16) {
            left = next.left;
            top = next.top + next.height + 16;
          } else if (next.top >= cardHeight + 32) {
            left = next.left;
            top = next.top - cardHeight - 16;
          } else if (!repositioned && element) {
            repositioned = true;
            element.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
          } else {
            // On short screens keep the target visible and let the tutorial scroll.
            const below = height - next.top - next.height - 32;
            const above = next.top - 32;
            if (Math.max(below, above) >= 120) {
              maxHeight = Math.max(below, above);
              left = next.left;
              top = below >= above ? next.top + next.height + 16 : 16;
            }
          }
        }
        const nextPosition = {
          left: Math.max(16, Math.min(left, width - cardWidth - 16)),
          top: Math.max(16, Math.min(top, height - Math.min(cardHeight, maxHeight) - 16)),
          maxHeight,
        };
        setPosition((previous) =>
          previous.left === nextPosition.left && previous.top === nextPosition.top &&
            previous.maxHeight === nextPosition.maxHeight
            ? previous : nextPosition,
        );
      }
      // Allow navigation and sidebar animations to settle; missing targets fall back to a centered dialog.
      if (performance.now() - started > (visible ? 350 : 1800)) setReady(true);
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [current.target, step]);

  useEffect(() => {
    if (previousStep.current === step) return;
    setDirection(step > previousStep.current ? 1 : -1);
    previousStep.current = step;
  }, [step]);

  const last = step === steps.length - 1;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <Dialog.Portal>
        <Theme asChild>
          <div className="km-guide-layer" data-ready={ready}>
            <Dialog.Overlay className="km-guide-overlay">
              {/*
                shared 层：同一个高亮框在步骤之间「移动过去」，而不是淡出一个再淡入另一个。
                直接用弹簧驱动 left/top/width/height，而不是 layout（transform 缩放）：
                缩放会把圆角、2px 描边与 9999px 遮罩阴影一起非等比拉伸，框在途中会变形。
                这里只有一个元素，逐帧改尺寸的布局成本可以忽略；目标每帧被重新测量（侧栏/页面
                仍在动时），弹簧改目标会保留当前速度，跟随是连贯的而不是一顿一顿地重启。
              */}
              {rect ? (
                <motion.div
                  key="guide-spotlight"
                  className="km-guide-spotlight"
                  initial={false}
                  animate={{
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                  }}
                  transition={MOTION_SPRING.shared}
                  style={{ background: "transparent" }}
                />
              ) : (
                <div
                  className="km-guide-spotlight"
                  style={{ inset: 0, background: "rgba(0, 0, 0, 0.52)" }}
                />
              )}
            </Dialog.Overlay>
            <Dialog.Content
              ref={contentRef}
              className="km-guide-content"
              style={position}
              onPointerDownOutside={(event) => event.preventDefault()}
              onInteractOutside={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (!actionTaken.current && previousFocus.current?.isConnected) previousFocus.current.focus();
              }}
            >
              <Flex justify="between" align="center" gap="2" mb="2">
                <Text size="1" color="gray" weight="medium" aria-live="polite">
                  {t("onboarding.progress", { current: step + 1, total: steps.length })}
                </Text>
                <IconButton
                  variant="ghost"
                  color="gray"
                  size="1"
                  aria-label={t("onboarding.skip")}
                  title={t("onboarding.skip")}
                  onClick={onDismiss}
                >
                  <X size={16} />
                </IconButton>
              </Flex>
              {/* content 层：前进从右来、后退从左来，方向感和浏览器的「上一页/下一页」一致 */}
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: direction * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -24 }}
                  transition={{
                    x: MOTION_SPRING.snappy,
                    opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
                  }}
                >
                  <Dialog.Title className="km-guide-title">{t(current.title)}</Dialog.Title>
                  <Dialog.Description className="km-guide-description">
                    {t(current.description)}
                  </Dialog.Description>
                </motion.div>
              </AnimatePresence>
              <div className="km-guide-progress" aria-hidden="true">
                {steps.map((_, index) => (
                  <motion.span
                    key={index}
                    data-current={index <= step}
                    initial={false}
                    animate={{ scaleX: index === step ? 1 : 0.6, opacity: index <= step ? 1 : 0.55 }}
                    transition={MOTION_SPRING.snappy}
                    style={{ transformOrigin: "left center" }}
                  />
                ))}
              </div>
              <Flex justify="between" align="center" gap="2" wrap="wrap">
                <Button variant="ghost" color="gray" size="2" onClick={onDismiss}>
                  {t("onboarding.skip")}
                </Button>
                <Flex gap="2">
                  <AnimatePresence initial={false}>
                    {step > 0 && (
                      <motion.div
                        key="guide-previous"
                        initial={{ opacity: 0, x: 8, scale: 0.94 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 8, scale: 0.94 }}
                        transition={MOTION_SPRING.snappy}
                        whileTap={{ scale: 0.96 }}
                      >
                        <IconButton
                          variant="soft"
                          color="gray"
                          aria-label={t("onboarding.previous")}
                          title={t("onboarding.previous")}
                          onClick={() => onStepChange(step - 1)}
                        >
                          <ArrowLeft size={16} />
                        </IconButton>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.div whileTap={{ scale: 0.97 }} transition={MOTION_SPRING.snappy}>
                  <Button onClick={() => {
                    if (!last) onStepChange(step + 1);
                    else {
                      actionTaken.current = Boolean(action);
                      onDismiss();
                      action?.onClick();
                    }
                  }}>
                    {last ? action?.label ?? t("onboarding.finish") : t("onboarding.next")}
                    {last ? <Check size={16} /> : <ArrowRight size={16} />}
                  </Button>
                  </motion.div>
                </Flex>
              </Flex>
            </Dialog.Content>
          </div>
        </Theme>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
