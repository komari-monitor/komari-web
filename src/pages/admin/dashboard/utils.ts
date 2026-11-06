import type { TFunction } from "i18next";
import type { Transition } from "motion/react";
import { MOTION_DURATION, MOTION_EASE, MOTION_SPRING } from "@/lib/motion";
import type { MetricSeries } from "@/types/metrics";
import { PING_LATENCY_METRIC } from "@/utils/metricSeries";
import { formatBytes, formatSpeed } from "@/utils/unitHelper";

export const EXPIRING_SOON_DAYS = 7;
export const DAY_MS = 24 * 3600 * 1000;

// 指标键定义在预取登记里（预取与页面用同一份），这里转导出
export {
  CPU_METRIC_KEYS,
  MEM_METRIC_KEYS,
  NET_METRIC_KEYS,
  NET_TOTAL_METRIC_KEYS,
} from "@/routeQueries/dashboard";
export const PING_METRIC_KEYS = [PING_LATENCY_METRIC];

// 迷你图弹层的查询结果缓存，仪表盘刷新时清空
export const miniChartCache = new Map<string, MetricSeries[]>();


export const formatPeakTime = (t: TFunction, timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (timestamp >= startOfToday) {
    return `${t("dashboard.today", "Today")} ${time}`;
  }
  if (timestamp >= startOfToday - DAY_MS) {
    return `${t("dashboard.yesterday", "Yesterday")} ${time}`;
  }
  return `${date.toLocaleDateString()} ${time}`;
};

export const latencyColor = (ms: number): "green" | "yellow" | "red" =>
  ms < 100 ? "green" : ms <= 280 ? "yellow" : "red";

export const volatilityColor = (value: number): "green" | "yellow" | "red" =>
  value < 0.3 ? "green" : value <= 1 ? "yellow" : "red";

export const formatMetricValue = (metricKey: string, value: number): string => {
  if (metricKey === "net.in.rate" || metricKey === "net.out.rate") {
    return formatSpeed(value);
  }
  if (metricKey === "memory.used") {
    return formatBytes(value);
  }
  if (metricKey === PING_LATENCY_METRIC) {
    return `${Math.round(value)} ms`;
  }
  return `${value.toFixed(1)}%`;
};

// 排行 / 到期列表行的进出场与补位动画（规则见 ExpiryWidget 里的说明）。
// 默认是弹簧补位；流量排行沿用原来的 MOTION_TRANSITION，单独传入 transition。
export const rankRowMotion = (
  layoutDependency: string,
  transition: Transition = {
    layout: MOTION_SPRING.layout,
    y: MOTION_SPRING.layout,
    opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
  },
) => ({
  layout: "position" as const,
  layoutDependency,
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97 },
  transition,
});
