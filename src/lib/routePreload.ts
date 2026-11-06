import { matchPath, matchRoutes, type RouteObject } from "react-router-dom";
import { beginNavigation, collectRouteQueries, setNavigationGate } from "@/lib/routeData";
import { routeDataRegistry } from "@/lib/routeRegistry";
import "@/routeQueries";

/**
 * 页面切换的预加载入口：
 * - preloadRoute(url)：按地址提前加载页面代码块（routes 里的 handle.preload）并发出登记过的数据请求；
 * - installRoutePreload(routes)：
 *   1) 给 history.pushState / replaceState 打补丁、监听 popstate：地址的 pathname 一变，
 *      立刻 preloadRoute + beginNavigation（顶部进度条、useRouteQuery 进入「切换中」）；
 *      react-router 的 Link、navigate()、Navigate 重定向和前进后退都走这里，不需要逐个改调用处；
 *   2) 悬停 / 聚焦 / 触摸站内链接约 80ms 后预加载，点下去时数据往往已经到了。
 * 只有 pathname 变化才算切换页面；只改 query 的情况由页面自己处理（不挂起，必要时显示骨架）。
 */

type PreloadHandle = { preload?: () => Promise<unknown> };

let routeTable: RouteObject[] = [];
/** 当前已提交到 DOM 的 pathname（NavigationProgress 维护） */
let committedPath = window.location.pathname;

export const markRouteCommitted = (pathname: string) => {
  committedPath = pathname;
};

export function preloadRoute(url: string | URL) {
  let target: URL;
  try {
    target = new URL(url, window.location.href);
  } catch {
    return;
  }
  if (target.origin !== window.location.origin) return;
  for (const match of matchRoutes(routeTable, target.pathname) ?? []) {
    const handle = match.route.handle as PreloadHandle | undefined;
    void handle?.preload?.().catch(() => undefined);
  }
  for (const entry of routeDataRegistry) {
    const matched = matchPath({ path: entry.pattern, end: true }, target.pathname);
    if (!matched) continue;
    try {
      entry.preload(matched.params, target.searchParams);
    } catch (error) {
      console.error("route data preload failed", error);
    }
  }
}

const startNavigation = (url: string | URL | null | undefined) => {
  if (url == null) return;
  let target: URL;
  try {
    target = new URL(url, window.location.href);
  } catch {
    return;
  }
  if (target.origin !== window.location.origin || target.pathname === committedPath) return;
  const requests = collectRouteQueries(() => preloadRoute(target));
  beginNavigation();
  setNavigationGate(requests);
};

const HOVER_DELAY_MS = 80;

function findLink(event: Event) {
  const element = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(element instanceof HTMLAnchorElement)) return null;
  if (element.target && element.target !== "_self") return null;
  if (element.hasAttribute("download")) return null;
  if (element.origin !== window.location.origin) return null;
  return element;
}

let installed = false;

export function installRoutePreload(routes: RouteObject[]) {
  routeTable = routes;
  if (installed) return;
  installed = true;

  const { pushState, replaceState } = window.history;
  window.history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
    startNavigation(url);
    return pushState.call(this, data, unused, url);
  };
  window.history.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
    startNavigation(url);
    return replaceState.call(this, data, unused, url);
  };
  // 捕获阶段注册：早于 react-router 的监听，地址已经是新的
  window.addEventListener("popstate", () => startNavigation(window.location.href), true);

  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let hoverLink: HTMLAnchorElement | null = null;
  const onIntent = (event: Event) => {
    const link = findLink(event);
    if (!link || link === hoverLink) return;
    hoverLink = link;
    if (hoverTimer) clearTimeout(hoverTimer);
    // 触摸、键盘聚焦没有「路过」的问题，立即预加载
    const delay = event.type === "pointerover" ? HOVER_DELAY_MS : 0;
    hoverTimer = setTimeout(() => {
      if (link.pathname !== committedPath) preloadRoute(link.href);
    }, delay);
  };
  const onLeave = (event: Event) => {
    const link = findLink(event);
    if (!link || link !== hoverLink) return;
    const related = (event as PointerEvent).relatedTarget;
    if (related instanceof Node && link.contains(related)) return;
    hoverLink = null;
    if (hoverTimer) clearTimeout(hoverTimer);
  };
  document.addEventListener("pointerover", onIntent, { passive: true });
  document.addEventListener("focusin", onIntent);
  document.addEventListener("touchstart", onIntent, { passive: true });
  document.addEventListener("pointerout", onLeave, { passive: true });
}
