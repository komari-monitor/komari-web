// 页面数据预取登记：服务器 / 延迟监测 / 通知 / 日志（写法见 ./admin.ts 与 @/lib/routeData）
import { ApiError, api } from "@/lib/http";
import { prefetchRouteQuery, routeQuery } from "@/lib/routeData";
import { registerRouteData } from "@/lib/routeRegistry";
import { getRPC2Client } from "@/contexts/RPC2Context";
import type { SettingsResponse } from "@/lib/api";
import type { NodeDetail } from "@/contexts/NodeDetailsContext";
import type { PingTask } from "@/contexts/PingTaskContext";
import type { OfflineNotification } from "@/contexts/NotificationContext";
import type { ThemeConfiguration } from "@/utils/themeConfiguration";

// ---------------------------------------------------------------------------
// 节点列表（NodeDetailsProvider）：/admin/servers、/admin/exec、/admin/ping、/admin/notification/offline
// ---------------------------------------------------------------------------

/** 节点列表：HTTP 错误或响应体 status 不是 success 都算失败（与原实现一致） */
export const nodeDetailsQuery = routeQuery("ops/clients", () =>
  api.get<NodeDetail[]>("/api/admin/client/list"),
);

// ---------------------------------------------------------------------------
// 系统设置（原 useSettings 的同一请求；通知页、服务器页用）
// ---------------------------------------------------------------------------

/** 设置未到时的默认值（与 useSettings 的初始值相同） */
export const DEFAULT_SETTINGS: SettingsResponse = {
  sitename: "",
  description: "",
  cors_origin_check_enabled: true,
  geo_ip_enabled: false,
  geo_ip_provider: "",
  o_auth_provider: "",
  o_auth_enabled: false,
  ssrf_protection_enabled: false,
  custom_head: "",
  CreatedAt: "",
  UpdatedAt: "",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 与 @/lib/api 的 getSettings 相同：去掉数据库元数据字段，失败时打印并抛出 */
export const settingsQuery = routeQuery("ops/settings", async (): Promise<SettingsResponse> => {
  try {
    let data: unknown;
    try {
      data = await api.get<unknown>("/api/admin/settings", { expectSuccess: false });
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`HTTP error! status: ${error.status}`);
      }
      throw error;
    }
    const payload = isRecord(data) ? data["data"] : undefined;
    if (!isRecord(payload)) {
      throw new Error("Invalid settings response payload");
    }
    return Object.fromEntries(
      Object.entries(payload).filter(([key]) => !["CreatedAt", "UpdatedAt", "id"].includes(key)),
    ) as SettingsResponse;
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    throw error;
  }
});

/** 设置请求的错误文字（与 useSettings 的 error 相同） */
export const settingsErrorText = (error: unknown) =>
  error ? (error instanceof Error ? error.message : "Failed to fetch settings") : null;

// ---------------------------------------------------------------------------
// 服务器列表 /admin/servers
// ---------------------------------------------------------------------------

/** 后端版本（判断是否 snapshot 后端） */
export const backendVersionQuery = routeQuery("ops/backend-version", () =>
  getRPC2Client().call<unknown, { version?: string }>("common:getVersion"),
);

registerRouteData("/admin/servers", () => {
  prefetchRouteQuery(nodeDetailsQuery);
  prefetchRouteQuery(settingsQuery);
  prefetchRouteQuery(backendVersionQuery);
});
// exec 页面本身由别的分组负责，这里只登记它的 NodeDetailsProvider 用到的节点列表
registerRouteData("/admin/exec", () => prefetchRouteQuery(nodeDetailsQuery));

// ---------------------------------------------------------------------------
// 延迟监测 /admin/ping（PingTaskProvider + NodeDetailsProvider）
// ---------------------------------------------------------------------------

/** ping 任务：只看 HTTP 状态；HTTP 失败统一成固定文案 */
export const pingTasksQuery = routeQuery("ops/ping-tasks", async (): Promise<PingTask[]> => {
  const resp = await api
    .get<{ data?: PingTask[] }>("/api/admin/ping", { expectSuccess: false })
    .catch((error) => {
      throw error instanceof ApiError ? new Error("Failed to fetch ping tasks") : error;
    });
  return resp && Array.isArray(resp.data) ? resp.data : [];
});

registerRouteData("/admin/ping", () => {
  prefetchRouteQuery(pingTasksQuery);
  prefetchRouteQuery(nodeDetailsQuery);
});

// ---------------------------------------------------------------------------
// 通知 /admin/notification/*
// ---------------------------------------------------------------------------

/** 离线通知配置（OfflineNotificationProvider）：只看 HTTP 状态 */
export const offlineNotificationsQuery = routeQuery(
  "ops/notification-offline",
  async (): Promise<OfflineNotification[]> => {
    const data = await api
      .get<{ data?: OfflineNotification[] }>("/api/admin/notification/offline", { expectSuccess: false })
      .catch((error) => {
        throw error instanceof ApiError ? new Error("Failed to fetch offline notifications") : error;
      });
    return data?.data || [];
  },
);

registerRouteData("/admin/notification/offline", () => {
  prefetchRouteQuery(offlineNotificationsQuery);
  prefetchRouteQuery(nodeDetailsQuery);
});

export type NotificationChannel = {
  id: string;
  configuration?: ThemeConfiguration;
};

/** 已注册的通知渠道 */
export const notificationChannelsQuery = routeQuery("ops/notification-channels", async () => {
  const data = await getRPC2Client().call<unknown, NotificationChannel[]>("admin:listNotificationChannels");
  return Array.isArray(data) ? data : [];
});

registerRouteData("/admin/notification/channels", () => {
  prefetchRouteQuery(settingsQuery);
  prefetchRouteQuery(notificationChannelsQuery);
});
registerRouteData("/admin/notification/general", () => prefetchRouteQuery(settingsQuery));

// ---------------------------------------------------------------------------
// 日志 /admin/logs
// ---------------------------------------------------------------------------

export type LogEntry = {
  id: number;
  ip: string;
  uuid: string;
  message: string;
  msg_type: string;
  time: string;
};

/** 日志分页：只看 HTTP 状态；HTTP 失败统一成固定文案 */
export const logsQuery = (limit: number, page: number) =>
  routeQuery(`ops/logs/${limit}/${page}`, async () => {
    const data = await api
      .get<{ data: { logs: LogEntry[]; total: number } }>(`/api/admin/logs?limit=${limit}&page=${page}`, {
        expectSuccess: false,
      })
      .catch((error) => {
        throw error instanceof ApiError ? new Error("Failed to fetch logs") : error;
      });
    return { logs: data.data.logs, total: data.data.total };
  });

/** 日志页首屏：默认每页 10 条、第 1 页 */
export const LOGS_DEFAULT_LIMIT = 10;

registerRouteData("/admin/logs", () => prefetchRouteQuery(logsQuery(LOGS_DEFAULT_LIMIT, 1)));
