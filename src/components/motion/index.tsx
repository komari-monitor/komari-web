import React from "react";
import { Box, Card, Flex } from "@radix-ui/themes";
import {
  AnimatePresence,
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useSpring,
  useTransform,
  type HTMLMotionProps,
  type Variants,
} from "motion/react";
import {
  CONTENT_MOTION,
  CONTROL_MOTION,
  FEEDBACK_MOTION,
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
  MOTION_TRANSITION,
  listItemVariants,
  SURFACE_MOTION,
} from "@/lib/motion";

/* ------------------------------------------------------------------ *
 * surface —— 页面 / 面板
 * ------------------------------------------------------------------ */

/** 页面级进场：只给「主舞台」用，避免每个区块都抢注意力（Staging） */
export const PageMotion = ({
  children,
  className,
  ...props
}: HTMLMotionProps<"div">) => (
  <motion.div
    className={className}
    initial={SURFACE_MOTION.enter.initial}
    animate={SURFACE_MOTION.enter.animate}
    exit={SURFACE_MOTION.enter.exit}
    transition={{
      y: MOTION_SPRING.soft,
      opacity: SURFACE_MOTION.fade,
    }}
    {...props}
  >
    {children}
  </motion.div>
);

/** 通用折叠容器：高度用弹簧，展开到一半收起会保留速度顺势转向 */
export const Collapse = ({
  open,
  children,
  style,
  ...props
}: HTMLMotionProps<"div"> & { open: boolean; children: React.ReactNode }) => (
  <motion.div
    initial={false}
    animate={open ? "open" : "closed"}
    variants={COLLAPSE_VARIANTS}
    transition={{ height: MOTION_SPRING.soft, opacity: MOTION_TRANSITION.fade }}
    // 默认裁切，避免收起过程中子元素溢出（调用方仍可覆盖）
    style={{ overflow: "hidden", ...style }}
    {...props}
  >
    {children}
  </motion.div>
);

const COLLAPSE_VARIANTS: Variants = {
  open: { height: "auto", opacity: 1 },
  closed: { height: 0, opacity: 0 },
};

/* ------------------------------------------------------------------ *
 * content —— 卡片 / 列表
 * ------------------------------------------------------------------ */

const LIST_VARIANTS: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.022, delayChildren: 0.012 } },
  exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
};

/** 列表容器：子项依次进场，形成先后层次（Follow-through） */
export const StaggeredList = ({
  children,
  className,
  ...props
}: HTMLMotionProps<"div">) => (
  <motion.div
    initial="initial"
    animate="animate"
    exit="exit"
    variants={LIST_VARIANTS}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
);

/** 列表子项：与 StaggeredList 搭配 */
export const StaggeredItem = (props: HTMLMotionProps<"div">) => (
  <motion.div variants={listItemVariants} {...props} />
);

/**
 * 内容卡片：入场 + 布局重排 + hover 先行抬升（Anticipation）+ 按压回弹。
 * hover/tap 用锥形缩放，保证「按下去是软的」而不是硬邦邦的位移。
 */
export const ContentCard = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ children, ...props }, ref) => (
    <motion.div
      ref={ref}
      layout
      initial={CONTENT_MOTION.item.initial}
      animate={CONTENT_MOTION.item.animate}
      exit={{
        ...CONTENT_MOTION.item.exit,
        transition: CONTENT_MOTION.exitTransition,
      }}
      transition={CONTENT_MOTION.transition}
      whileHover={{ ...CONTENT_MOTION.hover, transition: CONTROL_MOTION.transition }}
      whileTap={CONTROL_MOTION.tap}
      {...props}
    >
      {children}
    </motion.div>
  ),
);
ContentCard.displayName = "ContentCard";

/* ------------------------------------------------------------------ *
 * control —— 按钮 / 控件
 * ------------------------------------------------------------------ */

/**
 * 可交互控件包装：hover 微放大、按压椭圆缩放（Squash & Stretch，体积守恒）。
 * 只作用于 transform，不影响布局。
 */
export const Pressable = React.forwardRef<
  HTMLDivElement,
  HTMLMotionProps<"div"> & { hoverScale?: number; tapScale?: number }
