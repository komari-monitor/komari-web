import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAnimate } from "motion/react";
import { endNavigation, useNavigationPending } from "@/lib/routeData";
import { markRouteCommitted } from "@/lib/routePreload";
import { MOTION_EASE } from "@/lib/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";

/** 切换很快（代码块和数据都已就绪）时不出现进度条 */
const SHOW_DELAY_MS = 100;

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
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  useLayoutEffect(() => {
    markRouteCommitted(location.pathname);
    if (window.location.pathname === location.pathname) endNavigation();
  }, [location.pathname]);

  useEffect(() => {
    const bar = scope.current;
    if (!bar) return;
    if (pending) {
      const timer = window.setTimeout(() => {
        shown.current = true;
        setVisible(true);
        animate(bar, { opacity: 1 }, { duration: 0.12 });
        if (reduced) {
          animate(bar, { scaleX: 0.6 }, { duration: 0 });
        } else {
          animate(bar, { scaleX: [0, 0.3] }, { duration: 0.25, ease: MOTION_EASE.out }).then(() => {
            if (scope.current) animate(scope.current, { scaleX: 0.85 }, { duration: 8, ease: [0.1, 0.6, 0.3, 1] });
          });
        }
      }, SHOW_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    if (!shown.current) return;
    shown.current = false;
    let cancelled = false;
    animate(bar, { scaleX: 1 }, { duration: reduced ? 0 : 0.2, ease: MOTION_EASE.standard })
      .then(() => (cancelled ? undefined : animate(bar, { opacity: 0 }, { duration: 0.2, delay: 0.05 })))
      .then(() => {
        if (cancelled) return;
        if (scope.current) animate(scope.current, { scaleX: 0 }, { duration: 0 });
        setVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pending, reduced, animate, scope]);

  return (
    <div
      ref={scope}
      aria-hidden
      className="km-route-progress"
      data-visible={visible || undefined}
      style={{ opacity: 0, transform: "scaleX(0)" }}
    />
  );
}
