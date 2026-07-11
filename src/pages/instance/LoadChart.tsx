import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, Flex, SegmentedControl, Select, Switch } from "@radix-ui/themes";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  ChartLine,
  Eye,
  EyeOff,
  Menu,
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
import MetricBoundaryAxisTick from "@/components/MetricBoundaryAxisTick";
import PingMetricStatContent from "@/components/PingMetricStatContent";
import Tips from "@/components/ui/tips";
import { useNodeList } from "@/contexts/NodeListContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";
import type {
  MetricSeries,
  PingMetricStat,
  PingMetricStatsResponse,
  PublicPingTask,
  QueryMetricsResponse,
} from "@/types/metrics";
import {
  PING_LATENCY_METRIC,
  applyMetricEwma,
  formatRemainingTags,
  isPingMetric,
  metricChartBoundaryTicks,
  metricSeriesColor,
  metricSeriesDataKey,
  metricSeriesKey,
  metricTags,
  metricTagsKey,
  normalizeMetricSeriesList,
  pingMetricStatKey,
  pingTaskId,
  pingTaskName,
  type MetricChartRow,
} from "@/utils/metricSeries";
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

type RenderSeries = {
  dataKey: string;
  stableKey: string;
  metricKey: string;
  label: string;
  color: string;
  kind: MetricKind;
  unit?: string;
  yAxisId?: "left" | "right";
  tags?: Record<string, string>;
};

type BuiltChartData = {
  rows: MetricChartRow[];
  series: RenderSeries[];
};

type ChartAxis = {
  id: "left" | "right";
  kind: MetricKind;
  orientation: "left" | "right";
};

type PreparedChartData = BuiltChartData & {
  axes: ChartAxis[];
};

type TimeView = {
  key: string;
  label: string;
  hours?: number;
};

const MAX_REALTIME_POINTS = 30 * 5;
const HISTORY_MAX_POINTS = 700;

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
    metrics: [PING_LATENCY_METRIC],
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
    key: PING_LATENCY_METRIC,
    label: "Ping",
    kind: "milliseconds",
    unit: "ms",
  },
];

const fallbackCatalogMap = new Map(fallbackCatalog.map((item) => [item.key, item]));

const formatTags = (
  metricKey: string,
  tags: Record<string, string> | undefined,
  pingTaskMap: ReadonlyMap<string, PublicPingTask>,
  t: ReturnType<typeof useTranslation>["t"],
) => {
  if (!tags || Object.keys(tags).length === 0) return "";

  const taskId = pingTaskId(tags);
  if (isPingMetric(metricKey) && taskId) {
    const taskLabel = pingTaskName(
      taskId,
      pingTaskMap,
      (id) => `${t("ping.task")} ${id}`,
    );
    const remaining = formatRemainingTags(tags, ["task_id"]);
    return remaining ? `${taskLabel} ${remaining}` : taskLabel;
  }

  if (tags.device_name) {
    const remaining = formatRemainingTags(tags, ["device_name", "device_index"]);
    return remaining ? `${tags.device_name} ${remaining}` : String(tags.device_name);
  }
  if (tags.device_index !== undefined) {
    const deviceLabel = `GPU ${Number(tags.device_index) + 1}`;
    const remaining = formatRemainingTags(tags, ["device_index"]);
    return remaining ? `${deviceLabel} ${remaining}` : deviceLabel;
  }
  if (taskId) {
    const taskLabel = `${t("ping.task")} ${taskId}`;
    const remaining = formatRemainingTags(tags, ["task_id"]);
    return remaining ? `${taskLabel} ${remaining}` : taskLabel;
  }
  return formatRemainingTags(tags);
};