>(({ children, hoverScale = 1.02, tapScale = 0.96, ...props }, ref) => (
  <motion.div
    ref={ref}
    whileHover={{ scale: hoverScale, transition: CONTROL_MOTION.transition }}
    whileTap={{ scaleX: 1 / tapScale, scaleY: tapScale }}
    {...props}
  >
    {children}
  </motion.div>
));
Pressable.displayName = "Pressable";

/**
 * 可交互按钮：保留原生 ButtonHTMLAttributes 类型，同时带上 hover/tap 反馈。
 * 用于需要 HTML5 拖放（draggable + DragEvent）或原生 button 语义的位置——
 * 直接用 motion.button 会把事件类型收窄成 PointerEvent，导致 dataTransfer 报错。
 */
export const PressableButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tapScale?: number }
>(({ children, tapScale = 0.96, className, ...props }, ref) => (
  <motion.button
    ref={ref}
    className={className}
    whileHover={{ scale: 1.02, transition: CONTROL_MOTION.transition }}
    whileTap={{ scaleX: 1 / tapScale, scaleY: tapScale }}
    {...(props as HTMLMotionProps<"button">)}
  >
    {children}
  </motion.button>
));
PressableButton.displayName = "PressableButton";

/**
 * 开关/复选之类的「啪」一下反馈：值变化时从 0.92 弹回 1。
 * 不用 key 重挂载：同一个元素由弹簧驱动，连点时从当前缩放和速度继续，不会每次从头播。
 */
export const TogglePop = ({
  value,
  children,
  style,
  ...props
}: Omit<HTMLMotionProps<"span">, "animate"> & { value: string | number | boolean }) => {
  const controls = useAnimationControls();
  const previous = React.useRef(value);
  React.useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    controls.set({ scale: 0.92 });
    void controls.start({ scale: 1, transition: CONTROL_MOTION.transition });
  }, [controls, value]);
  return (
    <motion.span
      animate={controls}
      style={{ display: "inline-flex", ...style }}
      {...props}
    >
      {children}
    </motion.span>
  );
};

/* ------------------------------------------------------------------ *
 * feedback —— 数值 / 徽标 / 状态
 * ------------------------------------------------------------------ */

/**
 * 状态变化反馈：只在 online 状态真的翻转时播放一次轻微过冲 + 次要动作。
 * 轮询刷新不会触发，所以不会变成持续的噪声（Staging / Timing）。
 */
export const StatusFeedback = ({
  children,
  state,
  className,
}: {
  children: React.ReactNode;
  state: string | number | boolean;
  className?: string;
}) => (
  <AnimatePresence mode="wait" initial={false}>
    <motion.span
      key={String(state)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={FEEDBACK_MOTION.pop.transition}
      className={className}
      style={{ display: "inline-flex" }}
    >
      {children}
    </motion.span>
  </AnimatePresence>
);

/**
 * 数字滚动：数值变化时用等宽数字做纵向滑动，避免整行文字抖动。
 * digits 控制参与滚动的位数，其余直接渲染。
 */
export const AnimatedNumber = ({
  value,
  format,
  duration,
  decimals,
  className,
}: {
  value: number;
  format?: (value: number) => string;
  /** 可选：用 tween 时长替代默认弹簧（小数字变化更稳）。单位是**秒**，请传 MOTION_DURATION.* */
  duration?: number;
  /** 需要保留的小数位（百分比等场景）；不传则取整 */
  decimals?: number;
  className?: string;
}) => {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, {
    stiffness: 260,
    damping: 30,
    mass: 0.8,
  });
  const display = useTransform(spring, (latest) => {
    if (format) return format(latest);
    return decimals
      ? latest.toFixed(decimals)
      : Math.round(latest).toLocaleString();
  });

  React.useEffect(() => {
    if (duration) {
      // 指定时长时用 tween：小数字变化更稳，不会左右晃动
      const controls = animate(motionValue, value, {
        duration,
        ease: MOTION_EASE.emphasized,
      });
      return () => controls.stop();
    }
    motionValue.set(value);
    return undefined;
  }, [duration, motionValue, value]);

  return (
    <motion.span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {display}
    </motion.span>
  );
};

