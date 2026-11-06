// 页面数据预取登记：系统设置 /admin/settings/* 与账户 /admin/account（写法见 ./admin.ts 与 @/lib/routeData）
import type { SettingsResponse } from "@/lib/api";
import { ApiError, api } from "@/lib/http";
import { DEFAULT_SETTINGS, settingsErrorText, settingsQuery } from "@/routeQueries/ops";
import { invalidateRouteQueries, prefetchRouteQuery, routeQuery } from "@/lib/routeData";
import { registerRouteData } from "@/lib/routeRegistry";
import { getRPC2Client } from "@/contexts/RPC2Context";
import type { MetricDefinition, MigrationStatusResponse } from "@/pages/admin/settings/metrics/types";

// ---------------------------------------------------------------------------
// 设置：/admin/settings/{site,custom,general,sign-on,metrics} 共用 ops 分组的 settingsQuery
// （同一个 /api/admin/settings 请求，服务器页、通知页也用它）
// ---------------------------------------------------------------------------

export { DEFAULT_SETTINGS, settingsErrorText, settingsQuery };

/**
 * 保存设置之后调用：让还没被取走的预取结果作废。
 * 被页面取走的结果本来就不会复用；这里处理的是「保存前悬停过别的设置页」留下的旧预取，
 * 否则 10 秒内切过去会读到保存前的值。
 */
export const invalidateSettingsQueries = () => {
  invalidateRouteQueries(settingsQuery.key);
  invalidateRouteQueries("admin/settings");
};

for (const path of ["site", "custom", "general"]) {
  registerRouteData(`/admin/settings/${path}`, () => prefetchRouteQuery(settingsQuery));
}

// ---------------------------------------------------------------------------
// 登录方式：设置 + provider 列表并行；当前 provider 的字段值依赖两者
// ---------------------------------------------------------------------------

/** provider -> 字段定义；接口没有 data 时为 null（页面显示「获取失败」） */
export type OidcProviderDefs = Record<string, unknown[]>;

let latestOidcProviders: Promise<OidcProviderDefs | null> | null = null;

export const oidcProvidersQuery = routeQuery("admin/settings/oidc", () => {
  latestOidcProviders = api
    .getData<OidcProviderDefs>("/api/admin/settings/oidc")
    .then((data) => data || null);
  return latestOidcProviders;
});

/** 当前 provider 的字段值（addition 解析失败按空对象）；接口没有 data 时为 null */
export const oidcProviderValuesQuery = (provider: string) =>
  routeQuery(`admin/settings/oidc/${provider}`, () =>
    api
      .getData<{ addition?: string }>(`/api/admin/settings/oidc?provider=${provider}`)
      .then((data): Record<string, unknown> | null => {
        if (!data) return null;
        try {
          return JSON.parse(data.addition || "{}");
        } catch {
          return {};
        }
      }),
  );

/** 设置里的 provider 在列表中才算当前 provider（与原来的初始化规则一致） */
export const initialOidcProvider = (settings: SettingsResponse, defs: OidcProviderDefs) =>
  settings.o_auth_provider && Object.keys(defs).includes(settings.o_auth_provider)
    ? settings.o_auth_provider
    : "";

/**
 * 与 settingsQuery 同 key（同一条缓存），只是顺带记下这次发出的请求：
 * 登录方式页的 provider 字段值要等设置和 provider 列表都到了才知道请求哪个。
 */
let capturedSettings: Promise<SettingsResponse> | null = null;
const settingsQueryCapture = routeQuery(settingsQuery.key, () => {
  capturedSettings = settingsQuery.fetch();
  return capturedSettings;
});

registerRouteData("/admin/settings/sign-on", () => {
  capturedSettings = null;
  latestOidcProviders = null;
  prefetchRouteQuery(settingsQueryCapture);
  prefetchRouteQuery(oidcProvidersQuery);
  const settings = capturedSettings;
  const defs = latestOidcProviders;
  // 只在这次真的发出了两个请求时串上字段值预取；复用已有预取（例如悬停后再点击）时，
  // 悬停那次已经串过了；串不上的情况页面会在数据到达后自己请求（不会重复）
  if (!settings || !defs) return;
  // 两个请求都到了才知道当前 provider；页面已经自己发起时 prefetch 会复用它
  Promise.all([settings, defs]).then(
    ([s, d]) => {
      const provider = d ? initialOidcProvider(s, d) : "";
      if (provider) prefetchRouteQuery(oidcProviderValuesQuery(provider));
    },
    () => undefined,
  );
});

// ---------------------------------------------------------------------------
// 监控指标：设置 + 指标定义 + 迁移状态（RPC）
// ---------------------------------------------------------------------------

export const metricDefinitionsQuery = routeQuery("admin/settings/metrics/definitions", () =>
  getRPC2Client()
    .call<unknown, MetricDefinition[]>("admin:listMetricDefinitions", {})
    .then((data) => (Array.isArray(data) ? data : [])),
);

export const metricMigrationStatusQuery = routeQuery("admin/settings/metrics/migration", () =>
  getRPC2Client().call<unknown, MigrationStatusResponse>("admin:getMetricMigrationStatus", {}),
);

registerRouteData("/admin/settings/metrics", () => {
  prefetchRouteQuery(settingsQuery);
  prefetchRouteQuery(metricDefinitionsQuery);
  prefetchRouteQuery(metricMigrationStatusQuery);
});

// ---------------------------------------------------------------------------
// 账户
// ---------------------------------------------------------------------------

export type AccountInfo = {
  logged_in: boolean;
  sso_id: string;
  sso_type: string;
  username: string;
  uuid: string;
  "2fa_enabled": boolean;
};

/** 与 AccountContext 的请求一致：HTTP 错误统一成同一句文案 */
export const accountQuery = routeQuery("admin/account/me", () =>
  api.get<AccountInfo>("/api/me").catch((error: unknown) => {
    throw error instanceof ApiError ? new Error("Failed to fetch account data") : error;
  }),
);

registerRouteData("/admin/account", () => prefetchRouteQuery(accountQuery));
// ---------------------------------------------------------------------------
// 指标页的数据库维护卡（DatabaseMaintenanceCard）：/api/admin/database/size 原始响应。
// 校验与错误文案留在组件里；这里不抛错，返回 ok 标记和响应体。
// ---------------------------------------------------------------------------

export type DatabaseOverviewRaw =
  | { ok: true; payload: unknown }
  | { ok: false; payload: unknown };

export const databaseOverviewQuery = routeQuery(
  "admin/settings/database-size",
  async (): Promise<DatabaseOverviewRaw> => {
    try {
      return { ok: true, payload: await api.get<unknown>("/api/admin/database/size") };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return { ok: false, payload: error.body };
    }
  },
);

registerRouteData("/admin/settings/metrics", () => prefetchRouteQuery(databaseOverviewQuery));
