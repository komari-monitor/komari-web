import { memo, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, Flex, SegmentedControl, Select, Switch } from "@radix-ui/themes";
import {
  Activity,
  ChartLine,
  Eye,
  EyeOff,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import Loading from "@/components/loading";
import Tips from "@/components/ui/tips";
import { useNodeList } from "@/contexts/NodeListContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/utils/unitHelper";
import type { RecordFormat } from "@/utils/RecordHelper";

type LoadChartProps = {
  data: RecordFormat[];
  onRealtimeActiveChange?: (active: boolean) => void;
};

type ChartSize = "small" | "medium" | "large";
type Aggregation =
  | "avg"
  | "min"
  | "max"
  | "first"
  | "last"
  | "stddev"
  | "p70"
  | "p95"
  | "p99";
type MetricKind =
  | "percent"
  | "bytes"
  | "bytesPerSecond"
  | "count"
  | "temperature"
  | "load"
  | "milliseconds"
  | "raw";

type DashboardChart = {
  id: string;
  title: string;
  metrics: string[];
  size: ChartSize;
};

type MetricCatalogItem = {
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

type NodeLike = {
  mem_total?: number;
  swap_total?: number;
  disk_total?: number;
};

type MetricDefinition = {
  name: string;
  description?: string;
  type?: string;
  unit?: string;
  retention_days?: number;
};

type MetricPoint = {
  time: string;
  value: number | null;
  count?: number;
  tags?: Record<string, string>;
  labels?: Record<string, string>;
};

type MetricSeries = {
  metric_key: string;
  entity_id: string;
  type?: string;
  unit?: string;
  tags?: Record<string, string>;
  downsampled: boolean;
  downsample_algorithm?: string;
  max_points?: number;
  interval_seconds?: number;
  count: number;
  points: MetricPoint[];
};

type QueryMetricsResponse = {
  start: string;
  end: string;
  series: MetricSeries[];
  count: number;
};

type PingTask = {
  id: number;
  name: string;
  type?: string;
  interval?: number;
};

type PingMetricStat = {
  entity_id: string;
  task_id: string;
  name?: string;
  type?: string;
  interval?: number;
  total: number;
  valid: number;
  loss: number;
  loss_approximate?: boolean;
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  latest?: number | null;
  p50?: number | null;
  p99?: number | null;
  stddev?: number | null;
  p99_p50_ratio?: number;
};

type PingMetricStatsResponse = {
  stats: PingMetricStat[];
};

type RenderSeries = {
  dataKey: string;
  stableKey: string;
  metricKey: string;
  label: string;
  color: string;
  kind: MetricKind;
  tags?: Record<string, string>;
};

type TimeView = {
  key: string;
  label: string;
  hours?: number;
};

const MAX_REALTIME_POINTS = 30 * 5;
const HISTORY_MAX_POINTS = 700;

const SERIES_COLORS = [
  "#F38181",
  "#347433",
  "#898AC4",
  "#03A6A1",
  "#7AD6F0",
  "#B388FF",
  "#FF8A65",
  "#FFD600",
  "#2F80ED",
  "#27AE60",
  "#EB5757",
  "#9B51E0",
];

const AGGREGATIONS: Array<{ value: Aggregation; labelKey: string }> = [
  { value: "avg", labelKey: "chart.sampling.average" },
  { value: "min", labelKey: "chart.sampling.min" },
  { value: "max", labelKey: "chart.sampling.max" },
  { value: "first", labelKey: "chart.sampling.first" },
  { value: "last", labelKey: "chart.sampling.last" },
  { value: "stddev", labelKey: "chart.sampling.stddev" },
  { value: "p70", labelKey: "chart.sampling.p70" },
  { value: "p95", labelKey: "chart.sampling.p95" },
  { value: "p99", labelKey: "chart.sampling.p99" },
];

const DEFAULT_DASHBOARD: DashboardChart[] = [
  {
    id: "cpu",
    title: "CPU",
    metrics: ["cpu.usage"],
    size: "small",
  },
  {
    id: "memory",
    title: "Memory",
    metrics: ["memory.used", "swap.used"],
    size: "small",
  },
  {
    id: "disk",
    title: "Disk",
    metrics: ["disk.used"],
    size: "small",
  },
  {
    id: "network",
    title: "Network",
    metrics: ["net.in.rate", "net.out.rate"],
    size: "small",
  },
  {
    id: "connections",
    title: "Connections",
    metrics: ["connections.tcp", "connections.udp"],
    size: "small",
  },
  {
    id: "process",
    title: "Processes",
    metrics: ["process.count"],
    size: "small",
  },
  {
    id: "ping",
    title: "Ping",
    metrics: ["ping.latency_ms"],
    size: "medium",
  },
];

const fallbackCatalog: MetricCatalogItem[] = [
  {
    key: "cpu.usage",
    label: "CPU",
    kind: "percent",
    unit: "%",
    realtimeValue: (record) => record.cpu,
  },
  {
    key: "gpu.usage",
    label: "GPU",
    kind: "percent",
    unit: "%",
    realtimeValue: (record) => record.gpu_usage ?? record.gpu,
  },
  {
    key: "gpu.device.usage",
    label: "GPU Device",
    kind: "percent",
    unit: "%",
    realtimeTaggedValues: (record) =>
      Object.entries(record.gpu_detailed ?? {}).map(([index, gpu]) => ({
        tags: {
          device_index: String(gpu.device_index ?? index),
          device_name: gpu.device_name ?? `GPU ${Number(index) + 1}`,
        },
        value: gpu.usage,
      })),
  },
  {
    key: "gpu.memory.used",
    label: "GPU Memory",
    kind: "bytes",
    unit: "bytes",
    realtimeTaggedValues: (record) =>
      Object.entries(record.gpu_detailed ?? {}).map(([index, gpu]) => ({
        tags: {
          device_index: String(gpu.device_index ?? index),
          device_name: gpu.device_name ?? `GPU ${Number(index) + 1}`,
        },
        value: gpu.mem_used,
      })),
  },
  {
    key: "gpu.memory.total",
    label: "GPU Memory Total",
    kind: "bytes",
    unit: "bytes",
    realtimeTaggedValues: (record) =>
      Object.entries(record.gpu_detailed ?? {}).map(([index, gpu]) => ({
        tags: {
          device_index: String(gpu.device_index ?? index),
          device_name: gpu.device_name ?? `GPU ${Number(index) + 1}`,
        },
        value: gpu.mem_total,
      })),
  },
  {
    key: "gpu.temperature",
    label: "GPU Temperature",
    kind: "temperature",
    unit: "degC",
    realtimeTaggedValues: (record) =>
      Object.entries(record.gpu_detailed ?? {}).map(([index, gpu]) => ({
        tags: {
          device_index: String(gpu.device_index ?? index),
          device_name: gpu.device_name ?? `GPU ${Number(index) + 1}`,
        },
        value: gpu.temperature,
      })),
  },
  {
    key: "memory.used",
    label: "RAM",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record) => record.ram,
  },
  {
    key: "memory.total",
    label: "RAM Total",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record, node) => record.ram_total || node?.mem_total,
  },
  {
    key: "swap.used",
    label: "Swap",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record) => record.swap,
  },
  {
    key: "swap.total",
    label: "Swap Total",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record, node) => record.swap_total || node?.swap_total,
  },
  {
    key: "load.average",
    label: "Load",
    kind: "load",
    realtimeValue: (record) => record.load,
  },
  {
    key: "temperature",
    label: "Temperature",
    kind: "temperature",
    unit: "degC",
    realtimeValue: (record) => record.temp,
  },
  {
    key: "disk.used",
    label: "Disk",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record) => record.disk,
  },
  {
    key: "disk.total",
    label: "Disk Total",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record, node) => record.disk_total || node?.disk_total,
  },
  {
    key: "net.in.rate",
    label: "Download",
    kind: "bytesPerSecond",
    unit: "bytes/s",
    realtimeValue: (record) => record.net_in,
  },
  {
    key: "net.out.rate",
    label: "Upload",
    kind: "bytesPerSecond",
    unit: "bytes/s",
    realtimeValue: (record) => record.net_out,
  },
  {
    key: "net.total.up",
    label: "Total Upload",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record) => record.net_total_up,
  },
  {
    key: "net.total.down",
    label: "Total Download",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record) => record.net_total_down,
  },
  {
    key: "traffic.up",
    label: "Traffic Upload",
    kind: "bytes",
    unit: "bytes",
  },
  {
    key: "traffic.down",
    label: "Traffic Download",
    kind: "bytes",
    unit: "bytes",
  },
  {
    key: "process.count",
    label: "Processes",
    kind: "count",
    realtimeValue: (record) => record.process,
  },
  {
    key: "connections.tcp",
    label: "TCP",
    kind: "count",
    realtimeValue: (record) => record.connections,
  },
  {
    key: "connections.udp",
    label: "UDP",
    kind: "count",
    realtimeValue: (record) => record.connections_udp,
  },
  {
    key: "ping.latency_ms",
    label: "Ping",
    kind: "milliseconds",
    unit: "ms",
  },
];

