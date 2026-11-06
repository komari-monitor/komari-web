import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { spring } from "motion/react";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import { MOTION_SPRING } from "@/lib/motion";
import type { DashboardChart } from "./types";

/*
  图表网格「调整」类操作（S/M/L 改尺寸、添加/删除图表、重置）的 FLIP 过渡。

  为什么不用 motion 的 layout：
  - useSortable 节点本身被 dnd-kit 用 style.transform 控制，layout 投影写同一个 transform，
    拖放落下后还会把「旧格子 -> 新格子」再补间一次；
  - 放在内层用 layout 也是 scale 投影：卡片圆角、内边距、标题和坐标轴会在补间中被拉伸。

  做法（每张卡片两层：sizer 留在网格里占位，layer 是卡片本体）：
  1. 改动前 capture()：同步记下每张卡片 layer 的屏幕矩形（First）；
  2. 提交后（useLayoutEffect，绘制前）读出新的格子矩形（Last）；
  3. sizer 钉成新格子的像素高度（网格行高立即是最终值，不会被动画中的卡片反向撑动），
     layer 脱离文档流，从旧矩形出发，用真实的 width/height + translate 弹簧到新格子（Play）。
     改的是尺寸而不是 scale：图表与文字在每一帧按真实宽度重新布局，不会变形；
  4. 结束后清掉内联样式，回到普通网格布局。

  只有调用了 capture() 的那次提交才会播放：拖放重排的位移完全交给 dnd-kit，
  卡片高度随图例行数变化由卡片内的 AutoHeight 负责，实时数据刷新也不会触发。
  系统「减少动态效果」时 capture() 直接跳过，改动瞬时生效。
*/

type Snapshot = {
  rects: Map<string, DOMRect>;
  /** 发起改动的卡片：动画期间压在相邻卡片上面 */
  focusId?: string;
};

type ChartFlipRegistry = (chartId: string, sizer: HTMLDivElement) => () => void;

const ChartFlipContext = createContext<ChartFlipRegistry | null>(null);

export const ChartFlipProvider = ChartFlipContext.Provider;

/** 卡片 sizer 的 callback ref：sizer 的第一个子元素就是参与 FLIP 的 layer */
export const useChartFlipSizer = (chartId: string) => {
  const register = useContext(ChartFlipContext);
  return useCallback(
    (sizer: HTMLDivElement | null) => {
      if (!sizer || !register) return;
      return register(chartId, sizer);
    },
    [register, chartId],
  );
};

/** 位置/尺寸小于这个差值（像素）不做动画，避免亚像素抖动 */
const FLIP_THRESHOLD = 0.5;

/** 0 -> 1 的进度弹簧：位置与尺寸共用同一条 layout 弹簧，同时到达；静止阈值收紧到亚像素 */
const FLIP_SPRING = { ...MOTION_SPRING.layout, restDelta: 0.0005, restSpeed: 0.005 };

/**
 * 每帧最多推进的动画时间（毫秒）。
 * 改尺寸会让每张图表按新宽度重绘，开发模式下偶尔有 100~400ms 的长帧；
 * 按真实时间推进的弹簧会在长帧后一下跳到终点。这里按帧推进、单帧封顶：卡顿时动画放慢，但每一帧都连续。
 */
const MAX_FRAME_MS = 1000 / 30;

type FlipRun = { stop: () => void };

/** 用 rAF 驱动 0 -> 1 的弹簧；时钟从第一帧开始计，提交前后的阻塞不会吃掉进度 */
const runSpring = (onUpdate: (progress: number) => void, onComplete: () => void): FlipRun => {
  const generator = spring({ keyframes: [0, 1], ...FLIP_SPRING });
  let elapsed = 0;
  let last: number | null = null;
  let handle = 0;
  let stopped = false;
  const tick = (now: number) => {
    if (stopped) return;
    if (last !== null) elapsed += Math.min(now - last, MAX_FRAME_MS);
    last = now;
    const state = generator.next(elapsed);
    onUpdate(state.done ? 1 : state.value);
    if (state.done) {
      onComplete();
      return;
    }
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(handle);
    },
  };
};

const clearFlipStyle = (sizer: HTMLDivElement) => {
  sizer.style.height = "";
  sizer.style.position = "";
  const layer = sizer.firstElementChild as HTMLElement | null;
  if (!layer) return;
  for (const key of ["position", "left", "top", "width", "height", "transform", "zIndex"] as const) {
    layer.style[key] = "";
  }
};

