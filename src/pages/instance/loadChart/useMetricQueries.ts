import { useEffect, useMemo, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import type {
  MetricSeries,
  PingMetricStat,
  PingMetricStatsResponse,
  QueryMetricsResponse,
} from "@/types/metrics";
import {
  isPingMetric,
  normalizeMetricSeriesList,
  toPingMetricStatMap,
} from "@/utils/metricSeries";
import { hasRealtimeSource } from "./catalog";
import { HISTORY_MAX_POINTS } from "./constants";
import type { Aggregation, DashboardChart, MetricRangeParams } from "./types";

/**
 * 历史指标查询（public:queryMetrics）与延迟统计（public:getPingMetricStats）。
 * 实时模式下能从 recent 记录取值的指标不查历史。
 */
export function useMetricQueries({
  uuid,
  charts,
  isRealtime,
  metricRangeParams,
  aggregation,
}: {
  uuid: string | undefined;
  charts: DashboardChart[];
  isRealtime: boolean;
  metricRangeParams: MetricRangeParams;
  aggregation: Aggregation;
}) {
  const { call } = useRPC2Call();
  const [pingStats, setPingStats] = useState<PingMetricStat[]>([]);
  const [metricSeries, setMetricSeries] = useState<MetricSeries[]>([]);
  /*
    加载态由「当前请求」与「已到达的请求」比对派生，而不是在 effect 里 setLoading(true)：
    切换服务器/时间范围的第一帧就已处于加载态，不会先渲染一帧旧状态的空图。
    旧数据在新数据到达前保留，由卡片的骨架态淡出（见 Skeletonize）。
  */
  const [loadedMetricRequest, setLoadedMetricRequest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const metricKeys = useMemo(() => {
    const keys = charts.flatMap((chart) =>
      chart.metrics.filter((metricKey) => {
        if (!isRealtime) return true;
        return !hasRealtimeSource(metricKey);
      }),
    );
    return Array.from(new Set(keys)).sort();
  }, [charts, isRealtime]);

  const metricRequestKey = JSON.stringify([uuid, metricKeys, metricRangeParams, aggregation]);
  const metricsLoading =
    !!uuid && metricKeys.length > 0 && loadedMetricRequest !== metricRequestKey;

  useEffect(() => {
    if (!uuid || metricKeys.length === 0) {
      setMetricSeries([]);
      setError(null);
      return;
    }

    let active = true;
    setError(null);

    call<any, QueryMetricsResponse>(
      "public:queryMetrics",
      {
        metric_keys: metricKeys,
        entity_id: uuid,
        ...metricRangeParams,
        max_points: HISTORY_MAX_POINTS,
        aggregation,
        fill_empty: true,
      },
      { timeout: 30000 },
    )
      .then((result) => {
        if (!active) return;
        setMetricSeries(normalizeMetricSeriesList(result?.series));
        setLoadedMetricRequest(metricRequestKey);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Error");
        setLoadedMetricRequest(metricRequestKey);
      });

    return () => {
      active = false;
    };
  }, [
    aggregation,
    call,
    metricKeys,
    metricRangeParams,
    metricRequestKey,
    uuid,
  ]);

  useEffect(() => {
    if (!uuid || !metricKeys.some(isPingMetric)) {
      setPingStats([]);
      return;
    }

    let active = true;
    call<any, PingMetricStatsResponse>(
      "public:getPingMetricStats",
      {
        entity_id: uuid,
        ...metricRangeParams,
        max_points: HISTORY_MAX_POINTS,
      },
      { timeout: 30000 },
    )
      .then((result) => {
        if (!active) return;
        setPingStats(Array.isArray(result?.stats) ? result.stats : []);
      })
      .catch(() => {
        if (active) setPingStats([]);
      });

    return () => {
      active = false;
    };
  }, [
    call,
    metricKeys,
    metricRangeParams,
    uuid,
  ]);

  const pingStatsMap = useMemo(() => toPingMetricStatMap(pingStats), [pingStats]);

  return { metricSeries, metricKeys, metricsLoading, error, pingStatsMap };
}
