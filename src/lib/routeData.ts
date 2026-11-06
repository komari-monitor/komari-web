import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * 页面切换的数据预取（混合方案）。
 *
 * 1. 点击链接 / navigate() / 前进后退：history 一变就开始请求新页面的数据（见 routePreload.ts），
 *    顶部进度条出现，旧页面先不动；
 * 2. 新页面的路由元素外有一层 RouteGate（routes.ts 的 page()）：本次导航登记的请求在 ROUTE_DATA_BUDGET_MS
 *    之内全部到达前挂起（路由更新走 transition，React 会继续显示旧页面），切过去时 useRouteQuery 直接拿到真实数据；
 *    挂起只发生在 RouteGate 里（它只有一个 hook），页面组件自身从不挂起，不会有 hook 顺序问题；
 * 3. 超过预算还没到：不再等，先切过去，页面按原来的方式显示骨架，数据到了再揭开；
 * 4. 页面内的刷新、切 tab、筛选（key 变化 / reload）以及首次打开页面，都不挂起，直接骨架。
 *
 * 缓存只为「预取 -> 挂载」接力服务，不是长期缓存：
 * - 预取的结果 10 秒内没人用就作废，失败的预取不复用；
 * - 被页面取走后只在同一次导航里复用（StrictMode 的二次挂载、挂起后的重试），
 *   之后再进入页面一定重新请求，保存过的设置不会读到旧值。
 */

/** 切换页面时最多等多久数据（毫秒）；超过就先切换再显示骨架 */
export const ROUTE_DATA_BUDGET_MS = 5_000;
/** 预取结果无人使用时的有效期 */
const UNUSED_TTL_MS = 10_000;
/** 被取走后、同一次导航内的复用窗口 */
const CONSUMED_REUSE_MS = 2_000;
/** 导航迟迟不提交时的兜底（例如目标页面报错） */
const NAVIGATION_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// 导航状态：history 变化 -> 新路由提交到 DOM 之间为 pending
// ---------------------------------------------------------------------------

let navigationPending = false;
let navigationSeq = 0;
let navigationTimer: ReturnType<typeof setTimeout> | undefined;
const navigationListeners = new Set<() => void>();

const emitNavigation = () => navigationListeners.forEach((listener) => listener());

/** history 即将切到另一个页面时调用（routePreload.ts 的 history 补丁负责） */
export function beginNavigation() {
  navigationSeq += 1;
  if (navigationTimer) clearTimeout(navigationTimer);
  navigationTimer = setTimeout(endNavigation, NAVIGATION_TIMEOUT_MS);
  if (!navigationPending) {
    navigationPending = true;
    emitNavigation();
  }
}

/** 新路由已提交（NavigationProgress 在路由位置变化的 layout effect 里调用） */
export function endNavigation() {
  if (navigationTimer) clearTimeout(navigationTimer);
  navigationTimer = undefined;
  if (navigationPending) {
    navigationPending = false;
    emitNavigation();
  }
}

export const isNavigating = () => navigationPending;

const subscribeNavigation = (listener: () => void) => {
  navigationListeners.add(listener);
  return () => {
    navigationListeners.delete(listener);
  };
};

/** 组件里订阅「是否正在切换页面」 */
export const useNavigationPending = () =>
  useSyncExternalStore(subscribeNavigation, isNavigating, () => false);

export const currentNavigationSeq = () => navigationSeq;

/** 本次导航要等的请求（数据到达或预算用完即放行） */
type NavigationGate = { seq: number; requests: Promise<unknown>[]; promise: Promise<void>; done: boolean };
let navigationGate: NavigationGate | null = null;

/**
 * routePreload 在 beginNavigation 之后调用：promises 是这次导航登记的请求。
 * 等待期间新发起的预取（例如拿到概要后再预取详情）也加入等待，整体仍受同一个预算限制。
 */