export function useChartFlip(charts: DashboardChart[]) {
  const reduced = useKmReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const sizers = useRef(new Map<string, HTMLDivElement>());
  const snapshot = useRef<Snapshot | null>(null);
  const running = useRef<FlipRun | null>(null);
  const prevKey = useRef<string | null>(null);

  /** 停掉进行中的过渡并恢复普通布局（之后读到的就是真实网格位置） */
  const settle = useCallback(() => {
    running.current?.stop();
    running.current = null;
    sizers.current.forEach(clearFlipStyle);
  }, []);

  const register = useCallback<ChartFlipRegistry>((chartId, sizer) => {
    sizers.current.set(chartId, sizer);
    return () => {
      if (sizers.current.get(chartId) === sizer) sizers.current.delete(chartId);
    };
  }, []);

  /** 在会改变网格布局的状态更新之前同步调用：记下当前（含动画中途）每张卡片的位置 */
  const capture = useCallback((focusId?: string) => {
    if (reducedRef.current) return;
    const rects = new Map<string, DOMRect>();
    sizers.current.forEach((sizer, chartId) => {
      const layer = sizer.firstElementChild;
      if (layer) rects.set(chartId, layer.getBoundingClientRect());
    });
    const taken: Snapshot = { rects, focusId };
    snapshot.current = taken;
    // 这次操作没有引起布局变化（例如删除一张已不存在的卡片）：快照不留到之后无关的提交
    window.setTimeout(() => {
      if (snapshot.current === taken) snapshot.current = null;
    }, 0);
  }, []);

  /** 拖拽开始：位移交给 dnd-kit，FLIP 立即收尾，不和拖拽叠加 */
  const cancel = useCallback(() => {
    snapshot.current = null;
    settle();
  }, [settle]);

  // 布局签名：顺序 + 尺寸。只在它变化时消费快照
  const layoutKey = charts.map((chart) => `${chart.id}:${chart.size}`).join("|");

  useLayoutEffect(() => {
    if (prevKey.current === layoutKey) return;
    prevKey.current = layoutKey;
    const taken = snapshot.current;
    snapshot.current = null;
    settle();
    if (!taken || reducedRef.current) return;

    const items: Array<{ sizer: HTMLDivElement; layer: HTMLElement; from: DOMRect; to: DOMRect }> = [];
    for (const chartId of layoutKey.split("|").map((entry) => entry.slice(0, entry.lastIndexOf(":")))) {
      const sizer = sizers.current.get(chartId);
      const layer = sizer?.firstElementChild as HTMLElement | null | undefined;
      const from = taken.rects.get(chartId);
      // 新增的卡片没有旧位置：交给卡片自己的进场动画
      if (!sizer || !layer || !from) continue;
      const to = layer.getBoundingClientRect();
      if (
        Math.abs(from.left - to.left) < FLIP_THRESHOLD &&
        Math.abs(from.top - to.top) < FLIP_THRESHOLD &&
        Math.abs(from.width - to.width) < FLIP_THRESHOLD &&
        Math.abs(from.height - to.height) < FLIP_THRESHOLD
      ) {
        continue;
      }
      const base = sizer.getBoundingClientRect();
      // sizer 钉成最终高度并作为 layer 的定位参照；layer 脱离文档流
      sizer.style.height = `${base.height}px`;
      sizer.style.position = "relative";
      layer.style.position = "absolute";
      layer.style.left = "0px";
      layer.style.top = "0px";
      if (chartId === taken.focusId) layer.style.zIndex = "1";
      items.push({ sizer, layer, from, to: base });
    }
    if (items.length === 0) return;

    const apply = (progress: number) => {
      const rest = 1 - progress;
      for (const { layer, from, to } of items) {
        layer.style.width = `${to.width + (from.width - to.width) * rest}px`;
        layer.style.height = `${to.height + (from.height - to.height) * rest}px`;
        layer.style.transform = `translate(${(from.left - to.left) * rest}px, ${(from.top - to.top) * rest}px)`;
      }
    };
    // 绘制前先放到旧位置，第一帧不闪新布局
    apply(0);
    const run = runSpring(apply, () => {
      if (running.current !== run) return;
      running.current = null;
      for (const { sizer } of items) clearFlipStyle(sizer);
    });
    running.current = run;
  }, [layoutKey, settle]);

  // 窗口尺寸变化会让钉住的像素尺寸失效：直接收尾到真实布局
  useEffect(() => {
    window.addEventListener("resize", settle);
    return () => {
      window.removeEventListener("resize", settle);
      settle();
    };
  }, [settle]);

  return useMemo(() => ({ register, capture, cancel }), [register, capture, cancel]);
}