const fallbackCatalogMap = new Map(fallbackCatalog.map((item) => [item.key, item]));

const tagsKey = (tags?: Record<string, string>) => {
  if (!tags || Object.keys(tags).length === 0) return "";
  return Object.keys(tags)
    .sort()
    .map((key) => `${key}=${tags[key]}`)
    .join(",");
};

const hashKey = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `s_${Math.abs(hash).toString(36)}`;
};

const seriesStableKey = (metricKey: string, tags?: Record<string, string>) =>
  `${metricKey}|${tagsKey(tags)}`;

const seriesDataKey = (metricKey: string, tags?: Record<string, string>) =>
  hashKey(seriesStableKey(metricKey, tags));

const formatTags = (
  metricKey: string,
  tags: Record<string, string> | undefined,
  pingTaskMap: Map<string, PingTask>,
) => {
  if (!tags || Object.keys(tags).length === 0) return "";
  if (metricKey === "ping.latency_ms" && tags.task_id !== undefined) {
    return pingTaskMap.get(String(tags.task_id))?.name || `Task ${tags.task_id}`;
  }
  if (tags.device_name) return String(tags.device_name);
  if (tags.device_index !== undefined) return `GPU ${Number(tags.device_index) + 1}`;
  if (tags.task_id !== undefined) return `Task ${tags.task_id}`;
  return Object.keys(tags)
    .sort()
    .map((key) => `${key}:${tags[key]}`)
    .join(" ");
};

