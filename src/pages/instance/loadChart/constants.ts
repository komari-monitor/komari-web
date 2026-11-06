import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import { SPACE } from "@/lib/spacing";
import { PING_LATENCY_METRIC } from "@/utils/metricSeries";
import type { Aggregation, DashboardChart } from "./types";

export const MAX_REALTIME_POINTS = 30 * 5;
export const HISTORY_MAX_POINTS = 700;
export const DASHBOARD_TEMPLATE_KEY = "chartDashboardTemplate";
export const CUSTOM_RANGE_DEFAULT_DAYS = 24;

export const AGGREGATIONS: Array<{ value: Aggregation; labelKey: string }> = [
  { value: "avg", labelKey: "chart.avg" },
  { value: "min", labelKey: "chart.sampling.min" },
  { value: "max", labelKey: "chart.sampling.max" },
  { value: "first", labelKey: "chart.sampling.first" },
  { value: "last", labelKey: "chart.sampling.last" },
  { value: "stddev", labelKey: "chart.sampling.stddev" },
  { value: "p70", labelKey: "chart.sampling.p70" },
  { value: "p95", labelKey: "chart.sampling.p95" },
  { value: "p99", labelKey: "chart.sampling.p99" },
];

export const DEFAULT_DASHBOARD: DashboardChart[] = [
  {
    id: "cpu",
    title: "CPU",
    metrics: ["cpu.usage", "load.average"],
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
    metrics: [
      "net.in.rate",
      "net.out.rate",
      "net.total.down",
      "net.total.up",
    ],
    size: "large",
  },
  {
    id: "ping",
    title: "Latency",
    metrics: [PING_LATENCY_METRIC],
    size: "large",
  },
];

/*
  图表区是 gap block 的纵向栈：自定义范围 / 错误提示收起时高度为 0，
  但 flex gap 仍在，会在上下两块之间多出一份 block。收起态用负 marginTop 把这份 gap 收回，
  数值必须等于栈的 gap（SPACE.block）。
*/
export const STACK_COLLAPSE_VARIANTS = {
  open: { height: "auto", opacity: 1, marginTop: 0 },
  closed: { height: 0, opacity: 0, marginTop: -SPACE.block },
};
export const STACK_COLLAPSE_TRANSITION = {
  height: MOTION_SPRING.soft,
  marginTop: MOTION_SPRING.soft,
  opacity: MOTION_TRANSITION.fade,
};