const formatSeriesLabel = (
  metricKey: string,
  tags: Record<string, string> | undefined,
  definitions: Map<string, MetricDefinition>,
  pingTaskMap: ReadonlyMap<string, PublicPingTask>,
  t: ReturnType<typeof useTranslation>["t"],
) => {
  const tagLabel = formatTags(metricKey, tags, pingTaskMap, t);
  if (metricKey === PING_LATENCY_METRIC && tagLabel) return tagLabel;
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
  pingTaskMap: ReadonlyMap<string, PublicPingTask>,
  t: ReturnType<typeof useTranslation>["t"],
) => {
  const rows = new Map<string, Record<string, string | number | null>>();
  const renderSeries: RenderSeries[] = [];

  metricSeries
    .filter((series) => chart.metrics.includes(series.metric_key))
    .forEach((series, index) => {
      const tags = metricTags(series);
      const stableKey = metricSeriesKey(series.metric_key, tags);
      const dataKey = metricSeriesDataKey(series.metric_key, tags);
      const label = formatSeriesLabel(series.metric_key, tags, definitions, pingTaskMap, t);
      const kind = getMetricKind(series.metric_key, series.unit);
      renderSeries.push({
        dataKey,
        stableKey,
        metricKey: series.metric_key,
        label,
        color: metricSeriesColor(index),
        kind,
        unit: series.unit,
        tags,
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
  pingTaskMap: ReadonlyMap<string, PublicPingTask>,
  t: ReturnType<typeof useTranslation>["t"],
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
          const key = `${metricKey}:${metricTagsKey(tagged.tags)}`;
          let item = seriesIndex.get(key);
          if (!item) {
            const tagLabel = formatTags(metricKey, tagged.tags, pingTaskMap, t);
            const stableKey = metricSeriesKey(metricKey, tagged.tags);
            item = {
              dataKey: metricSeriesDataKey(metricKey, tagged.tags),
              stableKey,
              metricKey,
              label: tagLabel ? `${metric.label} ${tagLabel}` : metric.label,
              color: metricSeriesColor(renderSeries.length),
              kind: metric.kind,
              unit: metric.unit,
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
        const stableKey = metricSeriesKey(metricKey);
        item = {
          dataKey: metricSeriesDataKey(metricKey),
          stableKey,
          metricKey,
          label: metric.label,
          color: metricSeriesColor(renderSeries.length),
          kind: metric.kind,
          unit: metric.unit,
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

type SortableChartCardProps = {
  chartId: string;
  children: ReactNode;
  dragLabel: string;
  size: ChartSize;
};

const SortableChartCard = ({
  chartId,
  children,
  dragLabel,
  size,
}: SortableChartCardProps) => {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: chartId });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "min-w-0",
        chartSizeClass[size],
        isDragging && "relative z-10 opacity-80",
      )}
    >
      <Card className="flex h-full min-w-0 flex-col gap-3">
        <div className="-mt-2 flex h-5 shrink-0 items-center justify-center">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="inline-flex h-6 w-10 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent-3 hover:text-accent-12 active:cursor-grabbing"
          >
            <Menu className="size-4" />
            <span className="sr-only">{dragLabel}</span>
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
};

const mergeBuiltChartData = (
  primary: BuiltChartData,
  supplemental: BuiltChartData,
): BuiltChartData => {
  const existingSeries = new Set(primary.series.map((series) => series.stableKey));
  const addedSeries = supplemental.series.filter(
    (series) => !existingSeries.has(series.stableKey),
  );
  if (addedSeries.length === 0) return primary;

  const addedDataKeys = new Set(addedSeries.map((series) => series.dataKey));
  const rows = new Map(primary.rows.map((row) => [String(row.time), { ...row }]));
  for (const row of supplemental.rows) {
    const time = String(row.time);
    const merged = rows.get(time) ?? { time };
    for (const dataKey of addedDataKeys) {
      if (dataKey in row) merged[dataKey] = row[dataKey];
    }
    rows.set(time, merged);
  }

  return {
    rows: Array.from(rows.values()).sort(
      (left, right) =>
        new Date(String(left.time)).getTime() - new Date(String(right.time)).getTime(),
    ),
    series: [...primary.series, ...addedSeries].map((series, index) => ({
      ...series,
      color: metricSeriesColor(index),
    })),
  };
};

const metricUnitKey = (series: RenderSeries) => {
  const unit = series.unit?.trim().toLowerCase();
  return unit ? `unit:${unit}` : `kind:${series.kind}`;
};

const prepareChartData = (
  built: BuiltChartData,
  metricOrder: string[],
): PreparedChartData => {
  const metricPositions = new Map(
    metricOrder.map((metricKey, index) => [metricKey, index]),
  );
  const orderedSeries = [...built.series].sort((left, right) => {
    const positionDelta =
      (metricPositions.get(left.metricKey) ?? Number.MAX_SAFE_INTEGER) -
      (metricPositions.get(right.metricKey) ?? Number.MAX_SAFE_INTEGER);
    if (positionDelta !== 0) return positionDelta;
    if (left.stableKey === right.stableKey) return 0;
    return left.stableKey < right.stableKey ? -1 : 1;
  });

  const unitAxes = new Map<string, "left" | "right">();
  const axes: ChartAxis[] = [];
  const series: RenderSeries[] = [];
  for (const item of orderedSeries) {
    const unitKey = metricUnitKey(item);
    let yAxisId = unitAxes.get(unitKey);
    if (!yAxisId) {
      if (unitAxes.size >= 2) continue;
      yAxisId = unitAxes.size === 0 ? "left" : "right";
      unitAxes.set(unitKey, yAxisId);
      axes.push({ id: yAxisId, kind: item.kind, orientation: yAxisId });
    }
    series.push({
      ...item,
      yAxisId,
      color: metricSeriesColor(series.length),
    });
  }

  const plottedDataKeys = new Set(series.map((item) => item.dataKey));
  const rows = built.rows.map((row) => {
    const plottedRow: MetricChartRow = { time: row.time };
    for (const dataKey of plottedDataKeys) {
      if (dataKey in row) plottedRow[dataKey] = row[dataKey];
    }
    return plottedRow;
  });

  return { rows, series, axes };
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

const LoadChart = ({ data = [], onRealtimeActiveChange }: LoadChartProps) => {
  const { t } = useTranslation();
  const { uuid } = useParams<{ uuid: string }>();
  const { call } = useRPC2Call();
  const { publicInfo } = usePublicInfo();
  const { nodeList } = useNodeList();
  const node = nodeList?.find((item) => item.uuid === uuid);
  const maxMetricRetentionHours = (publicInfo?.metric_retention_days || 90) * 24;
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
  const [pingTasks, setPingTasks] = useState<PublicPingTask[]>([]);
  const [pingStats, setPingStats] = useState<PingMetricStat[]>([]);
  const [metricData, setMetricData] = useState<QueryMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
    call<unknown, PublicPingTask[]>("public:getPublicPingTasks")
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

  const selectedMetricKeySignature = JSON.stringify(
    Array.from(new Set(charts.flatMap((chart) => chart.metrics))).sort(),
  );
  const selectedMetricKeys = useMemo(
    () => JSON.parse(selectedMetricKeySignature) as string[],
    [selectedMetricKeySignature],
  );

  const realtimeFallbackMetricKeys = useMemo(
    () =>
      selectedMetricKeys.filter((metricKey) => {
        const metric = fallbackCatalogMap.get(metricKey);
        return !metric?.realtimeValue && !metric?.realtimeTaggedValues;
      }),
    [selectedMetricKeys],
  );

  const queriedMetricKeys = isRealtime ? realtimeFallbackMetricKeys : selectedMetricKeys;
  const queryHours = isRealtime ? 1 : selectedView.hours;

  useEffect(() => {
    if (!uuid || !queryHours || queriedMetricKeys.length === 0) {
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
        metric_keys: queriedMetricKeys,
        entity_id: uuid,
        hours: queryHours,
        downsample: true,
        max_points: HISTORY_MAX_POINTS,
        aggregation,
        fill_empty: true,
      },
      { timeout: 30000 },
    )
      .then((result) => {
        if (!active) return;
        setMetricData({
          ...result,
          series: normalizeMetricSeriesList(result?.series),
        });
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
  }, [aggregation, call, queriedMetricKeys, queryHours, uuid]);

  useEffect(() => {
    const needsPingStats = selectedMetricKeys.some(isPingMetric);
    if (!uuid || !needsPingStats) {
      setPingStats([]);
      return;
    }

    let active = true;
    call<any, PingMetricStatsResponse>(
      "public:getPingMetricStats",
      {
        entity_id: uuid,
        hours: queryHours ?? 1,
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
  }, [call, queryHours, selectedMetricKeys, uuid]);

  const pingStatsMap = useMemo(() => {
    const map = new Map<string, PingMetricStat>();
    for (const stat of pingStats) {
      map.set(pingMetricStatKey(stat.entity_id, stat.task_id), stat);
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

  const handleChartDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setDashboard((current) => {
      const normalized = normalizeDashboard(current);
      const oldIndex = normalized.findIndex((chart) => chart.id === active.id);
      const newIndex = normalized.findIndex((chart) => chart.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(normalized, oldIndex, newIndex);
    });
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

      <DndContext
        sensors={chartSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleChartDragEnd}
      >
        <SortableContext
          items={charts.map((chart) => chart.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid w-full max-w-[1100px] grid-cols-1 gap-3 lg:grid-cols-3">
            {charts.map((chart) => {
          const metricBuilt = buildRowsFromMetricSeries(
            metricData?.series ?? [],
            chart,
            definitionMap,
            pingTaskMap,
            t,
          );
          const rawBuilt = isRealtime
            ? mergeBuiltChartData(
                buildRowsFromRealtime(data, chart, node, pingTaskMap, t),
                metricBuilt,
              )
            : metricBuilt;
          const built = prepareChartData(rawBuilt, chart.metrics);
          const chartRows = applyMetricEwma(built.rows, built.series, ewmaEnabled);
          const chartTicks = metricChartBoundaryTicks(chartRows);
          const chartConfig = toChartConfig(built.series);
          const latestText = getLatestText(chartRows, built.series);
          const allHidden = built.series.length > 0 && built.series.every((item) => isSeriesHidden(chart.id, item));

          return (
            <SortableChartCard
              key={chart.id}
              chartId={chart.id}
              size={chart.size}
              dragLabel={t("admin.nodeTable.dragToReorder")}
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
                      const taskId = pingTaskId(item.tags);
                      const stat =
                        isPingMetric(item.metricKey) && uuid && taskId
                          ? pingStatsMap.get(pingMetricStatKey(uuid, taskId))
                          : undefined;
                      return (
                        <div
                          key={item.stableKey}
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
                            <span className={cn("truncate", hidden && "line-through")}>
                              {item.label}
                            </span>
                          </button>
                          {stat && (
                            <Tips
                              mode="auto"
                              side="top"
                              className="shrink-0"
                              ariaLabel={`${item.label} ${t("common.details")}`}
                            >
                              <PingMetricStatContent stat={stat} t={t} />
                            </Tips>
                          )}
                          <button
                            type="button"
                            title={t("chart.removeMetric", "Remove metric")}
                            aria-label={t("chart.removeMetric", "Remove metric")}
                            onClick={() => removeMetric(chart.id, item.metricKey)}
                            className="self-stretch px-1.5 text-muted-foreground hover:bg-accent-4 hover:text-accent-12"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      );
                    })
                  : chart.metrics.map((metricKey, index) => (
                      <span
                        key={metricKey}
                        className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent-3 px-2 py-1 text-xs"
                      >
                        <span
                          className="size-2 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: metricSeriesColor(index) }}
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
                <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
                  <LineChart
                    data={chartRows}
                    accessibilityLayer
                    margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      ticks={chartTicks}
                      tick={<MetricBoundaryAxisTick boundaries={chartTicks} />}
                      interval={0}
                      height={32}
                      allowDuplicatedCategory={false}
                    />
                    {built.axes.map((axis) => (
                      <YAxis
                        key={axis.id}
                        yAxisId={axis.id}
                        tickLine={false}
                        axisLine={false}
                        domain={axis.kind === "percent" ? [0, 100] : undefined}
                        tickFormatter={(value) => formatValue(Number(value), axis.kind)}
                        orientation={axis.orientation}
                        type="number"
                        tick={{ dx: axis.orientation === "left" ? 8 : -8 }}
                        width={1}
                        mirror
                      />
                    ))}
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
                        yAxisId={item.yAxisId}
                        stroke={item.color}
                        dot={false}
                        isAnimationActive={false}
                        strokeWidth={2}
                        connectNulls={false}
                        type="linear"
                        hide={isSeriesHidden(chart.id, item)}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              )}
            </SortableChartCard>
          );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </Flex>
  );
};

export default memo(LoadChart);