const formatSeriesLabel = (
  metricKey: string,
  tags: Record<string, string> | undefined,
  definitions: Map<string, MetricDefinition>,
  pingTaskMap: Map<string, PingTask>,
) => {
  const tagLabel = formatTags(metricKey, tags, pingTaskMap);
  if (metricKey === "ping.latency_ms" && tagLabel) return tagLabel;
  const metricLabel = getMetricLabel(metricKey, definitions);
  return tagLabel ? `${metricLabel} ${tagLabel}` : metricLabel;
};

const asMetricValue = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const formatValue = (value: unknown, kind: MetricKind) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  switch (kind) {
    case "percent":
      return `${value.toFixed(2)}%`;
    case "bytes":
      return formatBytes(value);
    case "bytesPerSecond":
      return `${formatBytes(value)}/s`;
    case "count":
      return `${Math.round(value)}`;
    case "temperature":
      return `${value.toFixed(1)}°C`;
    case "milliseconds":
      return `${Math.round(value)} ms`;
    case "load":
      return value.toFixed(2);
    default:
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
};

const getMetricKind = (metricKey: string, unit?: string): MetricKind => {
  const fallback = fallbackCatalogMap.get(metricKey);
  if (fallback) return fallback.kind;
  const normalizedUnit = (unit ?? "").toLowerCase();
  if (normalizedUnit === "%" || normalizedUnit === "percent") return "percent";
  if (normalizedUnit === "bytes") return "bytes";
  if (normalizedUnit === "bytes/s") return "bytesPerSecond";
  if (normalizedUnit === "ms") return "milliseconds";
  if (normalizedUnit.includes("°") || normalizedUnit.includes("deg")) return "temperature";
  if (normalizedUnit === "count") return "count";
  return "raw";
};

const getMetricLabel = (
  metricKey: string,
  definitions: Map<string, MetricDefinition>,
) => {
  const fallback = fallbackCatalogMap.get(metricKey);
  if (fallback) return fallback.label;
  const def = definitions.get(metricKey);
  return def?.description || def?.name || metricKey;
};

const chartSizeClass: Record<ChartSize, string> = {
  small: "lg:col-span-1",
  medium: "lg:col-span-2",
  large: "lg:col-span-3",
};

const buildTimeViews = (
  t: ReturnType<typeof useTranslation>["t"],
  maxMetricRetentionHours: number,
): TimeView[] => {
  const views: TimeView[] = [{ key: "real-time", label: t("common.real_time") }];
  const presets = [
    { key: "4h", label: t("chart.hours", { count: 4 }), hours: 4 },
    { key: "1d", label: t("chart.days", { count: 1 }), hours: 24 },
    { key: "7d", label: t("chart.days", { count: 7 }), hours: 168 },
    { key: "30d", label: t("chart.days", { count: 30 }), hours: 720 },
  ];

  if (Number.isFinite(maxMetricRetentionHours) && maxMetricRetentionHours > 0) {
    for (const view of presets) {
      if (maxMetricRetentionHours >= view.hours) views.push(view);
    }
    const maxPreset = presets[presets.length - 1];
    const isPreset = presets.some((view) => view.hours === maxMetricRetentionHours);
    if (maxMetricRetentionHours > maxPreset.hours || (maxMetricRetentionHours > 4 && !isPreset)) {
      views.push({
        key: `retention-${maxMetricRetentionHours}`,
        label:
          maxMetricRetentionHours % 24 === 0
            ? t("chart.days", { count: Math.floor(maxMetricRetentionHours / 24) })
            : t("chart.hours", { count: maxMetricRetentionHours }),
        hours: maxMetricRetentionHours,
      });
    }
  }

  return views;
};

