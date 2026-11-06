// 页面数据预取登记：主题 / 插件 / 市场（写法见 ./admin.ts 与 @/lib/routeData）
import { getRPC2Client } from "@/contexts/RPC2Context";
import { ApiError, api } from "@/lib/http";
import { prefetchRouteQuery, routeQuery, type RouteQuery } from "@/lib/routeData";
import { registerRouteData } from "@/lib/routeRegistry";
import { loadThemeManifest, type ThemeConfiguration } from "@/utils/themeConfiguration";
import { fetchInstalledThemes } from "@/pages/admin/themes/api";
import { fetchMarketCatalog, fetchMarketSources, marketRequest } from "@/pages/admin/market/shared/request";
import type { MarketKind, MarketSource, MarketSourceStatus } from "@/pages/admin/market/shared/types";
import type { InstalledTheme, MarketTheme } from "@/pages/admin/market/themes/types";
import type { MarketPlugin } from "@/pages/admin/market/plugins/types";
import type { PluginConfiguration, PluginInfo } from "@/types/plugin";

// ---------------------------------------------------------------------------
// 主题
// ---------------------------------------------------------------------------

/**
 * 当前启用的主题（/api/admin/settings 的 theme 字段）。
 * 错误文字与 useSettings 一致：HTTP 失败 "HTTP error! status: <status>"。
 */
export type CurrentThemeSettings = { theme?: string };

export async function fetchCurrentTheme(): Promise<CurrentThemeSettings> {
  try {
    return await requestCurrentTheme();
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    throw error;
  }
}

async function requestCurrentTheme(): Promise<CurrentThemeSettings> {
  let data: unknown;
  try {
    data = await api.get<unknown>("/api/admin/settings", { expectSuccess: false });
  } catch (error) {
    if (error instanceof ApiError) throw new Error(`HTTP error! status: ${error.status}`);
    throw error;
  }
  const payload =
    typeof data === "object" && data !== null ? (data as { data?: unknown }).data : undefined;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Invalid settings response payload");
  }
  const theme = (payload as { theme?: unknown }).theme;
  return { theme: typeof theme === "string" ? theme : undefined };
}

export const currentThemeQuery = routeQuery("appearance/current-theme", fetchCurrentTheme);

/** 主题管理：已安装主题列表（错误文字见 pages/admin/themes/api.ts） */
export const installedThemesQuery = routeQuery("appearance/themes", fetchInstalledThemes);

/** 主题清单 komari-theme.json：主题配置页（托管 / 原文）共用 */
export type ThemeManifest = { configuration?: ThemeConfiguration; [key: string]: unknown };

export const themeManifestQuery = (theme: string) =>
  routeQuery(`appearance/theme-manifest/${theme}`, () => loadThemeManifest<ThemeManifest>(theme));

/**
 * 最近一次已知的当前主题（页面从 PublicInfo 读到后记下）。
 * 预取器拿不到 Context：知道主题时预取它的清单，不知道就等页面挂载后再请求（不额外请求 /api/public）。
 */
let knownTheme: string | undefined;
export const rememberActiveTheme = (theme: string | undefined) => {
  knownTheme = theme || undefined;
};

registerRouteData("/admin/themes", () => {
  prefetchRouteQuery(currentThemeQuery);
  prefetchRouteQuery(installedThemesQuery);
});
registerRouteData("/admin/theme_managed", () => {
  if (knownTheme) prefetchRouteQuery(themeManifestQuery(knownTheme));
});
registerRouteData("/admin/theme_raw", () => {
  if (knownTheme) prefetchRouteQuery(themeManifestQuery(knownTheme));
});

// ---------------------------------------------------------------------------
// 插件（RPC，经 RPC2Provider 同一个单例）
// ---------------------------------------------------------------------------

const rpcCall = <TResult>(method: string, params?: unknown) =>
  getRPC2Client().call<unknown, TResult>(method, params);

/** 已安装插件列表；非数组结果当作空列表 */
export const fetchPluginList = async () => {
  const result = await rpcCall<PluginInfo[]>("admin:listPlugins");
  return Array.isArray(result) ? result : [];
};

