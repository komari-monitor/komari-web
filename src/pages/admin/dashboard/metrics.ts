import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { QueryMetricsResponse } from "@/types/metrics";
import { COUNTRY_CENTROIDS, resolveCountryCode } from "@/utils/regionCode";
import { computeTrafficQuotaUsed } from "@/utils/trafficQuota";
import { normalizeCurrencyLabel, resolveCurrencyISO } from "./exchangeRates";
import type {
  BillingCurrencyTotals,
  BillingGroupEntry,
  BillingSummary,
  GlobeRegionMarker,
  GlobeSummary,
  LiveBandwidthNode,
  LiveBandwidthSummary,
  TopRankItem,
  TrafficNodeTotals,
  TrafficQuotaItem,
  TrafficSummary,
  UptimeNodeItem,
  UptimeSummary,
} from "./types";
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

const HOUR_MS = 3600 * 1000;
const MIN_PROJECTION_ELAPSED_MS = 6 * HOUR_MS;
const LONG_TERM_MS = 36500 * DAY_MS;

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("0001-")) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) && ts > 0 ? ts : null;
}

/** 流量配额预警列表：按配额使用率降序，含周期剩余与耗尽预判 */
export const computeTrafficQuotaItems = (
  nodes: readonly NodeBasicInfo[],
  latest: Record<string, any> | null,
  now: number,
): TrafficQuotaItem[] => {
  const items: TrafficQuotaItem[] = [];
  for (const node of nodes) {
    if (!Number.isFinite(node.traffic_limit) || node.traffic_limit <= 0) continue;
    const status = latest?.[node.uuid];
    const up = Math.max(0, Number(status?.net_total_up ?? status?.net_total_out ?? 0) || 0);
    const down = Math.max(0, Number(status?.net_total_down ?? status?.net_total_in ?? 0) || 0);
    const limitType = (node.traffic_limit_type || "sum").toLowerCase();
    const used = computeTrafficQuotaUsed(up, down, limitType);
    const percent = (used / node.traffic_limit) * 100;
    const cycleStart = parseTimestamp(status?.traffic_cycle_start);
    const cycleEnd = parseTimestamp(status?.traffic_cycle_end);
    const remainingMs = cycleEnd !== null ? Math.max(0, cycleEnd - now) : null;

    let projectedExhaust = false;
    let projectedDaysLeft: number | null = null;
    if (
      cycleStart !== null &&
      cycleEnd !== null &&
      cycleEnd > cycleStart &&
      percent < 100 &&
      used > 0
    ) {
      const elapsedMs = now - cycleStart;
      if (elapsedMs >= MIN_PROJECTION_ELAPSED_MS) {
        const ratePerMs = used / elapsedMs;
        const projectedCycleUsage = ratePerMs * (cycleEnd - cycleStart);
        if (projectedCycleUsage > node.traffic_limit) {
          projectedExhaust = true;
          projectedDaysLeft = Math.max(0, (node.traffic_limit - used) / ratePerMs / DAY_MS);
        }
      }
    }

    items.push({
      uuid: node.uuid,
      name: node.name,
      online: Boolean(status?.online),
      used,
      limit: node.traffic_limit,
      percent,
      limitType,
      up,
      down,
      cycleMode: typeof status?.traffic_cycle_mode === "string" ? status.traffic_cycle_mode : undefined,
      cycleStart,
      cycleEnd,
      remainingMs,
      projectedExhaust,
      projectedDaysLeft,
    });
  }
  items.sort((a, b) => b.percent - a.percent || b.used - a.used);
  return items;
};