/** 轻量的「强调脉冲」：用于刚更新的行/卡片 */
export const HighlightPulse = ({
  trigger,
  children,
  className,
}: {
  trigger: unknown;
  children: React.ReactNode;
  className?: string;
}) => {
  const [active, setActive] = React.useState(false);
  const previous = React.useRef(trigger);
  React.useEffect(() => {
    if (previous.current === trigger) return;
    previous.current = trigger;
    setActive(true);
    const id = window.setTimeout(() => setActive(false), MOTION_DURATION.slow * 1000);
    return () => window.clearTimeout(id);
  }, [trigger]);
  return (
    <motion.div
      className={className}
      animate={
        active
          ? { backgroundColor: ["transparent", "var(--accent-3)", "transparent"] }
          : { backgroundColor: "transparent" }
      }
      transition={{ duration: MOTION_DURATION.slower, ease: MOTION_EASE.standard }}
    >
      {children}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ *
 * 表格行 / Radix 桥接
 * ------------------------------------------------------------------ */

/**
 * 表格行的 motion 版本：用于「行展开 / 行增删 / 行重排」的补位动画。
 * 单独导出是因为 <motion.tr> 的泛型写法在各页面重复度很高，且必须成对使用。
 */
export const MotionRow = motion.tr;
export const MotionCell = motion.td;

/**
 * Radix 组件的 motion 包装（motion.create 不额外增加 DOM 层级）。
 * 页面根容器通常是 Radix 的 Flex/Card，直接换成 div 会丢样式，
 * 用这里的桥接可以在保留 Radix 组件的同时做进场动画。
 */
export const MotionBox = motion.create(Box);
export const MotionFlex = motion.create(Flex);
export const MotionCard = motion.create(Card);
export const MotionSection = motion.section;

/* ------------------------------------------------------------------ *
 * overlay —— 弹层 / 抽屉
 * ------------------------------------------------------------------ */

/**
 * 弹层内容：从触发点方向「长出来」，带一点弧线感。
 * 与 Radix 的 data-state 动画互补，用于自定义浮层（Popover 内嵌卡片、抽屉）。
 */
export const OverlayMotion = ({
  children,
  ...props
}: HTMLMotionProps<"div">) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.97, y: -4 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.98, y: -2 }}
    transition={{
      scale: MOTION_SPRING.soft,
      y: MOTION_SPRING.soft,
      opacity: MOTION_TRANSITION.fade,
    }}
    {...props}
  >
    {children}
  </motion.div>
);

/** 显示/隐藏都带过渡的盒子（条件渲染的区块） */
export const PresenceBox = ({ children, ...props }: HTMLMotionProps<"div">) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{
      y: MOTION_SPRING.snappy,
      opacity: MOTION_TRANSITION.fade,
    }}
    {...props}
  >
    {children}
  </motion.div>
);

/* ------------------------------------------------------------------ *
 * 尺寸变化 / 加载占位
 * ------------------------------------------------------------------ */
/**
 * 标签/分类切换时的内容横向滑动：新内容从 direction 一侧滑入，旧内容向另一侧滑出（mode="wait"）。
 * direction 为 1（往右边的标签）或 -1；减少动态效果时只淡入淡出、时长为 0。
 * 插件页的状态筛选与插件市场的分类筛选共用。
 */
export const SlideSwap = ({
  swapKey,
  direction,
  reduceMotion,
  children,
}: {
  swapKey: React.Key;
  direction: number;
  reduceMotion: boolean;
  children: React.ReactNode;
}) => (
  <AnimatePresence mode="wait" initial={false} custom={direction}>
    <motion.div
      key={swapKey}
      custom={direction}
      variants={{
        enter: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : d * 24 }),
        center: { opacity: 1, x: 0 },
        exit: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : -d * 24 }),
      }}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        duration: reduceMotion ? 0 : MOTION_DURATION.fast,
        ease: MOTION_EASE.out,
      }}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

export { AutoHeight, Swap, LoadingSwap } from "./layout";
export { RevealBoundary, SuppressReveal, useRevealPending } from "./reveal";
