/**
 * komari-web 统一动效系统（Motion System）
 * ---------------------------------------
 * 参考《The Illusion of Life》的动画十二原则，以及 IxDF 关于 UI 动画的文章
 * （https://ixdf.org/literature/article/ui-animation-how-to-apply-disney-s-12-principles-of-animation-to-ui-design），
 * 把界面拆成 5 类「动效性格」，每类有自己的时长、曲线、夸张程度：
 *
 *   surface  大面积舞台（页面/面板/侧边栏）——沉稳、有重量：慢、缓、位移小（服从 Staging / Timing）
 *   content  内容卡片（节点卡片/列表项）——有弹性、有跟随：弹簧 + 错峰（Follow-through）
 *   control  控件（按钮/开关/分段器/标签）——干脆、可触摸：快、短、带回弹（Squash & Stretch）
 *   feedback 反馈（数值/徽标/进度/提示）——生动、强调：夸张 + 次要动作（Exaggeration / Secondary Action）
 *   overlay  弹层（对话框/浮层/抽屉）——有方向、有归属：从触发点长出、沿弧线落下（Arc / Anticipation）
 *
 * 十二原则在代码中的落点：
 *   1  Squash & Stretch     -> MOTION_TAP / .km-pressable（按压缩放，体积守恒）
 *   2  Anticipation         -> MOTION_HOVER（hover 先行抬升） / overlay 的 pre-scale
 *   3  Staging              -> 只有主区域做入场，数值刷新不抢戏（见 NodeCard / Index）
 *   4  Pose to Pose         -> 所有状态都用 variants 明确定义，而非逐帧
 *   5  Follow-through       -> staggerChildren + 卡片索引延迟，形成先后层次
 *   6  Slow In & Slow Out   -> 所有 tween 都用非对称缓动，绝无 linear
 *   7  Arc                  -> MOTION_ARC（沿弧线的位移关键帧）
 *   8  Secondary Action     -> MOTION_SECONDARY（强调时附带的小动作）
 *   9  Timing               -> 面积越大时长越长（surface > content > control）
 *  10  Exaggeration         -> 仅 feedback 层允许轻微过冲
 *  11  Solid Drawing        -> 抬升阴影 --km-shadow-1/2/3 与圆角保持一致
 *  12  Appeal               -> 统一的 Komari 手感：轻、软、有回弹，从不生硬
 */
import type { Transition, Variants } from "motion/react";

/**
 * 基础时长（秒），与 CSS 变量 --km-dur-* 一一对应。
 * 节奏偏快：界面动效的目标是「让状态变化被看清」，不是让人等它演完。
 * 常用档 fast/base 控制在 120~190ms，接近系统级 UI 的手感。
 */
export const MOTION_DURATION = {
  instant: 0.06,
  fast: 0.12,
  base: 0.18,
  slow: 0.26,
  slower: 0.38,
} as const;

/** 统一缓动曲线（与 CSS 变量 --km-ease-* 一一对应）——都满足 Slow In & Slow Out */
export const MOTION_EASE = {
  standard: [0.2, 0, 0, 1] as const,
  out: [0.16, 1, 0.3, 1] as const,
  in: [0.4, 0, 1, 1] as const,
  emphasized: [0.22, 1, 0.36, 1] as const,
} as const;

/**
 * 弹簧参数（Interruptible by design）：
 * 弹簧动画改变目标时会保留当前速度，展开到一半再收起能顺势转向，
 * 这正是「运动被打断也自然」的来源。所有位移/尺寸变化都走这里。
 */
export const MOTION_SPRING = {
  /** 通用布局位移（卡片重排、列表增删） */
  layout: { type: "spring", stiffness: 560, damping: 42, mass: 0.75 },
  /** 轻快（控件、指示器、图标）——回弹略多，手感干脆 */
  snappy: { type: "spring", stiffness: 820, damping: 40, mass: 0.5 },
  /** 柔和（面板、抽屉、大块展开）——重、稳、不弹 */
  soft: { type: "spring", stiffness: 380, damping: 34, mass: 0.85 },
  /** 共享元素（旧位置/旧尺寸 -> 新布局） */
  shared: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },
  /** 强调（feedback 层专用，允许轻微过冲 Exaggeration） */
  pop: { type: "spring", stiffness: 900, damping: 28, mass: 0.45 },
} satisfies Record<string, Transition>;

/**
 * 同一套缓动/时长的 CSS 形式。
 * dnd-kit、内联 style、CSS-in-JS 只接受 `{ duration: number; easing: string }`，
 * 从这些常量取值可以避免各页面自己拼 `cubic-bezier(...)` 造成曲线漂移。
 */