/** 与 PriceTags / computeRenewalDate 对齐的月均与年化折算 */
function billingMultipliers(cycleDays: number): { monthlyDivisor: number; annualFactor: number } {
  if (cycleDays >= 27 && cycleDays <= 32) return { monthlyDivisor: 1, annualFactor: 12 };
  if (cycleDays >= 87 && cycleDays <= 95) return { monthlyDivisor: 3, annualFactor: 4 };
  if (cycleDays >= 175 && cycleDays <= 185) return { monthlyDivisor: 6, annualFactor: 2 };
  if (cycleDays >= 360 && cycleDays <= 370) return { monthlyDivisor: 12, annualFactor: 1 };
  if (cycleDays >= 720 && cycleDays <= 750) return { monthlyDivisor: 24, annualFactor: 0.5 };
  if (cycleDays >= 1080 && cycleDays <= 1150) return { monthlyDivisor: 36, annualFactor: 1 / 3 };
  if (cycleDays >= 1800 && cycleDays <= 1850) return { monthlyDivisor: 60, annualFactor: 0.2 };
  return { monthlyDivisor: cycleDays / 30, annualFactor: 365 / cycleDays };
}

/** 持机成本汇总：按原币种与分组聚合月均、年化、一次性投入及 30 天待续费 */
export const computeBillingSummary = (
  nodes: readonly NodeBasicInfo[],
  now: number,
): BillingSummary => {
  let pricedCount = 0;
  let freeCount = 0;
  let unpricedCount = 0;
  let oneTimeCount = 0;
  let totalDue30dCount = 0;
  let overdueCount = 0;
  let autoRenewal30dCount = 0;

  const currencyMap = new Map<string, BillingCurrencyTotals>();
  const groupMap = new Map<
    string,
    {
      count: number;
      currencies: Map<string, { label: string; iso: string | null; monthly: number; annual: number }>;
    }
  >();

  const dueDeadline = now + 30 * DAY_MS;

  for (const node of nodes) {
    const price = Number(node.price) || 0;
    if (price === -1) {
      freeCount += 1;
      continue;
    }
    if (price <= 0) {
      unpricedCount += 1;
      continue;
    }

    pricedCount += 1;
    const label = normalizeCurrencyLabel(node.currency);
    const iso = resolveCurrencyISO(node.currency);
    const key = iso ?? label;

    const bucket = currencyMap.get(key) ?? {
      label,
      iso,
      monthly: 0,
      annual: 0,
      due30d: 0,
      due30dCount: 0,
      overdueCount: 0,
      autoRenewal30d: 0,
      oneTime: 0,
      recurringCount: 0,
    };

    const cycle = Number(node.billing_cycle) || 0;
    if (cycle === -1) {
      oneTimeCount += 1;
      bucket.oneTime += price;
    } else {
      const effectiveCycle = cycle > 0 ? cycle : 30;
      const { monthlyDivisor, annualFactor } = billingMultipliers(effectiveCycle);
      const monthly = price / monthlyDivisor;
      const annual = price * annualFactor;
      bucket.monthly += monthly;
      bucket.annual += annual;
      bucket.recurringCount += 1;

      const expiredTs = parseTimestamp(node.expired_at);
      if (expiredTs !== null && expiredTs - now < LONG_TERM_MS) {
        if (expiredTs <= now) {
          bucket.overdueCount += 1;
          overdueCount += 1;
        } else if (expiredTs <= dueDeadline) {
          bucket.due30d += price;
          bucket.due30dCount += 1;
          totalDue30dCount += 1;
          if (node.auto_renewal) {
            bucket.autoRenewal30d += 1;
            autoRenewal30dCount += 1;
          }
        }
      }

      const groupName = (node.group ?? "").trim();
      const groupEntry = groupMap.get(groupName) ?? { count: 0, currencies: new Map() };
      groupEntry.count += 1;
      const groupCur = groupEntry.currencies.get(key) ?? {
        label,
        iso,
        monthly: 0,
        annual: 0,
      };
      groupCur.monthly += monthly;
      groupCur.annual += annual;
      groupEntry.currencies.set(key, groupCur);
      groupMap.set(groupName, groupEntry);
    }

    currencyMap.set(key, bucket);
  }

  const currencies = Array.from(currencyMap.values()).sort(
    (a, b) => b.recurringCount - a.recurringCount || b.monthly - a.monthly,
  );

  const groups: BillingGroupEntry[] = Array.from(groupMap.entries())
    .map(([group, entry]) => ({
      group,
      count: entry.count,
      currencies: Array.from(entry.currencies.values()).sort((a, b) => b.monthly - a.monthly),
    }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));

  return {
    pricedCount,
    freeCount,
    unpricedCount,
    oneTimeCount,
    totalDue30dCount,
    overdueCount,
    autoRenewal30dCount,
    currencies,
    groups,
  };
};

