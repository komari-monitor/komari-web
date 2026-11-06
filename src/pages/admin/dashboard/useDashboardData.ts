import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNodeList, type NodeBasicInfo } from "@/contexts/NodeListContext";
import { api } from "@/lib/http";
import { useRouteQuery, type RouteQueryResult } from "@/lib/routeData";
import {
  dashboardDbSizeQuery,
  dashboardLatestQuery,
  dashboardMetricsQuery,
  dashboardPingQuery,
} from "@/routeQueries/dashboard";
import type { PingMetricStat, PublicPingTask } from "@/types/metrics";
import {
  pingMetricStatKey,
  pingTaskId,
  pingTaskName,
} from "@/utils/metricSeries";
import {
  computeRenewalDate,
  computeTopAverageItems,
  computeTrafficSummary,
  weightedP95,
} from "./metrics";
import type { PingRankItem, TopRankItem } from "./types";
import {
  CPU_METRIC_KEYS,
  DAY_MS,
  EXPIRING_SOON_DAYS,
  MEM_METRIC_KEYS,
  miniChartCache,
} from "./utils";

const EMPTY_PING_STATS: PingMetricStat[] = [];
const EMPTY_PING_TASKS: PublicPingTask[] = [];

/** 第一次请求已经结束（成功或失败）：刷新期间保留旧结果，不会回到 false */
const settled = (result: Pick<RouteQueryResult<unknown>, "data" | "error">) =>
  result.data !== undefined || result.error !== undefined;

/** 请求失败只记日志（与原实现一致：widget 显示空态或保留旧数据，不弹提示） */
const useLogError = (error: unknown, message: string) => {
  useEffect(() => {
    if (error) console.error(message, error);
  }, [error, message]);
};

