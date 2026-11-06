import React from "react";
import { cn } from "@/lib/utils";
import Loading from "@/components/loading";
import { SKELETON_MOTION } from "@/lib/motion";

/**
 * 骨架屏原语。
 * 半透明灰块，按 --km-skeleton-i 错峰呼吸（见 global.css 3.5 节）。
 * 骨架只是「形状提示」：尺寸尽量贴近真实内容，内容到达时外层高度就几乎不用变。
 */
export type SkeletonProps = React.HTMLAttributes<HTMLSpanElement> & {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  circle?: boolean;
  /** 错峰索引：同一组里越靠后的块呼吸越晚 */
  index?: number;
};

export const Skeleton = ({
  width,
  height = 12,
  radius,
  circle,
  index = 0,
  className,
  style,
  ...props
}: SkeletonProps) => (
  <span
    aria-hidden="true"
    className={cn("km-skeleton", className)}
    style={{
      width: width ?? (circle ? height : "100%"),
      height,
      borderRadius: circle ? "9999px" : radius,
      flexShrink: 0,
      ["--km-skeleton-i" as string]: index,
      ...style,
    }}
    {...props}
  />
);

/**
 * 一组骨架：负责延迟浮现和无障碍状态。
 * label 只在体积较大的骨架里显示（小骨架 = 一行字/一个数字，不需要「加载中」打扰）。
 */
export const SkeletonGroup = ({
  children,
  className,
  style,
  label,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** 可见的加载提示；不传则只给读屏器 */
  label?: React.ReactNode;
  as?: "div" | "span";
}) => (
  <Tag
    role="status"
    aria-live="polite"
    aria-busy="true"
    className={cn("km-skeleton-group", className)}
    style={style}
  >
    {children}
    {label ? (
      <span className="km-skeleton-label mt-1 flex flex-col items-center gap-0.5 text-center text-xs text-muted-foreground">
        {label}
      </span>
    ) : (
      <span className="sr-only">Loading</span>
    )}
  </Tag>
);

const LINE_WIDTHS = ["92%", "76%", "84%", "60%", "70%"];

/** 多行文字 */
export const SkeletonLines = ({
  lines = 3,
  lineHeight = 12,
  gap = 8,
  offset = 0,
}: {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  /** 错峰起点（嵌在卡片里时接着卡片头部继续错峰） */
  offset?: number;
}) => (
  <span className="flex w-full flex-col" style={{ gap }}>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton
        key={i}
        index={offset + i}
        height={lineHeight}
        width={lines === 1 ? "100%" : LINE_WIDTHS[i % LINE_WIDTHS.length]}
      />
    ))}
  </span>
);

/** 卡片：标题 + 几行文字，可选一块媒体区（图表/图片） */
export const SkeletonCard = ({
  lines = 3,
  media,
  index = 0,
  className,
  style,
}: {
  lines?: number;
  /** 媒体区高度（像素）；用于图表卡片 */
  media?: number;
  index?: number;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div className={cn("km-skeleton-card flex flex-col gap-3 p-4", className)} style={style}>
    <span className="flex items-center gap-2">
      <Skeleton circle height={20} index={index} />
      <Skeleton width="40%" height={14} index={index + 1} />
    </span>
    <SkeletonLines lines={lines} offset={index + 2} />
    {media ? <Skeleton height={media} radius={8} index={index + 3} /> : null}
  </div>
);

/**
 * 占位文本：n 个数字宽的「不可见字符」（U+2007 figure space，不会被折叠）。
 * 数据还没到时放进真实组件里，Skeletonize 会把它画成同样宽的条。
 */
export const skeletonText = (chars: number) => "\u2007".repeat(Math.max(1, Math.round(chars)));

/**
 * mount   挂载时就在加载：内容从第一帧起隐藏（不会先闪出占位数据），稍后浮现色卡
 * update  已有内容后重新加载：旧内容先留着，超过 delay 才交叉淡化成色卡
 * settling 数据已到，等新内容的首次渲染做完（见下）
 * reveal  色卡淡出、内容淡入
 * reveal-content 色卡还没来得及浮现时数据就到了：只把内容淡入，不闪色卡
 */
type SkeletonState = "mount" | "update" | "settling" | "reveal" | "reveal-content" | "off";

/** 色卡浮现前的等待（与 CSS 的 km-sk-card-in 延迟一致） */
const CARD_DELAY_MS = 120;

/**
 * 加载中的区域：最外层变成一张半透明的主题色卡片，里面的内容在原位隐藏（布局不变）。
 * - 大区域传 label：色卡中央显示原来的转圈 +「加载中」；
 * - 小东西（站名、数字、单个字段）不传 label：就是一块与内容同尺寸的色块；
 * - 嵌套时只有最外层画色卡，里层不重复；
 * - 加载完成不换 DOM：色卡淡出、内容淡入（SKELETON_MOTION 的节奏），高度变化交给外层 AutoHeight。
 */
export const Skeletonize = ({
  loading,
  children,
  label = false,
  className,
  style,
  as: Tag = "div",
}: {
  loading: boolean;
  children: React.ReactNode;
  label?: boolean;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "span";
}) => {
  const [state, setState] = React.useState<SkeletonState>(loading ? "mount" : "off");
  const origin = React.useRef<"mount" | "update">("mount");
  const startedAt = React.useRef(loading ? performance.now() : 0);
  const [prevLoading, setPrevLoading] = React.useState(loading);

  // 渲染期同步派生：loading 翻转的同一次提交就切换状态，不会先闪一帧
  if (prevLoading !== loading) {
    setPrevLoading(loading);
    if (loading) {
      origin.current = "update";
      setState("update");
    } else if (origin.current === "update") {
      // 旧内容一直可见：请求比 delay 快就原地更新，不演过渡
      const shown = performance.now() - startedAt.current >= SKELETON_MOTION.delay * 1000;
      setState(shown ? "settling" : "off");
    } else {
      setState("settling");
    }
  }

  React.useEffect(() => {
    if (loading) startedAt.current = performance.now();
  }, [loading]);

  /*
    新数据通常和 loading=false 在同一次提交里到达，这一帧往往是长任务（例如几张 recharts 一起重绘）。
    CSS 动画的时钟在长任务期间照走，直接开始淡入的话前 100~200ms 画不出来，看起来像「啪」一下。
    等两帧（长任务结束、新内容已绘制在色卡下面）再开始交叉淡化。
  */
  React.useEffect(() => {
    if (state !== "settling") return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const cardShown = performance.now() - startedAt.current >= CARD_DELAY_MS;
        setState(origin.current === "mount" && !cardShown ? "reveal-content" : "reveal");
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [state]);

  React.useEffect(() => {
    if (state !== "reveal" && state !== "reveal-content") return;
    const id = window.setTimeout(() => setState("off"), SKELETON_MOTION.revealMs);
    return () => window.clearTimeout(id);
  }, [state]);

  const attr = state === "off" ? undefined : state === "settling" ? origin.current : state;

  return (
    <Tag
      className={cn("km-skeletonize", label && "km-skeletonize-labeled", className)}
      style={style}
      data-skeleton={attr}
      aria-busy={loading || undefined}
      inert={loading || undefined}
    >
      {children}
      {label && state !== "off" ? (
        <span className="km-skeleton-label">
          <span className="km-skeleton-label-box">
            <Loading bare />
          </span>
        </span>
      ) : null}
    </Tag>
  );
};

/**
 * 兼容旧调用：图表区现在由外层 Skeletonize 的色卡整体覆盖，不再单独画折线轮廓。
 */
export const SkeletonChartShape = (props: { className?: string }) => {
  void props;
  return null;
};