export function setNavigationGate(promises: Promise<unknown>[]) {
  const gate: NavigationGate = {
    seq: navigationSeq,
    requests: [...promises],
    promise: Promise.resolve(),
    done: promises.length === 0,
  };
  if (!gate.done) {
    const waitAll = async () => {
      let waited = -1;
      while (waited !== gate.requests.length) {
        waited = gate.requests.length;
        await Promise.allSettled(gate.requests.slice());
      }
    };
    gate.promise = Promise.race([
      waitAll(),
      new Promise((resolve) => setTimeout(resolve, ROUTE_DATA_BUDGET_MS)),
    ]).then(() => {
      gate.done = true;
    });
  }
  navigationGate = gate;
}

/** RouteGate 用：挂载时所属的导航仍在等数据，就返回要等的 promise */
export function pendingNavigationGate(seq: number): Promise<void> | null {
  const gate = navigationGate;
  if (!gate || gate.done || gate.seq !== seq || !navigationPending) return null;
  return gate.promise;
}

// ---------------------------------------------------------------------------
// 查询缓存
// ---------------------------------------------------------------------------

/** 一个可预取的数据请求：key 决定复用，fetch 只负责发请求（不要在里面读组件状态） */
export interface RouteQuery<T> {
  key: string;
  fetch: () => Promise<T>;
}

export const routeQuery = <T>(key: string, fetch: () => Promise<T>): RouteQuery<T> => ({
  key,
  fetch,
});

type Entry<T = unknown> = {
  key: string;
  promise: Promise<T>;
  status: "pending" | "success" | "error";
  data?: T;
  error?: unknown;
  settledAt: number;
  consumedSeq?: number;
  consumedAt: number;
};

const cache = new Map<string, Entry>();

function startEntry<T>(query: RouteQuery<T>): Entry<T> {
  let promise: Promise<T>;
  try {
    promise = Promise.resolve(query.fetch());
  } catch (error) {
    promise = Promise.reject(error);
  }
  const entry: Entry<T> = {
    key: query.key,
    promise,
    status: "pending",
    settledAt: 0,
    consumedAt: 0,
  };
  promise.then(
    (data) => {
      entry.status = "success";
      entry.data = data;
      entry.settledAt = performance.now();
    },
    (error: unknown) => {
      entry.status = "error";
      entry.error = error;
      entry.settledAt = performance.now();
    },
  );
  cache.set(query.key, entry as Entry);
  return entry;
}

function isUsable(entry: Entry) {
  if (entry.status === "pending") return true;
  const now = performance.now();
  if (entry.consumedSeq === undefined) {
    return entry.status === "success" && now - entry.settledAt < UNUSED_TTL_MS;
  }
  return entry.consumedSeq === navigationSeq && now - entry.consumedAt < CONSUMED_REUSE_MS;
}

let collecting: Promise<unknown>[] | null = null;

/** 运行 fn，收集其间 prefetchRouteQuery 涉及的请求（routePreload 用来决定这次导航要等谁） */
export function collectRouteQueries(fn: () => void): Promise<unknown>[] {
  const previous = collecting;
  const collected: Promise<unknown>[] = [];
  collecting = collected;
  try {
    fn();
  } finally {
    collecting = previous;
  }
  return collected;
}

/**
 * 提前发起请求（悬停、点击、history 变化时）；已有未使用的可用结果则不重复请求。
 * gate: false 只预取、不让页面切换等它（外部站点之类可能很慢、又不是页面主体的请求）。
 */
export function prefetchRouteQuery<T>(query: RouteQuery<T>, { gate = true }: { gate?: boolean } = {}) {
  let entry = cache.get(query.key);
  if (!entry || entry.consumedSeq !== undefined || !isUsable(entry)) entry = startEntry(query) as Entry;
  if (!gate) return;
  if (collecting) collecting.push(entry.promise);
  else if (navigationGate && !navigationGate.done && navigationPending) navigationGate.requests.push(entry.promise);
}

function acquireEntry<T>(query: RouteQuery<T>, force = false): Entry<T> {
  let entry = cache.get(query.key) as Entry<T> | undefined;
  if (force || !entry || !isUsable(entry)) entry = startEntry(query);
  if (entry.consumedSeq === undefined) {
    entry.consumedSeq = navigationSeq;
    entry.consumedAt = performance.now();
  }
  return entry;
}

