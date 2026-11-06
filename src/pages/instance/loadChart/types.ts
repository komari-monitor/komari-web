import type { useTranslation } from "react-i18next";
import type { MetricChartRow } from "@/utils/metricSeries";
import type { RecordFormat } from "@/utils/RecordHelper";

export type TFn = ReturnType<typeof useTranslation>["t"];

export type ChartSize = "small" | "medium" | "large";
export type Aggregation =
  | "avg"
  | "min"
  | "max"
  | "first"
  | "last"
  | "stddev"
  | "p70"
  | "p95"
  | "p99";
export type MetricKind =
  | "percent"
  | "bytes"
  | "bytesPerSecond"
  | "count"
  | "temperature"
  | "load"
  | "milliseconds"
  | "raw";

export type DashboardChart = {
  id: string;
  title: string;
  metrics: string[];
  size: ChartSize;
};

export type MetricCatalogItem = {
  key: string;
  label: string;
  kind: MetricKind;
  unit?: string;
  realtimeValue?: (record: RecordFormat, node?: NodeLike) => number | null | undefined;
  realtimeTaggedValues?: (
    record: RecordFormat,
    node?: NodeLike,
  ) => Array<{ tags?: Record<string, string>; value: number | null | undefined }>;
};

export type NodeLike = {
  mem_total?: number;
  swap_total?: number;
  disk_total?: number;
};

export type MetricDefinition = {
  name: string;
  description?: string;
  type?: string;
  unit?: string;
  retention_days?: number;
};

export type RenderSeries = {
  dataKey: string;
  stableKey: string;
  metricKey: string;
  label: string;
  color: string;
  kind: MetricKind;
  pointCount?: number;
  unit?: string;
  yAxisId?: "left" | "right";
  tags?: Record<string, string>;
};

export type BuiltChartData = {
  rows: MetricChartRow[];
  series: RenderSeries[];
};

export type ChartAxis = {
  id: "left" | "right";
  kind: MetricKind;
  orientation: "left" | "right";
};

export type PreparedChartData = BuiltChartData & {
  axes: ChartAxis[];
};

export type TimeView = {
  key: string;
  label: string;
  hours?: number;
};

export type CustomTimeRange = {
  start: string;
  end: string;
};

export type MetricRangeParams =
  | { hours: number }
  | { start: string; end: string };