/** 仪表盘的数据层：各数据源的请求、首次加载标记、续费操作，以及由响应派生的统计与排行 */
export const useDashboardData = () => {
  const { t } = useTranslation();
  // 节点列表来自全局 NodeListProvider（应用启动时已在加载），进入页面时照旧刷新一次
  const { nodeList, isLoading, error, refresh } = useNodeList();

  // 各数据源独立请求、各自揭开骨架：切换页面时由 routePreload 并行预取，
  // 等待预算内到达的直接显示，没到的继续各自骨架（见 @/routeQueries/dashboard）
  const latestResult = useRouteQuery(dashboardLatestQuery);
  const metricsResult = useRouteQuery(dashboardMetricsQuery);
  const dbResult = useRouteQuery(dashboardDbSizeQuery);
  const pingResult = useRouteQuery(dashboardPingQuery);
  useLogError(latestResult.error, "Failed to fetch latest status:");
  useLogError(metricsResult.error, "Failed to fetch dashboard metrics:");
  useLogError(dbResult.error, "Failed to fetch database size:");
  useLogError(pingResult.error, "Failed to fetch ping stats:");

  // 失败时保留上一次成功的数据（与原来 catch 里不改 state 一致）
  const latest = latestResult.data ?? null;
  const metricsRes = metricsResult.data ?? null;
  const dbInfo = dbResult.data ?? null;
  const pingStats = pingResult.data?.stats ?? EMPTY_PING_STATS;
  const pingTasks = pingResult.data?.tasks ?? EMPTY_PING_TASKS;
  const [renewingUuid, setRenewingUuid] = useState<string | null>(null);
  const [renewedUuids, setRenewedUuids] = useState<Set<string>>(new Set());
  // 每个数据源「第一次请求结束」的标记：没结束前对应 widget 用骨架渲染真实结构。
  // 手动刷新不再回到骨架（保留旧数据原地更新），失败也算结束（显示空态而不是永远骨架）。
  const loaded = {
    latest: settled(latestResult),
    metrics: settled(metricsResult),
    db: settled(dbResult),
    ping: settled(pingResult),
  };
  const refreshing =
    latestResult.loading || metricsResult.loading || dbResult.loading || pingResult.loading;

  const onlineSet = useMemo(() => {
    const out = new Set<string>();
    if (latest) {
      for (const [uuid, value] of Object.entries(latest)) {
        if ((value as any)?.online) out.add(uuid);
      }
    }
    return out;
  }, [latest]);

  const stats = useMemo(() => {
    const nodes = nodeList ?? [];
    const online = onlineSet.size;
    const total = nodes.length;
    return {
      total,
      online,
      offline: total - online,
      onlineRate: total ? (online / total) * 100 : 0,
    };
  }, [nodeList, onlineSet]);

  const offlineNodes = useMemo(
    () => (nodeList ?? []).filter((node) => !onlineSet.has(node.uuid)),
    [nodeList, onlineSet],
  );

  const nodeNameMap = useMemo(
    () => new Map((nodeList ?? []).map((node) => [node.uuid, node.name])),
    [nodeList],
  );

  const memTotalMap = useMemo(
    () => new Map((nodeList ?? []).map((node) => [node.uuid, node.mem_total])),
    [nodeList],
  );

  const expiringNodes = useMemo(() => {
    const now = Date.now();
    const deadline = now + EXPIRING_SOON_DAYS * DAY_MS;
    return (nodeList ?? [])
      .filter((node) => {
        if (!node.expired_at) return false;
        if (renewedUuids.has(node.uuid)) return false;
        const ts = new Date(node.expired_at).getTime();
        return ts >= now && ts <= deadline;
      })
      .sort(
        (a, b) =>
          new Date(a.expired_at).getTime() - new Date(b.expired_at).getTime(),
      );
  }, [nodeList, renewedUuids]);

  const reloadLatest = latestResult.reload;
  const reloadMetrics = metricsResult.reload;
  const reloadDbSize = dbResult.reload;
  const reloadPing = pingResult.reload;

  // 刷新按钮：页面内刷新，不挂起；首屏骨架已揭开的 widget 保留旧数据原地更新
  const fetchAll = useCallback(async () => {
    miniChartCache.clear();
    refresh();
    await Promise.allSettled([
      reloadLatest(),
      reloadMetrics(),
      reloadDbSize(),
      reloadPing(),
    ]);
  }, [refresh, reloadLatest, reloadMetrics, reloadDbSize, reloadPing]);

  // 进入页面：清空迷你图缓存并刷新节点列表；四个数据源由 useRouteQuery 自己请求（或接住预取）
  useEffect(() => {
    miniChartCache.clear();
    refresh();
  }, [refresh]);

  // 由一次 queryMetrics 响应派生各指标卡数据；nodeList 就绪后
  // nodeNameMap/memTotalMap 变化会自动重算，无需再次请求。
  const traffic = useMemo(() => computeTrafficSummary(metricsRes), [metricsRes]);

  const topCpu = useMemo<TopRankItem[]>(
    () =>
      computeTopAverageItems(
        metricsRes,
        CPU_METRIC_KEYS[0],
        nodeNameMap,
        (_uuid, value) => value,
      ),
    [metricsRes, nodeNameMap],
  );

  const topMem = useMemo<TopRankItem[]>(
    () =>
      computeTopAverageItems(
        metricsRes,
        MEM_METRIC_KEYS[0],
        nodeNameMap,
        (uuid, value) => {
          const totalBytes = memTotalMap.get(uuid) ?? 0;
          return totalBytes > 0 ? (value / totalBytes) * 100 : 0;
        },
      ),
    [metricsRes, nodeNameMap, memTotalMap],
  );

  const handleRenew = async (node: NodeBasicInfo) => {
    const expiry = computeRenewalDate(
      new Date(node.expired_at),
      node.billing_cycle,
    );
    if (!expiry) {
      toast.error(t("dashboard.renewNotSupported", "No billing cycle"));
      return;
    }
    setRenewingUuid(node.uuid);
    try {
      // 原实现只看 res.ok，不检查响应体 status
      await api.post(
        `/api/admin/client/${node.uuid}/edit`,
        { uuid: node.uuid, expired_at: expiry.toISOString() },
        { expectSuccess: false },
      );
      toast.success(
        t("dashboard.renewSuccess", "Renewed. New expiry: {{date}}", {
          date: expiry.toLocaleDateString(),
        }),
      );
      setRenewedUuids((prev) => new Set(prev).add(node.uuid));
    } catch {
      toast.error(t("dashboard.renewFailed", "Renewal failed"));
    } finally {
      setRenewingUuid(null);
    }
  };

  const health = useMemo(() => {
    if (stats.total === 0) {
      return { level: "empty" as const, color: "gray" as const };
    }
    if (stats.onlineRate >= 95) {
      return { level: "healthy" as const, color: "green" as const };
    }
    if (stats.onlineRate >= 75) {
      return { level: "warning" as const, color: "orange" as const };
    }
    return { level: "danger" as const, color: "red" as const };
  }, [stats.total, stats.onlineRate]);

  const pingP95Map = useMemo(() => {
    const map = new Map<string, number>();
    for (const series of metricsRes?.series ?? []) {
      const taskId = pingTaskId(series.tags);
      if (!taskId) continue;
      const p95 = weightedP95(
        (series.points ?? []).map((point) => ({
          value: point.value ?? NaN,
          count: point.count,
        })),
      );
      if (p95 != null) {
        map.set(pingMetricStatKey(series.entity_id, taskId), p95);
      }
    }
    return map;
  }, [metricsRes]);

  const pingRankItems = useMemo(() => {
    const taskMap = new Map(
      pingTasks.map((task) => [String(task.id), task]),
    );
    return pingStats.map((stat) => {
      const taskName = pingTaskName(
        stat.task_id,
        taskMap,
        (id) => `${t("ping.task", "Ping task")} ${id}`,
      );
      const nodeName =
        nodeNameMap.get(stat.entity_id) ?? stat.entity_id.slice(0, 8);
      const p95 =
        pingP95Map.get(pingMetricStatKey(stat.entity_id, stat.task_id)) ?? null;
      return {
        key: pingMetricStatKey(stat.entity_id, stat.task_id),
        entityId: stat.entity_id,
        taskId: stat.task_id,
        label: `${nodeName} · ${taskName}`,
        p95,
        volatility: stat.p99_p50_ratio ?? 0,
        loss: stat.loss ?? 0,
        valid: stat.valid,
      } satisfies PingRankItem;
    });
  }, [pingStats, pingP95Map, pingTasks, nodeNameMap, t]);

  // 无有效延迟样本(如 100% 丢包)的节点波动无意义，不参与稳定性排名
  const stableLatencyItems = useMemo(
    () =>
      [...pingRankItems]
        .filter((item) => item.valid > 0)
        .sort((a, b) => a.volatility - b.volatility),
    [pingRankItems],
  );

  const unstableLatencyItems = useMemo(
    () =>
      [...pingRankItems]
        .filter((item) => item.valid > 0)
        .sort((a, b) => b.volatility - a.volatility),
    [pingRankItems],
  );

  const highestLossItems = useMemo(
    () => [...pingRankItems].sort((a, b) => b.loss - a.loss),
    [pingRankItems],
  );

  return {
    nodeList,
    isLoading,
    error,
    latest,
    loaded,
    refreshing,
    fetchAll,
    dbInfo,
    traffic,
    topCpu,
    topMem,
    nodeNameMap,
    stats,
    health,
    offlineNodes,
    expiringNodes,
    renewingUuid,
    handleRenew,
    stableLatencyItems,
    unstableLatencyItems,
    highestLossItems,
  };
};
