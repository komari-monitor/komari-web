export type TopRankItem = {
  uuid: string;
  name: string;
  value: number;
  peak: number;
  peakTime: number;
};

export type TrafficNodeTotals = {
  uuid: string;
  up: number;
  down: number;
  total: number;
  peakRate: number;
  peakTime: number;
};

export type PingRankItem = {
  key: string;
  entityId: string;
  taskId: string;
  label: string;
  p95: number | null;
  volatility: number;
  loss: number;
  valid: number;
};

export type TrafficSummary = {
  points: {
    time: number;
    upRate: number;
    downRate: number;
    upCum: number;
    downCum: number;
  }[];
  nodeTotals: TrafficNodeTotals[];
  totalUp: number;
  totalDown: number;
};

export type DbSizeInfo = {
  main: number | null;
  monitoring: number | null;
};

export type DashboardStats = {
  total: number;
  online: number;
  offline: number;
  onlineRate: number;
};

export type DashboardHealth = {
  level: "empty" | "healthy" | "warning" | "danger";
  color: "gray" | "green" | "orange" | "red";
};

export type TrafficQuotaItem = {
  uuid: string;
  name: string;
  online: boolean;
  used: number;
  limit: number;
  percent: number;
  limitType: string;
  up: number;
  down: number;
  cycleMode?: string;
  cycleStart?: number | null;
  cycleEnd?: number | null;
  remainingMs: number | null;
  projectedExhaust: boolean;
  projectedDaysLeft: number | null;
};

export type BillingCurrencyTotals = {
  label: string;
  iso: string | null;
  monthly: number;
  annual: number;
  due30d: number;
  due30dCount: number;
  overdueCount: number;
  autoRenewal30d: number;
  oneTime: number;
  recurringCount: number;
};

export type BillingGroupEntry = {
  group: string;
  count: number;
  currencies: Array<{
    label: string;
    iso: string | null;
    monthly: number;
    annual: number;
  }>;
};

export type BillingSummary = {
  pricedCount: number;
  freeCount: number;
  unpricedCount: number;
  oneTimeCount: number;
  totalDue30dCount: number;
  overdueCount: number;
  autoRenewal30dCount: number;
  currencies: BillingCurrencyTotals[];
  groups: BillingGroupEntry[];
};

export type LiveBandwidthNode = {
  uuid: string;
  name: string;
  up: number;
  down: number;
  total: number;
};

export type LiveBandwidthSummary = {
  totalUp: number;
  totalDown: number;
  activeCount: number;
  onlineCount: number;
  nodes: LiveBandwidthNode[];
};

export type UptimeNodeItem = {
  uuid: string;
  name: string;
  uptime: number;
  bootTime: number;
  recentReboot24h: boolean;
};

export type UptimeSummary = {
  recentCount24h: number;
  shortest: UptimeNodeItem[];
  longest: UptimeNodeItem[];
};

export type GlobeRegionNode = {
  uuid: string;
  name: string;
  online: boolean;
  up: number;
  down: number;
};

export type GlobeRegionMarker = {
  code: string;
  lat: number;
  lng: number;
  total: number;
  online: number;
  offline: number;
  nodes: GlobeRegionNode[];
};

export type GlobeSummary = {
  regions: GlobeRegionMarker[];
  unmappedCount: number;
  onlineTotal: number;
  nodeTotal: number;
};