const toChartConfig = (series: RenderSeries[]) => {
  const config: ChartConfig = {};
  for (const item of series) {
    config[item.dataKey] = {
      label: item.label,
      color: item.color,
    };
  }
  return config;
};

const buildRowsFromMetricSeries = (
  metricSeries: MetricSeries[],
  chart: DashboardChart,
  definitions: Map<string, MetricDefinition>,
  pingTaskMap: Map<string, PingTask>,
) => {
  const rows = new Map<string, Record<string, string | number | null>>();
  const renderSeries: RenderSeries[] = [];

  metricSeries
    .filter((series) => chart.metrics.includes(series.metric_key))
    .forEach((series) => {
      const stableKey = seriesStableKey(series.metric_key, series.tags);
      const dataKey = seriesDataKey(series.metric_key, series.tags);
      const label = formatSeriesLabel(series.metric_key, series.tags, definitions, pingTaskMap);
      const kind = getMetricKind(series.metric_key, series.unit);
      renderSeries.push({
        dataKey,
        stableKey,
        metricKey: series.metric_key,
        label,
        color: SERIES_COLORS[(renderSeries.length) % SERIES_COLORS.length],
        kind,
        tags: series.tags,
      });

      for (const point of series.points ?? []) {
        const timestamp = new Date(point.time).toISOString();
        const row = rows.get(timestamp) ?? { time: timestamp };
        row[dataKey] = asMetricValue(point.value);
        rows.set(timestamp, row);
      }
    });

  return {
    rows: Array.from(rows.values()).sort(
      (a, b) => new Date(String(a.time)).getTime() - new Date(String(b.time)).getTime(),
    ),
    series: renderSeries,
  };
};

const buildRowsFromRealtime = (
  records: RecordFormat[],
  chart: DashboardChart,
  node: NodeLike | undefined,
  pingTaskMap: Map<string, PingTask>,
) => {
  const rows = new Map<string, Record<string, string | number | null>>();
  const renderSeries: RenderSeries[] = [];
  const seriesIndex = new Map<string, RenderSeries>();
  const recent = Array.isArray(records) ? records.slice(-MAX_REALTIME_POINTS) : [];

  for (const record of recent) {
    const time = record.time;
    if (!time) continue;
    const row = rows.get(time) ?? { time };

    for (const metricKey of chart.metrics) {
      const metric = fallbackCatalogMap.get(metricKey);
      if (!metric) continue;

      if (metric.realtimeTaggedValues) {
        const values = metric.realtimeTaggedValues(record, node);
        for (const tagged of values) {
          const key = `${metricKey}:${tagsKey(tagged.tags)}`;
          let item = seriesIndex.get(key);
          if (!item) {
            const tagLabel = formatTags(metricKey, tagged.tags, pingTaskMap);
            const stableKey = seriesStableKey(metricKey, tagged.tags);
            item = {
              dataKey: seriesDataKey(metricKey, tagged.tags),
              stableKey,
              metricKey,
              label: tagLabel ? `${metric.label} ${tagLabel}` : metric.label,
              color: SERIES_COLORS[renderSeries.length % SERIES_COLORS.length],
              kind: metric.kind,
              tags: tagged.tags,
            };
            seriesIndex.set(key, item);
            renderSeries.push(item);
          }
          row[item.dataKey] = asMetricValue(tagged.value);
        }
        continue;
      }

      const key = `${metricKey}:`;
      let item = seriesIndex.get(key);
      if (!item) {
        const stableKey = seriesStableKey(metricKey);
        item = {
          dataKey: seriesDataKey(metricKey),
          stableKey,
          metricKey,
          label: metric.label,
          color: SERIES_COLORS[renderSeries.length % SERIES_COLORS.length],
          kind: metric.kind,
        };
        seriesIndex.set(key, item);
        renderSeries.push(item);
      }
      row[item.dataKey] = asMetricValue(metric.realtimeValue?.(record, node));
    }

    rows.set(time, row);
  }

  return {
    rows: Array.from(rows.values()).sort(
      (a, b) => new Date(String(a.time)).getTime() - new Date(String(b.time)).getTime(),
    ),
    series: renderSeries,
  };
};

const applyEwma = (
  rows: Array<Record<string, string | number | null>>,
  series: RenderSeries[],
  enabled: boolean,
) => {
  if (!enabled) return rows;
  const alpha = 0.35;
  const out = rows.map((row) => ({ ...row }));
  for (const item of series) {
    let previous: number | null = null;
    for (const row of out) {
      const value = row[item.dataKey];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      previous = previous === null ? value : alpha * value + (1 - alpha) * previous;
      row[item.dataKey] = previous;
    }
  }
  return out;
};

