/**
 * 页面数据预取的登记表（只登记，不依赖任何页面代码，避免循环引用）。
 *
 * 每个页面在 src/routeQueries/*.ts 里用 registerRouteData 声明「进入这个地址需要哪些请求」：
 * 悬停链接、点击、navigate()、前进后退时，routePreload 会按地址匹配并提前发出这些请求，
 * 页面里的 useRouteQuery 用同一个 RouteQuery（同 key）接住结果。
 */
export type RouteDataPreloader = (params: Record<string, string | undefined>, search: URLSearchParams) => void;

export type RouteDataRegistration = { pattern: string; preload: RouteDataPreloader };

export const routeDataRegistry: RouteDataRegistration[] = [];

/** pattern 是 react-router 的路径模式，例如 "/admin/settings/site"、"/instance/:uuid" */
export function registerRouteData(pattern: string, preload: RouteDataPreloader) {
  routeDataRegistry.push({ pattern, preload });
}
