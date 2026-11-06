import type { ReactNode, Ref } from "react";
import { useCallback, useEffect } from "react";
import { Card } from "@radix-ui/themes";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { animate, motion, useIsPresent, useMotionValue } from "motion/react";
import { Menu } from "lucide-react";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import {
  CONTENT_MOTION,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ChartSize } from "./types";
import { useChartFlipSizer } from "./useChartFlip";

const chartSizeClass: Record<ChartSize, string> = {
  small: "lg:col-span-1",
  medium: "lg:col-span-2",
  large: "lg:col-span-3",
};

type SortableChartCardProps = {
  chartId: string;
  children: ReactNode;
  dragLabel: string;
  size: ChartSize;
  /** AnimatePresence（popLayout）测量退场卡片用的 ref */
  ref?: Ref<HTMLDivElement>;
};

const SortableChartCard = ({
  chartId,
  children,
  dragLabel,
  size,
  ref,
}: SortableChartCardProps) => {
  // 退场中的卡片已不在 SortableContext 里：不再参与拖拽，也不接收点击
  const isPresent = useIsPresent();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: chartId, disabled: !isPresent });
  const flipSizerRef = useChartFlipSizer(chartId);
  // 进场用 motion value 手动驱动，不写 initial/animate：
  // 拖放落位时 React 会把被挤开的卡片整棵子树的 ref 重新挂一遍，motion 把「再次挂载」当作要重播进场，
  // 写了 initial 的元素会被打回初始值（闪一下、下沉 12px 再浮上来）。没有 initial 就没有可回退的值。
  // 系统「减少动态效果」时与 MotionConfig reducedMotion="user" 一致：只淡入，不位移/缩放。
  const reduced = useKmReducedMotion();
  const enterOpacity = useMotionValue<number>(CONTENT_MOTION.item.initial.opacity);
  const enterY = useMotionValue<number>(reduced ? 0 : CONTENT_MOTION.item.initial.y);
  const enterScale = useMotionValue<number>(reduced ? 1 : CONTENT_MOTION.item.initial.scale);
  useEffect(() => {
    const controls = [
      animate(enterOpacity, CONTENT_MOTION.item.animate.opacity, MOTION_TRANSITION.fadeIn),
      animate(enterY, CONTENT_MOTION.item.animate.y, MOTION_SPRING.layout),
      animate(enterScale, CONTENT_MOTION.item.animate.scale, MOTION_SPRING.layout),
    ];
    return () => controls.forEach((control) => control.stop());
  }, [enterOpacity, enterY, enterScale]);
  const cellRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [setNodeRef, ref],
  );

  return (
    // useSortable 节点是普通 div，只有 dnd-kit 的 style.transform / transition：
    // - 不开 motion layout：layout 投影写同一个 transform，拖放落下后还会再播一次位移；
    // - 进场/退场动画也不放在这一层：松手后 React 会把被挤开的卡片 insertBefore 挪到新位置，
    //   这个节点的 ref 会先置空再挂回，motion 认为元素「重新挂载」，把它打回 initial 再播一遍进场。
    // 拖放重排的补位只用 dnd-kit 自己的 transition（rectSortingStrategy）；
    // 改尺寸 / 增删卡片的过渡由 useChartFlip 在内层 sizer/layer 上做。
    <div
      ref={cellRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "min-w-0",
        chartSizeClass[size],
        isDragging && "relative z-10 opacity-80",
        !isPresent && "pointer-events-none",
      )}
    >
      {/*
        content 层：卡片进场淡入上浮、删除时淡出微缩（与后台 dashboard 的 widget 同一套手感）。
        这一层也是 FLIP 的 sizer：留在网格里占位，过渡期间钉成新格子的高度；
        第一个子元素（Card）是移动的 layer。
      */}
      <motion.div
        ref={flipSizerRef}
        style={{ opacity: enterOpacity, y: enterY, scale: enterScale }}
        // 减少动态效果：只淡出，不缩放（与后台 dashboard widget 一致）
        exit={reduced ? { opacity: CONTENT_MOTION.item.exit.opacity } : CONTENT_MOTION.item.exit}
        transition={{
          scale: CONTENT_MOTION.exitTransition,
          opacity: MOTION_TRANSITION.fadeOut,
        }}
        className="h-full min-w-0"
      >
        {/*
          卡片内边距 block（size 2），拖拽柄 / 标题行 / 图例 / 图表之间 group。
          Radix Card 的 display:block 会盖掉 flex 类，gap 不生效，所以用内联样式开 flex。
        */}
        <Card
          size="2"
          className="h-full min-w-0 flex-col gap-km-group"
          style={{ display: "flex" }}
        >
          <div className="-mt-2 flex h-5 shrink-0 items-center justify-center">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="inline-flex h-6 w-10 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent-3 hover:text-accent-12 active:cursor-grabbing"
            >
              <Menu className="size-4" />
              <span className="sr-only">{dragLabel}</span>
            </button>
          </div>
          {children}
        </Card>
      </motion.div>
    </div>
  );
};

export default SortableChartCard;