const timeFormatter = (hours: number | undefined, rowsLength: number) => {
  return (value: any, index: number) => {
    if (!rowsLength) return "";
    if (index !== 0 && index !== rowsLength - 1) return "";
    if (!hours || hours < 24) {
      return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return new Date(value).toLocaleDateString([], {
      month: "2-digit",
      day: "2-digit",
    });
  };
};

const labelFormatter = (hours: number | undefined) => {
  return (value: any) => {
    const date = new Date(value);
    if (!hours || hours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
    return date.toLocaleString([], {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
};

const getLatestText = (
  rows: Array<Record<string, string | number | null>>,
  series: RenderSeries[],
) => {
  for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
    const row = rows[rowIndex];
    for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
      const item = series[seriesIndex];
      const value = row[item.dataKey];
      if (typeof value === "number" && Number.isFinite(value)) {
        return `${item.label}: ${formatValue(value, item.kind)}`;
      }
    }
  }
  return "-";
};

const normalizeDashboard = (value: DashboardChart[]): DashboardChart[] => {
  if (!Array.isArray(value)) return DEFAULT_DASHBOARD;
  return value.map((chart, index) => ({
    id: chart.id || `chart-${index}`,
    title: chart.title || `Chart ${index + 1}`,
    metrics: Array.isArray(chart.metrics) ? chart.metrics : [],
    size: chart.size === "medium" || chart.size === "large" ? chart.size : "small",
  }));
};

const PingStatTooltip = ({
  stat,
  t,
}: {
  stat: PingMetricStat;
  t: ReturnType<typeof useTranslation>["t"];
}) => {
  const rows: Array<[string, string]> = [
    [t("chart.lossRate"), `${Number(stat.loss ?? 0).toFixed(1)}%${stat.loss_approximate ? ` ${t("chart.approximate", "approx.")}` : ""}`],
  ];
  if (typeof stat.min === "number") rows.push([t("chart.min"), formatValue(stat.min, "milliseconds")]);
  if (typeof stat.max === "number") rows.push([t("chart.max"), formatValue(stat.max, "milliseconds")]);
  if (typeof stat.avg === "number") rows.push([t("chart.avg"), formatValue(stat.avg, "milliseconds")]);
  if (typeof stat.latest === "number") rows.push([t("chart.latest"), formatValue(stat.latest, "milliseconds")]);
  if (typeof stat.p50 === "number") rows.push(["p50", formatValue(stat.p50, "milliseconds")]);
  if (typeof stat.p99 === "number") rows.push(["p99", formatValue(stat.p99, "milliseconds")]);
  if (typeof stat.stddev === "number") rows.push([t("chart.sampling.stddev"), formatValue(stat.stddev, "milliseconds")]);
  if (typeof stat.p99_p50_ratio === "number") rows.push([t("chart.volatility"), stat.p99_p50_ratio.toFixed(2)]);
  rows.push([t("chart.total"), `${stat.total}`]);
  rows.push([t("chart.valid", "Valid"), `${stat.valid}`]);
  if (stat.interval) rows.push([t("chart.interval"), `${stat.interval}s`]);
  if (stat.type) rows.push([t("chart.type"), stat.type.toUpperCase()]);

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono">{value}</span>
        </div>
      ))}
    </div>
  );
};

