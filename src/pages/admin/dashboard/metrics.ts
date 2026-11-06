import type { QueryMetricsResponse } from "@/types/metrics";
import type { TopRankItem, TrafficNodeTotals, TrafficSummary } from "./types";
import { DAY_MS, NET_TOTAL_METRIC_KEYS } from "./utils";

export const weightedP95 = (
  points: { value: number; count?: number }[],
): number | null => {
  const valid = points.filter(
    (point) =>
      Number.isFinite(point.value) &&
      point.value >= 0 &&
      (point.count ?? 1) > 0,
  );
  if (valid.length === 0) return null;
  const total = valid.reduce((sum, point) => sum + (point.count ?? 1), 0);
  const sorted = [...valid].sort((a, b) => a.value - b.value);
  let cumulative = 0;
  for (const point of sorted) {
    cumulative += point.count ?? 1;
    if (cumulative >= total * 0.95) return point.value;
  }
  return sorted[sorted.length - 1].value;
};

export const weightedAverage = (
  points: { value: number; count?: number }[],
): number | null => {
  const valid = points.filter(
    (point) => Number.isFinite(point.value) && (point.count ?? 1) > 0,
  );
  if (valid.length === 0) return null;
  const totalCount = valid.reduce(
    (sum, point) => sum + (point.count ?? 1),
    0,
  );
  return (
    valid.reduce(
      (sum, point) => sum + point.value * (point.count ?? 1),
      0,
    ) / totalCount
  );
};

// 与后端 utils/renewal 保持一致：
// 27-32 按自然月 +1 月，87-95 +3 月，175-185 +6 月，
// 360-370 +1 年，720-750 +2 年，1080-1150 +3 年，1800-1850 +5 年，其余 +天数。
export const computeRenewalDate = (
  expiredAt: Date,
  billingCycle: number,
): Date | null => {
  if (!billingCycle || billingCycle <= 0) return null;
  const now = new Date();
  let base = new Date(expiredAt);
  if (expiredAt.getTime() < now.getTime() - 30 * DAY_MS) {
    base = now;
  }
  const result = new Date(base);
  if (billingCycle >= 27 && billingCycle <= 32) {
    result.setMonth(result.getMonth() + 1);
  } else if (billingCycle >= 87 && billingCycle <= 95) {
    result.setMonth(result.getMonth() + 3);
  } else if (billingCycle >= 175 && billingCycle <= 185) {
    result.setMonth(result.getMonth() + 6);
  } else if (billingCycle >= 360 && billingCycle <= 370) {
    result.setFullYear(result.getFullYear() + 1);
  } else if (billingCycle >= 720 && billingCycle <= 750) {
    result.setFullYear(result.getFullYear() + 2);
  } else if (billingCycle >= 1080 && billingCycle <= 1150) {
    result.setFullYear(result.getFullYear() + 3);
  } else if (billingCycle >= 1800 && billingCycle <= 1850) {
    result.setFullYear(result.getFullYear() + 5);
  } else {
    result.setDate(result.getDate() + billingCycle);
  }
  return result;
};