/** 全集群实时带宽与瞬时速率排行 */
export const computeLiveBandwidthSummary = (
  nodes: readonly NodeBasicInfo[],
  latest: Record<string, any> | null,
): LiveBandwidthSummary => {
  let totalUp = 0;
  let totalDown = 0;
  let activeCount = 0;
  let onlineCount = 0;
  const list: LiveBandwidthNode[] = [];

  for (const node of nodes) {
    const status = latest?.[node.uuid];
    if (!status?.online) continue;
    onlineCount += 1;
    const up = Math.max(0, Number(status.net_out) || 0);
    const down = Math.max(0, Number(status.net_in) || 0);
    const total = up + down;
    totalUp += up;
    totalDown += down;
    if (total > 0) activeCount += 1;
    list.push({ uuid: node.uuid, name: node.name, up, down, total });
  }

  list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { totalUp, totalDown, activeCount, onlineCount, nodes: list };
};

/** 近期重启与连续运行时长汇总 */
export const computeUptimeSummary = (
  nodes: readonly NodeBasicInfo[],
  latest: Record<string, any> | null,
  now: number,
): UptimeSummary => {
  const items: UptimeNodeItem[] = [];
  let recentCount24h = 0;

  for (const node of nodes) {
    const status = latest?.[node.uuid];
    if (!status?.online) continue;
    const uptime = Number(status.uptime);
    if (!Number.isFinite(uptime) || uptime < 0) continue;
    const recentReboot24h = uptime < 24 * 3600;
    if (recentReboot24h) recentCount24h += 1;
    items.push({
      uuid: node.uuid,
      name: node.name,
      uptime,
      bootTime: now - uptime * 1000,
      recentReboot24h,
    });
  }

  const shortest = [...items].sort((a, b) => a.uptime - b.uptime);
  const longest = [...items].sort((a, b) => b.uptime - a.uptime);
  return { recentCount24h, shortest, longest };
};

/** 全球节点地理聚合（同国家/地区聚合为一个球面坐标点） */
export const computeGlobeSummary = (
  nodes: readonly NodeBasicInfo[],
  latest: Record<string, any> | null,
): GlobeSummary => {
  const byCode = new Map<string, GlobeRegionMarker>();
  let unmappedCount = 0;
  let onlineTotal = 0;

  for (const node of nodes) {
    const status = latest?.[node.uuid];
    const online = Boolean(status?.online);
    if (online) onlineTotal += 1;

    const code = resolveCountryCode(node.region);
    const coords = code !== "UN" ? COUNTRY_CENTROIDS[code] : undefined;
    if (!coords) {
      unmappedCount += 1;
      continue;
    }

    const entry = byCode.get(code) ?? {
      code,
      lat: coords[0],
      lng: coords[1],
      total: 0,
      online: 0,
      offline: 0,
      nodes: [],
    };
    entry.total += 1;
    if (online) entry.online += 1;
    else entry.offline += 1;
    entry.nodes.push({
      uuid: node.uuid,
      name: node.name,
      online,
      up: Math.max(0, Number(status?.net_out) || 0),
      down: Math.max(0, Number(status?.net_in) || 0),
    });
    byCode.set(code, entry);
  }

  const regions = Array.from(byCode.values()).sort(
    (a, b) => b.total - a.total || b.offline - a.offline || a.code.localeCompare(b.code),
  );
  return {
    regions,
    unmappedCount,
    onlineTotal,
    nodeTotal: nodes.length,
  };
};
