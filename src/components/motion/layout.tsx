import React from "react";
import { AnimatePresence, animate, motion, type AnimationPlaybackControls } from "motion/react";
import { SKELETON_MOTION } from "@/lib/motion";
import { useKmReducedMotion } from "./MotionProvider";
import { SuppressReveal } from "./reveal";

/**
 * 内容尺寸变化时，外层高度用弹簧跟过去（surface/content 的「体积变化不跳」）。
 *
 * 原理：ResizeObserver 在布局之后、绘制之前回调；此时把外层钉回旧高度，再弹簧到新高度，
 * 动画结束恢复 height: auto，平时完全不干预布局。
 * - 动画途中内容再变：从当前高度和速度继续（弹簧可被打断）；
 * - 首次测量、元素不可见、系统减少动态效果时直接跳到新高度；
 * - 只有动画期间 overflow: hidden，平时不裁切阴影/焦点环。
 *
 * 注意：内部内容不要依赖外层的固定高度（h-full / flex-1），AutoHeight 的高度由内容决定。
 */
export const AutoHeight = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** 暂停跟随（例如拖拽中由别的系统控制尺寸） */
    disabled?: boolean;
    /** 小于该差值（像素）不做动画，避免亚像素抖动 */
    threshold?: number;
    innerClassName?: string;
  }
>(({ children, disabled = false, threshold = 2, innerClassName, style, ...props }, forwardedRef) => {
  const outer = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const last = React.useRef<number | null>(null);
  const controls = React.useRef<AnimationPlaybackControls | null>(null);
  const current = React.useRef<number>(0);
  const reduced = useKmReducedMotion();
  const skip = React.useRef(disabled || reduced);
  skip.current = disabled || reduced;

  React.useImperativeHandle(forwardedRef, () => outer.current as HTMLDivElement);

  React.useLayoutEffect(() => {
    const outerEl = outer.current;
    const innerEl = inner.current;
    if (!outerEl || !innerEl || typeof ResizeObserver === "undefined") return;

    const release = () => {
      controls.current = null;
      outerEl.style.height = "";
      outerEl.style.overflow = "";
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const next = entry.borderBoxSize?.[0]?.blockSize ?? innerEl.offsetHeight;
      const prev = last.current;
      last.current = next;
      const visible = outerEl.offsetParent !== null || outerEl.getClientRects().length > 0;
      if (prev === null || skip.current || !visible || Math.abs(next - prev) < threshold) {
        if (controls.current) {
          controls.current.stop();
          release();
        }
        return;
      }
      // 正在动画：从当前高度继续；否则从旧高度出发
      const from = controls.current ? current.current : prev;
      controls.current?.stop();
      outerEl.style.overflow = "hidden";
      outerEl.style.height = `${from}px`;
      current.current = from;
      const anim = animate(from, next, {
        ...SKELETON_MOTION.height,
        onUpdate: (value) => {
          current.current = value;
          outerEl.style.height = `${value}px`;
        },
        onComplete: () => {
          if (controls.current === anim) release();
        },
      });
      controls.current = anim;
    });
    observer.observe(innerEl);
    return () => {
      observer.disconnect();
      controls.current?.stop();
      controls.current = null;
    };
  }, [threshold]);

  return (
    <div ref={outer} style={style} {...props}>
      <div ref={inner} className={innerClassName} style={{ display: "flow-root" }}>
        {children}
      </div>
    </div>
  );
});
AutoHeight.displayName = "AutoHeight";

/**
 * 同一位置的内容替换（加载态 -> 内容、空态 -> 列表、错误 -> 重试结果）：
 * 旧内容快速淡出并脱离文档流（popLayout），新内容淡入上浮，外层高度弹簧过渡。
 */
export const Swap = ({
  swapKey,
  children,
  className,
  innerClassName,
}: {
  swapKey: string | number;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) => {
  const reduced = useKmReducedMotion();
  const { initial, animate: to, transition } = SKELETON_MOTION.reveal;
  return (
    <AutoHeight className={className} innerClassName={innerClassName}>
      <div className="relative">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={swapKey}
            initial={reduced ? { opacity: 0 } : initial}
            animate={to}
            exit={{ opacity: 0, transition: SKELETON_MOTION.exit }}
            transition={transition}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </AutoHeight>
  );
};

/**
 * 局部加载：骨架与内容交叉淡化 + 高度弹簧。
 * children 可以是函数，只在加载完成后才求值（避免访问还没到的数据）。
 */
export const LoadingSwap = ({
  loading,
  skeleton,
  children,
  className,
  innerClassName,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode | (() => React.ReactNode);
  className?: string;
  innerClassName?: string;
}) => (
  <Swap swapKey={loading ? "skeleton" : "content"} className={className} innerClassName={innerClassName}>
    {loading ? (
      <SuppressReveal>{skeleton}</SuppressReveal>
    ) : typeof children === "function" ? (
      (children as () => React.ReactNode)()
    ) : (
      children
    )}
  </Swap>
);
