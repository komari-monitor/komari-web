import { PING_LATENCY_METRIC } from "@/utils/metricSeries";
import type { MetricCatalogItem, MetricDefinition, MetricKind } from "./types";

export const fallbackCatalog: MetricCatalogItem[] = [
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

export const fallbackCatalogMap = new Map(fallbackCatalog.map((item) => [item.key, item]));

/** 实时模式下这个指标能直接从 /api/recent 的记录里取值（不用查历史） */
export const hasRealtimeSource = (metricKey: string) => {
  const metric = fallbackCatalogMap.get(metricKey);
  return !!metric?.realtimeValue || !!metric?.realtimeTaggedValues;
};

export const getMetricKind = (metricKey: string, unit?: string): MetricKind => {
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

export const getMetricLabel = (
  metricKey: string,
  definitions: Map<string, MetricDefinition>,
) => {
  const fallback = fallbackCatalogMap.get(metricKey);
  if (fallback) return fallback.label;
  const def = definitions.get(metricKey);
  return def?.description || def?.name || metricKey;
};
