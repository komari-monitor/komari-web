// 页面数据预取登记：仪表盘 /admin/dashboard（写法见 ./admin.ts 与 @/lib/routeData）
import { getRPC2Client } from "@/contexts/RPC2Context";
import { api, ApiError } from "@/lib/http";
import { prefetchRouteQuery, routeQuery } from "@/lib/routeData";
import { registerRouteData } from "@/lib/routeRegistry";
import type {
  PingMetricStat,
  PingMetricStatsResponse,
  PublicPingTask,
  QueryMetricsResponse,
} from "@/types/metrics";
import { PING_LATENCY_METRIC } from "@/utils/metricSeries";
import { readCurrentThemeSettings } from "@/utils/saveThemeSettings";

// 指标键放在这里（页面的 dashboard/utils.ts 转导出），预取不必引入页面的动画/格式化代码
export const CPU_METRIC_KEYS = ["cpu.usage"];
export const MEM_METRIC_KEYS = ["memory.used"];
export const NET_METRIC_KEYS = ["net.in.rate", "net.out.rate"];
export const NET_TOTAL_METRIC_KEYS = ["net.total.up", "net.total.down"];

/** 各节点最新状态；成功但没有结果时为 null（与原来的 setLatest(result ?? null) 一致） */
export const dashboardLatestQuery = routeQuery(
  "admin/dashboard/latest",
  async () =>
    (await getRPC2Client().call<unknown, Record<string, any>>("common:getNodesLatestStatus")) ?? null,
);

/** 首页所有指标卡共用的 24h 查询（流量/CPU/内存/延迟）；时间窗按发请求的时刻计算 */
export const dashboardMetricsQuery = routeQuery("admin/dashboard/metrics", async () => {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 3600 * 1000);
  const res = await getRPC2Client().call<any, QueryMetricsResponse>("public:queryMetrics", {
    metric_keys: [
      ...NET_METRIC_KEYS,
      ...NET_TOTAL_METRIC_KEYS,
      "traffic.up",
      "traffic.down",
      ...CPU_METRIC_KEYS,
      ...MEM_METRIC_KEYS,
      PING_LATENCY_METRIC,
    ],
    start: start.toISOString(),
    end: now.toISOString(),
    aggregation: "p95",
    aggregation_by_metric: {
      "traffic.up": "sum",
      "traffic.down": "sum",
      "net.total.up": "last",
      "net.total.down": "last",
      "cpu.usage": "avg",
      "memory.used": "avg",
    },
    fill_empty: true,
  });
  return res ?? null;
});

export type DashboardDbSize = { main: number | null; monitoring: number | null };

/**
 * 数据库大小：与原实现一致，不看 HTTP 状态和 status 字段，响应体是 JSON 就按 data 解析；
 * 响应体不是 JSON 时算失败（页面保留旧数据）。
 */
export const dashboardDbSizeQuery = routeQuery(
  "admin/dashboard/db",
  async (): Promise<DashboardDbSize> => {
    const data = await api
      .get<any>("/api/admin/database/size", { expectSuccess: false })
      .catch((e: unknown) => {
        if (e instanceof ApiError) return e.body as any;
        throw e;
      });
    if (data == null) throw new Error("Invalid database size response");
    const payload = data?.data;
    return {
      main: payload?.main?.size ?? null,
      monitoring: payload?.monitoring?.size ?? null,
    };
  },
);

/** 延迟统计 + 公开任务名（任务名失败按空列表处理，只有统计失败才算失败） */
export const dashboardPingQuery = routeQuery("admin/dashboard/ping", async () => {
  const client = getRPC2Client();
  const [statsRes, tasksRes] = await Promise.all([
    client.call<unknown, PingMetricStatsResponse>("public:getPingMetricStats", { hours: 24 }),
    client.call<unknown, PublicPingTask[]>("public:getPublicPingTasks").catch(() => []),
  ]);
  return {
    stats: (Array.isArray(statsRes?.stats) ? statsRes.stats : []) as PingMetricStat[],
    tasks: (Array.isArray(tasksRes) ? tasksRes : []) as PublicPingTask[],
  };
});

/** 仪表盘布局所在的主题设置（DashboardBoard 读取布局用） */
export const dashboardThemeQuery = routeQuery("admin/dashboard/theme", readCurrentThemeSettings);

registerRouteData("/admin/dashboard", () => {
  prefetchRouteQuery(dashboardLatestQuery);
  prefetchRouteQuery(dashboardMetricsQuery);
  prefetchRouteQuery(dashboardDbSizeQuery);
  prefetchRouteQuery(dashboardPingQuery);
  prefetchRouteQuery(dashboardThemeQuery);
});
