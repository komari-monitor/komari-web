import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  useLocation,
  useNavigate,
  type NavigateOptions,
  type To,
} from "react-router-dom";
import { setSharedHero } from "@/lib/sharedElement";
import { setViewTransitionActive } from "@/lib/viewTransitionState";

type ViewTransition = {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition: () => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (
    callback: () => void | Promise<void>,
  ) => ViewTransition;
};

const HERO_SELECTOR = '[style*="km-node-hero"]';
/** 新页面迟迟不提交时的兜底：浏览器在回调期间会冻结画面，不能无限等 */
const COMMIT_TIMEOUT_MS = 400;

/**
 * 等待路由更新真正提交到 DOM。
 * BrowserRouter（v7）用 React.startTransition 提交路由，flushSync 冲不掉 transition lane，
 * 回调同步返回时 DOM 仍是旧页面，浏览器会把旧卡片当成「新快照」，共享元素自己跟自己配对。
 * 这里返回 Promise，浏览器会等它 resolve 后再拍新快照。
 * 用 MutationObserver 而不是 rAF：回调期间渲染被暂停，rAF 不保证触发。
 */
const waitForRouteCommit = (oldHero: Element | null) =>
  new Promise<void>((resolve) => {
    const root = document.getElementById("root") ?? document.body;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      window.clearTimeout(timer);
      resolve();
    };
    const committed = () => {
      if (!oldHero) return true; // 无共享元素：任意一次 DOM 提交即可
      const hero = document.querySelector(HERO_SELECTOR);
      return !oldHero.isConnected && hero !== null && hero !== oldHero;
    };
    const observer = new MutationObserver(() => {
      if (committed()) finish();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
    const timer = window.setTimeout(finish, COMMIT_TIMEOUT_MS);
  });

/** 浏览器是否支持 View Transitions API */
export const supportsViewTransition = () =>
  typeof document !== "undefined" &&
  typeof (document as ViewTransitionDocument).startViewTransition ===
    "function";

/** 是否应该跳过动画（系统偏好减少动态效果） */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

type TransitionNavigateOptions = NavigateOptions & {
  /** 触发这次跳转的共享元素（通常是节点 uuid） */
  sharedHero?: string;
};

/**
 * 路由级「共享元素」跳转（基于浏览器原生 View Transitions）。
 *
 * 配合 lib/sharedElement 使用：点击卡片的瞬间把该卡片登记为共享元素，浏览器会把
 * 列表里的标题和详情页标题补间成「同一个东西」，表现为它从旧位置、旧尺寸平滑地
 * 移动到新布局。浏览器不支持、或系统偏好减少动效时自动降级为普通跳转。
 *
 * 为什么不用 <Link viewTransition>：该属性只在 React Router 的 data router 下生效，
 * 本项目使用 BrowserRouter，因此手动调用 startViewTransition。
 */
export const useViewTransitionNavigate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const transitionRef = useRef<ViewTransition | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const vtNavigate = useCallback(
    (to: To, options?: TransitionNavigateOptions) => {
      const { sharedHero, ...navigateOptions } = options ?? {};
      const doc = document as ViewTransitionDocument;

      const clearHeroLater = () => {
        // 等新页面挂载并把共享元素名应用到详情页标题后再清除登记
        window.setTimeout(() => setSharedHero(null), 600);
      };

      if (
        !supportsViewTransition() ||
        prefersReducedMotion() ||
        !doc.startViewTransition
      ) {
        if (sharedHero) setSharedHero(sharedHero);
        navigate(to, navigateOptions);
        clearHeroLater();
        return;
      }

      // 打断上一次未完成的过渡，避免动画排队（被打断也是自然的）
      transitionRef.current?.skipTransition();
      /*
        关键顺序：浏览器的「旧快照」是在 startViewTransition 被调用的那一刻拍的。
        所以共享元素名必须在调用之前就落到 DOM 上——用 flushSync 强制同步提交，
        否则旧快照里没有这个名字，就配不成对，退化成普通交叉淡化。
      */
      flushSync(() => {
        if (sharedHero) setSharedHero(sharedHero);
        setViewTransitionActive(true);
      });
      // 旧快照里的共享元素（被点击卡片的标题）；新页面提交后它会被卸载
      const oldHero = sharedHero ? document.querySelector(HERO_SELECTOR) : null;
      const transition = doc.startViewTransition(() => {
        navigate(to, navigateOptions);
        return waitForRouteCommit(oldHero);
      });
      transitionRef.current = transition;
      setIsTransitioning(true);
      transition.finished.finally(() => {
        if (transitionRef.current === transition) {
          transitionRef.current = null;
          setIsTransitioning(false);
        }
        setViewTransitionActive(false);
        clearHeroLater();
      });
    },
    [navigate],
  );

  return { navigate: vtNavigate, isTransitioning, currentLocation: location };
};

export default useViewTransitionNavigate;