export const MOTION_EASE_CSS = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  emphasized: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/** 毫秒版时长（CSS transition / dnd-kit 用） */
export const MOTION_MS = {
  instant: 60,
  fast: 120,
  base: 180,
  slow: 260,
  slower: 380,
} as const;

export const MOTION_TRANSITION = {
  layout: MOTION_SPRING.layout,
  shared: MOTION_SPRING.shared,
  snappy: MOTION_SPRING.snappy,
  soft: MOTION_SPRING.soft,
  pop: MOTION_SPRING.pop,
  fade: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
  fadeIn: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out },
  fadeOut: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.in },
  enter: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out },
  exit: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.in },
  move: { duration: MOTION_DURATION.base, ease: MOTION_EASE.emphasized },
} satisfies Record<string, Transition>;

/* ------------------------------------------------------------------ *
 * 五类动效性格
 * ------------------------------------------------------------------ */

/**
 * surface —— 大面积舞台：页面、面板、侧边栏。
 * 只做「一点点」位移 + 较长的淡入，避免大块区域晃眼（Staging：别抢内容的风头）。
 */
export const SURFACE_MOTION = {
  /** 页面/主区域进场 */
  enter: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { ...MOTION_SPRING.soft, opacity: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out } },
  },
  /** 侧边栏/抽屉：宽度与位移一起走同一条弹簧，收放可被打断 */
  slide: MOTION_SPRING.soft,
  /** 纯淡入（内容已被布局动画覆盖时使用） */
  fade: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out },
} as const;

/**
 * content —— 内容卡片/列表：有弹性，允许轻微跟随。
 * 通过 stagger 形成「主体先到、细节随后」的层次（Follow-through & Overlapping）。
 */
export const CONTENT_MOTION = {
  item: {
    initial: { opacity: 0, y: 12, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.97 },
  },
  transition: {
    layout: MOTION_SPRING.layout,
    y: MOTION_SPRING.layout,
    scale: MOTION_SPRING.layout,
    opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
  },
  exitTransition: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.in },
  /** 列表子项错峰：卡片多时上限收敛，避免最后几张等太久 */
  stagger: (index: number) => Math.min(index * 0.02, 0.14),
  /** hover 的先行抬升（Anticipation） */
  hover: { y: -2 },
  /** 按压反馈（Squash & Stretch：略微变扁） */
  tap: { scaleX: 1.01, scaleY: 0.985 },
} as const;

/**
 * control —— 按钮/开关/分段器/标签：短、快、干脆。
 * 按压用「体积守恒」的椭圆缩放，让控件摸起来是软的而不是刚体。
 */
export const CONTROL_MOTION = {
  tap: { scaleX: 1.02, scaleY: 0.96 },
  hover: { scale: 1.02 },
  transition: MOTION_SPRING.snappy,
  /** 指示器在选项间滑动（共享元素） */
  indicator: MOTION_SPRING.snappy,
} as const;

/**
 * feedback —— 数值/徽标/状态/进度：允许轻微夸张与次要动作。
 * 只在「状态真的变了」的时候播放，避免 2 秒一次的轮询把页面变成迪斯科。
 */
export const FEEDBACK_MOTION = {
  pop: {
    initial: { opacity: 0, scale: 0.86 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.86 },
    transition: MOTION_SPRING.pop,
  },
  /** 次要动作：主状态变化时，附带一次很轻的「呼吸」 */
  pulse: {
    scale: [1, 1.06, 1],
    transition: { duration: MOTION_DURATION.slow, ease: MOTION_EASE.emphasized },
  },
  /** 数值滚动（数字变化） */
  number: { duration: MOTION_DURATION.base, ease: MOTION_EASE.emphasized },
} as const;

/**
 * overlay —— 弹层：从触发点「长出来」，并沿弧线落位。
 * 弧线（Arc）比直线更有生命感；缩略的起始缩放给出方向暗示（Anticipation）。
 */
export const OVERLAY_MOTION = {
  enter: {
    initial: { opacity: 0, scale: 0.96, y: -4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97, y: -2 },
    transition: { ...MOTION_SPRING.soft, opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard } },
  },
  /** 抽屉从侧边进入，带 6% 的位移与轻微缩放 */
  drawer: {
    initial: { opacity: 0, x: 24, scale: 0.99 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 16, scale: 0.99 },
    transition: MOTION_SPRING.soft,
  },
  /** 弧线关键帧：横向与纵向用不同节奏，路径自然弯曲 */
  arc: {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: [0, 1, 1],
      y: [10, -2, 0],
      transition: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out, times: [0, 0.7, 1] },
    },
  },
} as const;