/** 让 key 以 prefix 开头的预取结果作废（一般不需要：被页面取走的结果本来就不会再复用） */
export function invalidateRouteQueries(prefix: string) {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

// ---------------------------------------------------------------------------
// 页面使用的 hook
// ---------------------------------------------------------------------------

export interface RouteQueryResult<T> {
  /** 最近一次成功的数据；刷新期间保留旧值 */
  data: T | undefined;
  /** 最近一次请求的错误（成功后清空） */
  error: unknown;
  /** 正在请求（首次或刷新） */
  loading: boolean;
  /** 重新请求，忽略缓存；不会抛错，错误进 error */
  reload: () => Promise<void>;
  /** 本地改写数据（乐观更新、保存后回填） */
  setData: (next: T | ((current: T | undefined) => T)) => void;
}

type HookState<T> = {
  key: string | null;
  entry: Entry<T> | null;
  data: T | undefined;
  error: unknown;
  loading: boolean;
};

function initialState<T>(query: RouteQuery<T> | null, previous: T | undefined): HookState<T> {
  if (!query) {
    return { key: null, entry: null, data: previous, error: undefined, loading: false };
  }
  const entry = acquireEntry(query);
  return {
    key: query.key,
    entry,
    data: entry.status === "success" ? entry.data : previous,
    error: entry.status === "error" ? entry.error : undefined,
    loading: entry.status === "pending",
  };
}

/**
 * 读取页面数据。query 为 null 时不请求（例如参数还没准备好）。
 * query.key 变化时重新请求，期间保留旧数据（loading 为 true）。
 * 页面的首屏请求都要登记到 src/routeQueries：只有登记过的请求会被 RouteGate 等待，
 * 没登记的请求在页面挂载后才发出，直接显示骨架。
 */
export function useRouteQuery<T>(query: RouteQuery<T> | null): RouteQueryResult<T> {
  const [state, setState] = useState<HookState<T>>(() => initialState(query, undefined));

  let current = state;
  const key = query?.key ?? null;
  if (key !== state.key) {
    // 页面内的 key 变化（切 tab、换参数）：直接请求并显示骨架，不挂起
    current = initialState(query, state.data);
    setState(current);
  }

  const entry = current.entry;
  useEffect(() => {
    if (!entry) return;
    let alive = true;
    const apply = () => {
      if (!alive) return;
      setState((s) =>
        s.entry !== entry
          ? s
          : entry.status === "success"
            ? { ...s, data: entry.data, error: undefined, loading: false }
            : { ...s, error: entry.error, loading: false },
      );
    };
    if (entry.status !== "pending") apply();
    else entry.promise.then(apply, apply);
    return () => {
      alive = false;
    };
  }, [entry]);

  const fetchQuery = query?.fetch;
  const reload = useCallback(async () => {
    if (!key || !fetchQuery) return;
    const next = acquireEntry({ key, fetch: fetchQuery }, true);
    setState((s) => (s.key === key ? { ...s, entry: next, loading: true } : s));
    await next.promise.then(
      () => undefined,
      () => undefined,
    );
  }, [key, fetchQuery]);

  const setData = useCallback((next: T | ((value: T | undefined) => T)) => {
    setState((s) => ({
      ...s,
      data: typeof next === "function" ? (next as (value: T | undefined) => T)(s.data) : next,
    }));
  }, []);

  // state 里还是 loading、entry 却已经有结果（结果在两次渲染之间到达）：直接以 entry 为准，
  // 不会先画一帧骨架再等 effect 回填。
  if (entry && current.loading && entry.status !== "pending" && current.entry === entry) {
    return entry.status === "success"
      ? { data: entry.data, error: undefined, loading: false, reload, setData }
      : { data: current.data, error: entry.error, loading: false, reload, setData };
  }
  return { data: current.data, error: current.error, loading: current.loading, reload, setData };
}
