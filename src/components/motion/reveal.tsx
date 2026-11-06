import React from "react";
import { animate } from "motion/react";
import { SKELETON_MOTION } from "@/lib/motion";

/**
 * 骨架 -> 内容 的「接棒」入场。
 *
 * 页面组件普遍是 `if (loading) return <Loading />` 的写法：骨架和内容不会同时存在，
 * 没法做交叉淡化。RevealBoundary 包住一块区域，区域里的页面级骨架挂载时登记、
 * 卸载时注销；最后一个骨架卸载的那一帧（绘制之前）把区域设成透明并略微下沉，
 * 再按 SKELETON_MOTION.reveal 淡入上浮，内容就是「从骨架的位置浮出来」而不是突然出现。
 *
 * - 骨架从没显示过（请求比 SKELETON_MOTION.delay 快）时不播放，避免和路由入场叠两次；
 * - 不需要 reveal 的骨架（卡片内、表格内、按钮内）不登记，见 Loading 的 reveal 属性；
 * - 局部的 LoadingSwap 自己做交叉淡化，内部用 SuppressReveal 隔离，不会触发整页淡入。
 */
type RevealApi = { register: () => () => void };

const RevealContext = React.createContext<RevealApi | null>(null);

export const RevealBoundary = ({
  children,
  className,
  style,
  /** 只淡入不位移：区域里有 position: fixed 的元素时用（transform 会改变 fixed 的参照系） */
  fadeOnly = false,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  fadeOnly?: boolean;
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const pending = React.useRef(0);
  const shownAt = React.useRef(0);
  const mounted = React.useRef(true);
  const run = React.useRef(0);

  React.useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const play = React.useCallback(() => {
    const el = ref.current;
    if (!el || !mounted.current) return;
    // 骨架露面不足 delay：用户根本没看到骨架，直接显示内容
    if (performance.now() - shownAt.current < SKELETON_MOTION.delay * 1000) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = ++run.current;
    const { initial, transition } = SKELETON_MOTION.reveal;
    el.style.opacity = String(initial.opacity);
    if (!fadeOnly) el.style.transform = `translateY(${initial.y}px)`;
    const done = () => {
      if (run.current !== id) return;
      el.style.removeProperty("opacity");
      el.style.removeProperty("transform");
    };
    // 显式给出起点关键帧：motion 不读取我们刚写进 style 的值
    const fade = animate(el, { opacity: [initial.opacity, 1] }, transition.opacity);
    const lift = fadeOnly ? null : animate(el, { y: [initial.y, 0] }, transition.y);
    void Promise.all([fade, lift ?? Promise.resolve()]).then(done);
  }, [fadeOnly]);

  const api = React.useMemo<RevealApi>(
    () => ({
      register: () => {
        if (pending.current === 0) shownAt.current = performance.now();
        pending.current += 1;
        return () => {
          pending.current -= 1;
          // 推迟到微任务：StrictMode 的「卸载-重挂」会在同一轮里重新登记，不能误判为加载完成。
          // 微任务仍在浏览器绘制之前执行，内容不会先闪出一帧。
          queueMicrotask(() => {
            if (pending.current === 0) play();
          });
        };
      },
    }),
    [play],
  );

  return (
    <RevealContext.Provider value={api}>
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    </RevealContext.Provider>
  );
};

/** 页面级骨架调用：挂载期间让最近的 RevealBoundary 知道「还在加载」 */
export const useRevealPending = (active: boolean) => {
  const api = React.useContext(RevealContext);
  React.useLayoutEffect(() => {
    if (!active || !api) return;
    return api.register();
  }, [active, api]);
};

/** 隔离：内部的骨架不再通知外层 RevealBoundary（局部交叉淡化自己处理入场） */
export const SuppressReveal = ({ children }: { children: React.ReactNode }) => (
  <RevealContext.Provider value={null}>{children}</RevealContext.Provider>
);