export const pluginsQuery = routeQuery("appearance/plugins", fetchPluginList);

export interface PluginConfigurationResponse {
  configuration?: PluginConfiguration;
  data?: Record<string, any>;
}

/**
 * 某个插件的配置项与已保存的值。attempt 区分「同一插件再次点击」：
 * 页面每次点选都换一个 key，保证重新请求（不复用同一次导航里取过的旧值）。
 */
export const pluginConfigurationQuery = (short: string, attempt = 0) =>
  routeQuery(`appearance/plugin-config/${short}/${attempt}`, () =>
    rpcCall<PluginConfigurationResponse>("admin:getPluginConfiguration", { short }),
  );

registerRouteData("/admin/plugins", () => prefetchRouteQuery(pluginsQuery));
registerRouteData("/admin/plugins/config", (_params, search) => {
  prefetchRouteQuery(pluginsQuery);
  const short = search.get("short");
  if (short) prefetchRouteQuery(pluginConfigurationQuery(short));
});

// ---------------------------------------------------------------------------
// 市场
// ---------------------------------------------------------------------------

const marketSourceQueries = {} as Record<MarketKind, RouteQuery<MarketSource[]>>;

/** 市场源列表（每种市场一个固定的 query 对象，页面每次渲染拿到同一个引用） */
export const marketSourcesQuery = (kind: MarketKind) =>
  (marketSourceQueries[kind] ??= routeQuery(`appearance/market-sources/${kind}`, async () => {
    const payload = await fetchMarketSources<MarketSource[]>(kind);
    return payload.data || [];
  }));

export interface ThemeMarketData {
  themes: MarketTheme[];
  sources: MarketSourceStatus[];
  installed: Map<string, string>;
}

/** 主题市场：目录 + 已安装主题（任一失败整体失败，与原 Promise.all 一致） */
export async function fetchThemeMarket(force = false): Promise<ThemeMarketData> {
  const [catalogPayload, installedPayload] = await Promise.all([
    fetchMarketCatalog<{ themes: MarketTheme[]; sources: MarketSourceStatus[] }>("theme", force),
    marketRequest<InstalledTheme[]>("/api/admin/theme/list"),
  ]);
  return {
    themes: catalogPayload.data?.themes || [],
    sources: catalogPayload.data?.sources || [],
    installed: new Map((installedPayload.data || []).map((theme) => [theme.short, theme.version])),
  };
}

export const themeMarketQuery = routeQuery("appearance/market-themes", () => fetchThemeMarket());

export interface PluginMarketData {
  plugins: MarketPlugin[];
  sources: MarketSourceStatus[];
  currentVersion: string;
  installed: PluginInfo[];
}

/** 插件市场：目录 + 已安装插件（失败当作空）+ 面板版本（失败整体失败） */
export async function fetchPluginMarket(force = false): Promise<PluginMarketData> {
  const [catalogPayload, installedResult, versionInfo] = await Promise.all([
    fetchMarketCatalog<{ plugins: MarketPlugin[]; sources: MarketSourceStatus[] }>("plugin", force),
    rpcCall<PluginInfo[]>("admin:listPlugins").catch(() => []),
    rpcCall<{ version: string }>("common:getVersion"),
  ]);
  return {
    plugins: catalogPayload.data?.plugins || [],
    sources: catalogPayload.data?.sources || [],
    currentVersion: versionInfo.version,
    installed: Array.isArray(installedResult) ? installedResult : [],
  };
}

export const pluginMarketQuery = routeQuery("appearance/market-plugins", () => fetchPluginMarket());

registerRouteData("/admin/market/themes", () => {
  prefetchRouteQuery(themeMarketQuery);
  prefetchRouteQuery(marketSourcesQuery("theme"));
  prefetchRouteQuery(currentThemeQuery);
});
registerRouteData("/admin/market/plugins", () => {
  prefetchRouteQuery(pluginMarketQuery);
  prefetchRouteQuery(marketSourcesQuery("plugin"));
});