const LoadChart = ({ data = [], onRealtimeActiveChange }: LoadChartProps) => {
  const { t } = useTranslation();
  const { uuid } = useParams<{ uuid: string }>();
  const { call } = useRPC2Call();
  const { publicInfo } = usePublicInfo();
  const { nodeList } = useNodeList();
  const node = nodeList?.find((item) => item.uuid === uuid);
  const maxMetricRetentionHours = (publicInfo?.metric_retention_days || 30) * 24;
  const timeViews = useMemo(
    () => buildTimeViews(t, maxMetricRetentionHours),
    [t, maxMetricRetentionHours],
  );
  const [viewKey, setViewKey] = useState("real-time");
  const selectedView = timeViews.find((view) => view.key === viewKey) ?? timeViews[0];
  const isRealtime = selectedView.key === "real-time";
  const [aggregation, setAggregation] = useLocalStorage<Aggregation>(
    "komari-instance-metric-aggregation",
    "avg",
  );
  const [ewmaEnabled, setEwmaEnabled] = useLocalStorage(
    "komari-instance-metric-ewma",
    false,
  );
  const [hiddenSeries, setHiddenSeries] = useLocalStorage<Record<string, boolean>>(
    "komari-instance-metric-hidden-series",
    {},
  );
  const [dashboard, setDashboard] = useLocalStorage<DashboardChart[]>(
    "komari-instance-metric-dashboard",
    DEFAULT_DASHBOARD,
  );
  const charts = useMemo(() => normalizeDashboard(dashboard), [dashboard]);
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [pingTasks, setPingTasks] = useState<PingTask[]>([]);
  const [pingStats, setPingStats] = useState<PingMetricStat[]>([]);
  const [metricData, setMetricData] = useState<QueryMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onRealtimeActiveChange?.(isRealtime);
  }, [isRealtime, onRealtimeActiveChange]);

  useEffect(() => {
    if (!timeViews.some((view) => view.key === viewKey)) {
      setViewKey(timeViews[0]?.key ?? "real-time");
    }
  }, [timeViews, viewKey]);

  useEffect(() => {
    let active = true;
    call<unknown, MetricDefinition[]>("public:listMetricDefinitions")
      .then((items) => {
        if (active) setDefinitions(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setDefinitions([]);
      });
    return () => {
      active = false;
    };
  }, [call]);

  useEffect(() => {
    let active = true;
    call<unknown, PingTask[]>("public:getPublicPingTasks")
      .then((items) => {
        if (active) setPingTasks(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setPingTasks([]);
      });
    return () => {
      active = false;
    };
  }, [call]);

  const definitionMap = useMemo(
    () => new Map(definitions.map((item) => [item.name, item])),
    [definitions],
  );
  const pingTaskMap = useMemo(
    () => new Map(pingTasks.map((item) => [String(item.id), item])),
    [pingTasks],
  );

  const metricOptions = useMemo(() => {
    const merged = new Map<string, MetricCatalogItem>();
    for (const item of fallbackCatalog) merged.set(item.key, item);
    for (const def of definitions) {
      if (!merged.has(def.name)) {
        merged.set(def.name, {
          key: def.name,
          label: def.description || def.name,
          kind: getMetricKind(def.name, def.unit),
          unit: def.unit,
        });
      }
    }
    return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [definitions]);

  const selectedMetricKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const chart of charts) {
      for (const metricKey of chart.metrics) keys.add(metricKey);
    }
    return Array.from(keys);
  }, [charts]);

  useEffect(() => {
    if (!uuid || isRealtime || !selectedView.hours || selectedMetricKeys.length === 0) {
      setMetricData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    call<any, QueryMetricsResponse>(
      "public:queryMetrics",
      {
        metric_keys: selectedMetricKeys,
        entity_id: uuid,
        hours: selectedView.hours,
        downsample: true,
        max_points: HISTORY_MAX_POINTS,
        aggregation,
        fill_empty: true,
      },
      { timeout: 30000 },
    )
      .then((result) => {
        if (!active) return;
        setMetricData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Error");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [aggregation, call, isRealtime, selectedMetricKeys, selectedView.hours, uuid]);

  useEffect(() => {
    const needsPingStats = selectedMetricKeys.includes("ping.latency_ms");
    if (!uuid || !needsPingStats) {
      setPingStats([]);
      return;
    }

    let active = true;
    call<any, PingMetricStatsResponse>(
      "public:getPingMetricStats",
      {
        entity_id: uuid,
        hours: selectedView.hours ?? 1,
        max_points: HISTORY_MAX_POINTS,
      },
      { timeout: 30000 },
    )
      .then((result) => {
        if (active) setPingStats(Array.isArray(result?.stats) ? result.stats : []);
      })
      .catch(() => {
        if (active) setPingStats([]);
      });

    return () => {
      active = false;
    };
  }, [call, selectedMetricKeys, selectedView.hours, uuid]);

  const pingStatsMap = useMemo(() => {
    const map = new Map<string, PingMetricStat>();
    for (const stat of pingStats) {
      map.set(`${stat.entity_id}:${stat.task_id}`, stat);
    }
    return map;
  }, [pingStats]);

  const hiddenKey = (chartId: string, series: RenderSeries) =>
    `${chartId}:${series.stableKey}`;

  const isSeriesHidden = (chartId: string, series: RenderSeries) =>
    hiddenSeries[hiddenKey(chartId, series)] === true;

  const toggleSeries = (chartId: string, series: RenderSeries) => {
    const key = hiddenKey(chartId, series);
    setHiddenSeries((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const toggleAllSeries = (chartId: string, series: RenderSeries[]) => {
    const allHidden = series.length > 0 && series.every((item) => isSeriesHidden(chartId, item));
    setHiddenSeries((current) => {
      const next = { ...current };
      for (const item of series) {
        next[hiddenKey(chartId, item)] = !allHidden;
      }
      return next;
    });
  };

  const updateChart = (id: string, updater: (chart: DashboardChart) => DashboardChart) => {
    setDashboard((current) => normalizeDashboard(current).map((chart) => (chart.id === id ? updater(chart) : chart)));
  };

  const addChart = (metricKey: string) => {
    if (!metricKey) return;
    setDashboard((current) => {
      const normalized = normalizeDashboard(current);
      const nextIndex = normalized.length + 1;
      const title = getMetricLabel(metricKey, definitionMap);
      return [
        ...normalized,
        {
          id: `custom-${Date.now()}`,
          title: title || `Chart ${nextIndex}`,
          metrics: [metricKey],
          size: "medium",
        },
      ];
    });
  };

  const removeChart = (id: string) => {
    setDashboard((current) => normalizeDashboard(current).filter((chart) => chart.id !== id));
  };

  const resetDashboard = () => {
    setDashboard(DEFAULT_DASHBOARD);
  };

  const addMetric = (chartId: string, metricKey: string) => {
    updateChart(chartId, (chart) => {
      if (!metricKey || chart.metrics.includes(metricKey)) return chart;
      return {
        ...chart,
        metrics: [...chart.metrics, metricKey],
      };
    });
  };

  const removeMetric = (chartId: string, metricKey: string) => {
    updateChart(chartId, (chart) => ({
      ...chart,
      metrics: chart.metrics.filter((item) => item !== metricKey),
    }));
  };

  const setChartSize = (chartId: string, size: ChartSize) => {
    updateChart(chartId, (chart) => ({ ...chart, size }));
  };

  return (
    <Flex direction="column" align="center" gap="4" className="w-full max-w-screen">
      <div className="w-full overflow-x-auto px-2">
        <div className="w-max mx-auto">
          <SegmentedControl.Root value={selectedView.key} onValueChange={setViewKey}>
            {timeViews.map((view) => (
              <SegmentedControl.Item key={view.key} value={view.key} className="capitalize">
                {view.label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
        </div>
      </div>

      <Card className="w-full max-w-[1100px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="size-4 text-muted-foreground" />
              <span>{t("chart.dashboard", "Charts")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <span>{t("chart.samplingAlgorithm", "Sampling algorithm")}</span>
                <Tips mode="popup" side="top">
                  <span
                    className="block max-w-72"
                    dangerouslySetInnerHTML={{
                      __html: t("chart.samplingAlgorithmTips"),
                    }}
                  />
                </Tips>
              </div>
              <Select.Root value={aggregation} onValueChange={(value) => setAggregation(value as Aggregation)}>
                <Select.Trigger aria-label={t("chart.samplingAlgorithm", "Sampling algorithm")} />
                <Select.Content>
                  {AGGREGATIONS.map((item) => (
                    <Select.Item key={item.value} value={item.value}>
                      {t(item.labelKey)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={ewmaEnabled} onCheckedChange={setEwmaEnabled} />
              <span>EWMA</span>
              <Tips mode="popup" side="top">
                <span dangerouslySetInnerHTML={{ __html: t("chart.cutPeak_tips") }} />
              </Tips>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={resetDashboard}>
              <RotateCcw className="size-4" />
              {t("common.reset", "Reset")}
            </Button>
            <Select.Root value="" onValueChange={addChart}>
              <Select.Trigger
                placeholder={t("chart.addChart", "Add chart")}
                aria-label={t("chart.addChart", "Add chart")}
              />
              <Select.Content>
                {metricOptions.map((item) => (
                  <Select.Item key={item.key} value={item.key}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </Card>

      {loading && (
        <div className="w-full text-center">
          <Loading />
        </div>
      )}
      {error && <div className="w-full text-center text-red-500">{error}</div>}

      <div className="grid w-full max-w-[1100px] grid-cols-1 gap-3 lg:grid-cols-3">
        {charts.map((chart) => {
          const built = isRealtime
            ? buildRowsFromRealtime(data, chart, node, pingTaskMap)
            : buildRowsFromMetricSeries(metricData?.series ?? [], chart, definitionMap, pingTaskMap);
          const chartRows = applyEwma(built.rows, built.series, ewmaEnabled);
          const chartConfig = toChartConfig(built.series);
          const isPercentOnly =
            built.series.length > 0 && built.series.every((item) => item.kind === "percent");
          const latestText = getLatestText(chartRows, built.series);
          const allHidden = built.series.length > 0 && built.series.every((item) => isSeriesHidden(chart.id, item));

          return (
            <Card
              key={chart.id}
              className={cn("flex min-w-0 flex-col gap-3", chartSizeClass[chart.size])}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ChartLine className="size-4 shrink-0 text-muted-foreground" />
                    <h2 className="truncate text-lg font-bold">{chart.title}</h2>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {latestText}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <SegmentedControl.Root
                    size="1"
                    value={chart.size}
                    onValueChange={(value) => setChartSize(chart.id, value as ChartSize)}
                  >
                    <SegmentedControl.Item value="small">S</SegmentedControl.Item>
                    <SegmentedControl.Item value="medium">M</SegmentedControl.Item>
                    <SegmentedControl.Item value="large">L</SegmentedControl.Item>
                  </SegmentedControl.Root>
                  <button
                    type="button"
                    title={t("common.delete", "Delete")}
                    aria-label={t("common.delete", "Delete")}
                    onClick={() => removeChart(chart.id)}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent-4 hover:text-accent-12"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {built.series.length > 0 && (
                  <button
                    type="button"
                    title={allHidden ? t("chart.showAll") : t("chart.hideAll")}
                    aria-label={allHidden ? t("chart.showAll") : t("chart.hideAll")}
                    onClick={() => toggleAllSeries(chart.id, built.series)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent-4 hover:text-accent-12"
                  >
                    {allHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                )}
                {built.series.length > 0
                  ? built.series.map((item) => {
                      const hidden = isSeriesHidden(chart.id, item);
                      const stat =
                        item.metricKey === "ping.latency_ms" && item.tags?.task_id
                          ? pingStatsMap.get(`${uuid}:${item.tags.task_id}`)
                          : undefined;
                      return (
                        <Tips
                          key={item.stableKey}
                          mode="popup"
                          side="top"
                          trigger={
                            <span
                              className={cn(
                                "inline-flex max-w-full items-center overflow-hidden rounded-md text-xs transition-colors",
                                hidden
                                  ? "bg-accent-2 text-muted-foreground"
                                  : "bg-accent-3 text-accent-12",
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => toggleSeries(chart.id, item)}
                                className="inline-flex min-w-0 items-center gap-1 px-2 py-1"
                              >
                                <span
                                  className="size-2 shrink-0 rounded-[2px]"
                                  style={{ backgroundColor: hidden ? "var(--gray-8)" : item.color }}
                                />
                                <span className={cn("truncate", hidden && "line-through")}>{item.label}</span>
                              </button>
                              <button
                                type="button"
                                title={t("chart.removeMetric", "Remove metric")}
                                aria-label={t("chart.removeMetric", "Remove metric")}
                                onClick={() => removeMetric(chart.id, item.metricKey)}
                                className="self-stretch px-1.5 text-muted-foreground hover:bg-accent-4 hover:text-accent-12"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          }
                        >
                          {stat ? (
                            <PingStatTooltip stat={stat} t={t} />
                          ) : (
                            <span>{item.label}</span>
                          )}
                        </Tips>
                      );
                    })
                  : chart.metrics.map((metricKey, index) => (
                      <span
                        key={metricKey}
                        className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent-3 px-2 py-1 text-xs"
                      >
                        <span
                          className="size-2 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }}
                        />
                        <span className="truncate">{getMetricLabel(metricKey, definitionMap)}</span>
                        <button
                          type="button"
                          title={t("chart.removeMetric", "Remove metric")}
                          aria-label={t("chart.removeMetric", "Remove metric")}
                          onClick={() => removeMetric(chart.id, metricKey)}
                          className="rounded-sm text-muted-foreground hover:text-accent-12"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                <Select.Root value="" onValueChange={(value) => addMetric(chart.id, value)}>
                  <Select.Trigger
                    placeholder="+"
                    aria-label={t("chart.addMetric", "Add metric")}
                    className="h-7 w-8"
                  />
                  <Select.Content>
                    {metricOptions.map((item) => (
                      <Select.Item key={item.key} value={item.key}>
                        {item.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </div>

              {chartRows.length === 0 || built.series.length === 0 ? (
                <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                  {t("common.none")}
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="min-h-[220px]">
                  <LineChart
                    data={chartRows}
                    accessibilityLayer
                    margin={{ top: 8, right: 16, bottom: 0, left: 16 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      tickFormatter={timeFormatter(selectedView.hours, chartRows.length)}
                      interval="preserveStartEnd"
                      minTickGap={30}
                      allowDuplicatedCategory={false}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={isPercentOnly ? [0, 100] : undefined}
                      tickFormatter={(value, index) => {
                        if (index === 0) return "";
                        const first = built.series[0];
                        return first ? formatValue(Number(value), first.kind) : String(value);
                      }}
                      orientation="left"
                      type="number"
                      tick={{ dx: -10 }}
                      mirror={true}
                    />
                    <ChartTooltip
                      cursor={false}
                      formatter={(value, name) => {
                        const item = built.series.find((series) => series.dataKey === name);
                        return formatValue(value, item?.kind ?? "raw");
                      }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={labelFormatter(selectedView.hours)}
                          indicator="dot"
                        />
                      }
                    />
                    {built.series.map((item) => (
                      <Line
                        key={item.dataKey}
                        dataKey={item.dataKey}
                        name={item.dataKey}
                        stroke={item.color}
                        dot={false}
                        isAnimationActive={false}
                        strokeWidth={2}
                        connectNulls={true}
                        type="linear"
                        hide={isSeriesHidden(chart.id, item)}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              )}
            </Card>
          );
        })}
      </div>
    </Flex>
  );
};

export default memo(LoadChart);
