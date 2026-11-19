import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { endNavigation, useNavigationPending } from "@/lib/routeData";
import { markRouteCommitted } from "@/lib/routePreload";
import { MOTION_EASE_CSS } from "@/lib/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";

/** 切换很快（代码块和数据都已就绪）时不出现进度条 */
const SHOW_DELAY_MS = 100;

function runAnimation(
  el: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
  activeAnimations: Animation[],
): Promise<void> {
  if (typeof el.animate !== "function" || options.duration === 0) {
    const last = keyframes[keyframes.length - 1];
    if (last?.opacity !== undefined) el.style.opacity = String(last.opacity);
    if (last?.transform !== undefined) el.style.transform = String(last.transform);
    return Promise.resolve();
  }
  const anim = el.animate(keyframes, { fill: "forwards", ...options });
  activeAnimations.push(anim);
  return anim.finished.then(
    () => {
      const last = keyframes[keyframes.length - 1];
      if (last?.opacity !== undefined) el.style.opacity = String(last.opacity);
      if (last?.transform !== undefined) el.style.transform = String(last.transform);
      anim.cancel();
    },
    () => undefined,
  );
}

/**
 * 页面切换的顶部细进度条。
 * history 一变（见 routePreload）就进入 pending：100ms 后出现并缓慢推进到约 85%，
 * 新页面提交到 DOM 后补满并淡出。同时负责「新路由已提交」的检测：
 * 路由更新走 transition，useLocation 只在新页面真正提交时才变成新地址。
 */
export default function NavigationProgress() {
  const location = useLocation();
  const pending = useNavigationPending();
  const reduced = useKmReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  useLayoutEffect(() => {
    markRouteCommitted(location.pathname);
    if (window.location.pathname === location.pathname) endNavigation();
  }, [location.pathname]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const animations: Animation[] = [];
    let cancelled = false;
    const cancelAll = () => {
      cancelled = true;
      for (const anim of animations) anim.cancel();
      animations.length = 0;
    };

    if (pending) {
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        shown.current = true;
        setVisible(true);
        void runAnimation(bar, [{ opacity: 1 }], { duration: 120 }, animations);
        if (reduced) {
          void runAnimation(bar, [{ transform: "scaleX(0.6)" }], { duration: 0 }, animations);
        } else {
          void runAnimation(
            bar,
            [{ transform: "scaleX(0)" }, { transform: "scaleX(0.3)" }],
            { duration: 250, easing: MOTION_EASE_CSS.out },
            animations,
          ).then(() => {
            if (!cancelled && barRef.current) {
              void runAnimation(
                barRef.current,
                [{ transform: "scaleX(0.3)" }, { transform: "scaleX(0.85)" }],
                { duration: 8000, easing: "cubic-bezier(0.1, 0.6, 0.3, 1)" },
                animations,
              );
            }
          });
        }
      }, SHOW_DELAY_MS);
      return () => {
        window.clearTimeout(timer);
        cancelAll();
      };
    }

    if (!shown.current) return;
    shown.current = false;
    const currentTransform = getComputedStyle(bar).transform;
    void runAnimation(
      bar,
      [
        { transform: currentTransform === "none" ? "scaleX(0.3)" : currentTransform },
        { transform: "scaleX(1)" },
      ],
      { duration: reduced ? 0 : 200, easing: MOTION_EASE_CSS.standard },
      animations,
    )
      .then(() =>
        cancelled
          ? undefined
          : runAnimation(
              bar,
              [{ opacity: 1 }, { opacity: 0 }],
              { duration: 200, delay: 50 },
              animations,
            ),
      )
      .then(() => {
        if (cancelled) return;
        bar.style.transform = "scaleX(0)";
        bar.style.opacity = "0";
        setVisible(false);
      });

    return cancelAll;
  }, [pending, reduced]);

  return (
    <div
      ref={barRef}
      aria-hidden
      className="km-route-progress"
      data-visible={visible || undefined}
      style={{ opacity: 0, transform: "scaleX(0)" }}
    />
  );
}
