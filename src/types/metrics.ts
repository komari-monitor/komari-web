export type MetricTags = Record<string, string>;

export type MetricTagged = {
  tags?: MetricTags;
};

export type MetricPoint = MetricTagged & {
  time: string;
  value: number | null;
  count?: number;
  labels?: Record<string, string>;
};

export type MetricSeries = MetricTagged & {
  metric_key: string;
  entity_id: string;
  type?: string;
  unit?: string;
  retention_days?: number;
  downsampled?: boolean;
  downsample_algorithm?: string;
  max_points?: number;
  interval_seconds?: number;
  count: number;
  points: MetricPoint[];
};

export type QueryMetricsResponse = {
  start: string;
  end: string;
  series: MetricSeries[];
  count: number;
};

export type PublicPingTask = {
  id: number;
  weight?: number;
  name: string;
  type?: string;
  interval?: number;
  clients?: string[];
  default_on?: boolean;
};

export type PingMetricStat = {
  entity_id: string;
  task_id: string;
  name?: string;
  type?: string;
  interval?: number;
  tags?: MetricTags;
  total: number;
  valid: number;
  loss: number;
  loss_approximate?: boolean;
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  latest?: number | null;
  p50?: number | null;
  p95?: number | null;
  p99?: number | null;
  stddev?: number | null;
  p99_p50_ratio?: number;
};

export type DashboardTrafficPoint = {
  time: number;
  upRate: number;
  downRate: number;
  upCum: number;
  downCum: number;
};

export type DashboardTrafficNodeTotal = {
  uuid: string;
  up: number;
  down: number;
  total: number;
  peakRate: number;
  peakTime: number;
};

export type DashboardRankItem = {
  uuid: string;
  value: number;
  peak: number;
  peakTime: number;
};

export type DashboardSummaryResponse = {
  start: string;
  end: string;
  traffic: {
    points: DashboardTrafficPoint[];
    nodeTotals: DashboardTrafficNodeTotal[];
    totalUp: number;
    totalDown: number;
  };
  top_cpu: DashboardRankItem[];
  top_mem: DashboardRankItem[];
};

export type DashboardTrafficSummary = DashboardSummaryResponse["traffic"];

export type PingMetricStatsResponse = {
  start: string;
  end: string;
  interval_seconds?: number;
  stats: PingMetricStat[];
  count: number;
};
