import * as Dialog from "@radix-ui/react-dialog";
import { Button, Flex, IconButton, Text, Theme } from "@radix-ui/themes";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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

  const last = step === steps.length - 1;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <Dialog.Portal>
        <Theme asChild>
          <div className="km-guide-layer" data-ready={ready}>
            <Dialog.Overlay className="km-guide-overlay">
              <div
                className="km-guide-spotlight"
                style={rect ?? { inset: 0, background: "rgba(0, 0, 0, 0.52)" }}
              />
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
              <Flex justify="between" align="center" gap="3" mb="3">
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
              <Dialog.Title className="km-guide-title">{t(current.title)}</Dialog.Title>
              <Dialog.Description className="km-guide-description">
                {t(current.description)}
              </Dialog.Description>
              <div className="km-guide-progress" aria-hidden="true">
                {steps.map((_, index) => <span key={index} data-current={index <= step} />)}
              </div>
              <Flex justify="between" align="center" gap="3" wrap="wrap">
                <Button variant="ghost" color="gray" size="2" onClick={onDismiss}>
                  {t("onboarding.skip")}
                </Button>
                <Flex gap="2">
                  {step > 0 && (
                    <IconButton
                      variant="soft"
                      color="gray"
                      aria-label={t("onboarding.previous")}
                      title={t("onboarding.previous")}
                      onClick={() => onStepChange(step - 1)}
                    >
                      <ArrowLeft size={16} />
                    </IconButton>
                  )}
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
                </Flex>
              </Flex>
            </Dialog.Content>
          </div>
        </Theme>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