// 首页所有指标卡共用一个 24h 查询（流量/CPU/内存/延迟），
// 这里从响应中分别派生流量汇总与 TOP p95 排行。
export const computeTrafficSummary = (
  res: QueryMetricsResponse | null,
): TrafficSummary | null => {
  if (!res) return null;

  // The first cumulative counter after a collection gap/reset is a baseline,
  // not traffic observed during that chart bucket.
  const discontinuities = new Set<string>();
  for (const series of res.series ?? []) {
    if (!NET_TOTAL_METRIC_KEYS.includes(series.metric_key)) continue;
    const direction = series.metric_key === "net.total.up" ? "up" : "down";
    let previousValue: number | null = null;
    let gapAfterValue = false;
    let reboundBaseline: number | null = null;
    for (const point of series.points ?? []) {
      if (point.value == null) {
        if (previousValue !== null) gapAfterValue = true;
        continue;
      }
      const ts = new Date(point.time).getTime();
      let discontinuity = gapAfterValue;
      if (previousValue !== null && point.value < previousValue) {
        discontinuity = true;
        reboundBaseline = previousValue;
      } else if (reboundBaseline !== null) {
        if (point.value >= reboundBaseline) discontinuity = true;
        reboundBaseline = null;
      }
      if (discontinuity) {
        discontinuities.add(`${series.entity_id}\0${direction}\0${ts}`);
      }
      previousValue = point.value;
      gapAfterValue = false;
    }
  }

  const byTime = new Map<
    number,
    { upRate: number; downRate: number; upDelta: number; downDelta: number }
  >();
  const byEntity = new Map<string, { up: number; down: number }>();
  const byEntityRate = new Map<
    string,
    Map<number, { up: number; down: number }>
  >();
  for (const series of res.series ?? []) {
    const isRate =
      series.metric_key === "net.in.rate" ||
      series.metric_key === "net.out.rate";
    const isUp =
      series.metric_key === "net.out.rate" ||
      series.metric_key === "traffic.up";
    if (
      !isRate &&
      series.metric_key !== "traffic.up" &&
      series.metric_key !== "traffic.down"
    ) {
      continue;
    }
    const entity = series.entity_id;
    for (const point of series.points ?? []) {
      if (point.value == null) continue;
      const ts = new Date(point.time).getTime();
      const entry =
        byTime.get(ts) ?? { upRate: 0, downRate: 0, upDelta: 0, downDelta: 0 };
      if (isRate) {
        if (isUp) entry.upRate += point.value;
        else entry.downRate += point.value;
        const rateMap = byEntityRate.get(entity) ?? new Map();
        const rateEntry = rateMap.get(ts) ?? { up: 0, down: 0 };
        if (isUp) rateEntry.up += point.value;
        else rateEntry.down += point.value;
        rateMap.set(ts, rateEntry);
        byEntityRate.set(entity, rateMap);
      } else if (isUp) {
        if (discontinuities.has(`${entity}\0up\0${ts}`)) continue;
        entry.upDelta += point.value;
      } else {
        if (discontinuities.has(`${entity}\0down\0${ts}`)) continue;
        entry.downDelta += point.value;
      }
      byTime.set(ts, entry);
      if (!isRate) {
        const entityEntry = byEntity.get(entity) ?? { up: 0, down: 0 };
        if (isUp) entityEntry.up += point.value;
        else entityEntry.down += point.value;
        byEntity.set(entity, entityEntry);
      }
    }
  }
  const rate = Array.from(byTime.entries())
    .map(([time, value]) => ({ time, ...value }))
    .sort((a, b) => a.time - b.time);
  const points: TrafficSummary["points"] = [];
  let totalUp = 0;
  let totalDown = 0;
  for (const point of rate) {
    totalUp += point.upDelta;
    totalDown += point.downDelta;
    points.push({
      time: point.time,
      upRate: point.upRate,
      downRate: point.downRate,
      upCum: totalUp,
      downCum: totalDown,
    });
  }
  const nodeTotals: TrafficNodeTotals[] = Array.from(byEntity.entries())
    .map(([uuid, value]) => {
      let peakRate = 0;
      let peakTime = 0;
      for (const [ts, rateEntry] of byEntityRate.get(uuid) ?? []) {
        const combined = rateEntry.up + rateEntry.down;
        if (combined > peakRate) {
          peakRate = combined;
          peakTime = ts;
        }
      }
      return {
        uuid,
        up: value.up,
        down: value.down,
        total: value.up + value.down,
        peakRate,
        peakTime,
      };
    })
    .sort((a, b) => b.total - a.total);
  return { points, nodeTotals, totalUp, totalDown };
};

export const computeTopAverageItems = (
  res: QueryMetricsResponse | null,
  metricKey: string,
  nodeNameMap: Map<string, string>,
  toPercent: (uuid: string, value: number) => number,
): TopRankItem[] => {
  if (!res) return [];
  const bucket = new Map<
    string,
    { values: { value: number; count?: number }[]; peak: number; peakTime: number }
  >();
  for (const series of res.series ?? []) {
    if (series.metric_key !== metricKey) continue;
    const entry =
      bucket.get(series.entity_id) ?? { values: [], peak: 0, peakTime: 0 };
    for (const point of series.points ?? []) {
      if (point.value == null) continue;
      entry.values.push({ value: point.value, count: point.count });
      if (point.value > entry.peak) {
        entry.peak = point.value;
        entry.peakTime = new Date(point.time).getTime();
      }
    }
    bucket.set(series.entity_id, entry);
  }
  const items: TopRankItem[] = [];
  for (const [uuid, entry] of bucket) {
    const average = weightedAverage(entry.values);
    if (average == null) continue;
    const value = toPercent(uuid, average);
    if (!Number.isFinite(value)) continue;
    items.push({
      uuid,
      name: nodeNameMap.get(uuid) ?? uuid.slice(0, 8),
      value,
      peak: toPercent(uuid, entry.peak),
      peakTime: entry.peakTime,
    });
  }
  items.sort((a, b) => b.value - a.value);
  return items;
};
