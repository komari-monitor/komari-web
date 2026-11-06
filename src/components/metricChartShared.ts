import type { ChartConfig } from "@/components/ui/chart";

/*
  详情页指标图表（pages/instance/LoadChart）与迷你延迟图（MiniPingChart）共用的
  recharts 配置与格式化：边距、只标首尾的时间轴、镜像在图内的数值轴、折线样式。
  动画保持关闭：isAnimationActive={false} 仍写在各自的 <Line> 上。
*/

export const METRIC_CHART_MARGIN = { top: 16, right: 8, bottom: 4, left: 8 };

/** 时间轴：ticks / tick（MetricBoundaryAxisTick）由调用方传入 */
export const METRIC_X_AXIS_PROPS = {
  dataKey: "time",
  tickLine: false,
  axisLine: false,
  interval: 0,
  height: 32,
} as const;

/** 数值轴：镜像画在图内、不占宽度；orientation 与 tick 偏移由调用方传入 */
export const METRIC_Y_AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  type: "number",
  width: 1,
  mirror: true,
} as const;

export const METRIC_LINE_PROPS = {
  strokeWidth: 2,
  connectNulls: false,
  type: "linear",
} as const;

export const formatMilliseconds = (value: number) => `${Math.round(value)} ms`;

export const toMetricChartConfig = (
  series: ReadonlyArray<{ dataKey: string; label: string; color: string }>,
) => {
  const config: ChartConfig = {};
  for (const item of series) {
    config[item.dataKey] = { label: item.label, color: item.color };
  }
  return config;
};