/**
 * skeleton —— 加载占位 -> 内容（属于 content 性格的「入场前一刻」）。
 *
 *   1. 骨架延迟 delay 才浮现：快的请求根本看不到骨架，不会一闪而过（Timing）；
 *   2. 骨架呼吸用对称的 sine 缓动循环，块之间按索引错峰（Follow-through），且封顶避免末尾拖沓；
 *   3. 内容到达：骨架用 exit 快速淡出，内容用 content 的入场（淡入 + 4px 上浮弹簧）接上；
 *      外层高度从「骨架高度」弹簧过渡到「内容高度」，不跳（AutoHeight）；
 *   4. 骨架从未显示过（请求比 delay 快）时，内容直接出现，不额外再演一次入场。
 */
const MOTION_MS_REVEAL = 260;

export const SKELETON_MOTION = {
  /** 骨架出现前的等待（秒） */
  delay: 0.15,
  /** 骨架浮现 */
  appear: { duration: MOTION_DURATION.slow, ease: MOTION_EASE.out },
  /** 骨架让位（比内容入场快，先让开再进场） */
  exit: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.in },
  /** 内容接棒入场 */
  reveal: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    transition: { y: MOTION_SPRING.soft, opacity: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out } },
  },
  /** Skeletonize 的「条 -> 文字」颜色过渡时长（毫秒，与 CSS 的 --km-dur-slow 一致） */
  revealMs: MOTION_MS_REVEAL,
  /** 骨架/内容高度差：与面板展开同一条柔和弹簧，可被打断 */
  height: MOTION_SPRING.soft,
} as const;

/** 按性格取过渡（保留旧名字，便于渐进式迁移） */
export const MOTION_VARIANTS = {
  page: {
    initial: SURFACE_MOTION.enter.initial,
    animate: { ...SURFACE_MOTION.enter.animate, transition: SURFACE_MOTION.enter.transition },
    exit: { ...SURFACE_MOTION.enter.exit, transition: MOTION_TRANSITION.exit },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: MOTION_TRANSITION.fadeIn },
    exit: { opacity: 0, transition: MOTION_TRANSITION.fadeOut },
  },
  pop: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1, transition: { ...MOTION_TRANSITION.snappy, opacity: MOTION_TRANSITION.fadeIn } },
    exit: { opacity: 0, scale: 0.97, transition: MOTION_TRANSITION.fadeOut },
  },
  collapse: {
    initial: { height: 0, opacity: 0, overflow: "hidden" },
    animate: {
      height: "auto",
      opacity: 1,
      overflow: "hidden",
      transition: { height: MOTION_SPRING.soft, opacity: MOTION_TRANSITION.fadeIn },
    },
    exit: {
      height: 0,
      opacity: 0,
      overflow: "hidden",
      transition: { height: MOTION_SPRING.soft, opacity: MOTION_TRANSITION.fadeOut },
    },
  },
} satisfies Record<string, Variants>;

/** 列表容器：子项依次进场（Follow-through） */
export const createListVariants = (stagger = 0.035, delay = 0): Variants => ({
  initial: {},
  animate: { transition: { staggerChildren: stagger, delayChildren: delay } },
  exit: {},
});

/** 列表子项：进场 + 退场 */
export const listItemVariants: Variants = {
  initial: CONTENT_MOTION.item.initial,
  animate: {
    ...CONTENT_MOTION.item.animate,
    transition: {
      y: MOTION_SPRING.layout,
      scale: MOTION_SPRING.layout,
      opacity: MOTION_TRANSITION.fadeIn,
    },
  },
  exit: {
    ...CONTENT_MOTION.item.exit,
    transition: { opacity: MOTION_TRANSITION.fadeOut, scale: CONTENT_MOTION.exitTransition },
  },
};

/** 共享元素（layoutId）统一过渡 */
export const sharedLayoutTransition: Transition = MOTION_SPRING.shared;

/**
 * 依据列表索引生成进场延迟。
 * 只用前 N 个产生错峰，后面的立即出现——避免长列表末尾「排队出现」拖沓（Timing）。
 */
export const contentStagger = (index: number, max = 0.14) =>
  Math.min(index * CONTENT_MOTION.stagger(1) * 1, max);

/** 根据「移动距离」自动选时长：远距离慢、近距离快（Timing 原则） */
export const distanceToDuration = (distancePx: number) =>
  Math.min(
    MOTION_DURATION.slower,
    Math.max(MOTION_DURATION.fast, distancePx / 900),
  );
