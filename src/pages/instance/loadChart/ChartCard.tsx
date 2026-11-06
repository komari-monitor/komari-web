import type { Ref } from "react";
import { SegmentedControl } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { ChartLine, Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeletonize, SkeletonChartShape } from "@/components/ui/skeleton";
import { AutoHeight } from "@/components/motion";
import MetricBoundaryAxisTick from "@/components/MetricBoundaryAxisTick";
import {
  METRIC_CHART_MARGIN,
  METRIC_LINE_PROPS,
  METRIC_X_AXIS_PROPS,
  METRIC_Y_AXIS_PROPS,
} from "@/components/metricChartShared";
import ChartLegend, { type ChartLegendProps } from "./ChartLegend";
import { formatValue, labelFormatter } from "./format";
import type { ChartView } from "./series";
import SortableChartCard from "./SortableChartCard";
import type { ChartSize, DashboardChart } from "./types";

type ChartCardProps = {
  chart: DashboardChart;
  view: ChartView;
  /** 这张卡片依赖的数据还在路上：卡片原位进入骨架态 */
  busy: boolean;
  /** 提示框时间格式：不足 24 小时只显示时分秒 */
  displayRangeHours: number | undefined;
  onSizeChange: (chartId: string, size: ChartSize) => void;
  onRemove: (chartId: string) => void;
  legendProps: Omit<ChartLegendProps, "chart" | "series">;
  /** AnimatePresence（popLayout）注入的 ref，转给可拖拽的网格节点 */
  ref?: Ref<HTMLDivElement>;
};

/** 一张可拖拽排序的指标图表卡片：标题与最新值、S/M/L 尺寸、删除；图例；折线图 */
const ChartCard = ({
  chart,
  view,
  busy,
  displayRangeHours,
  onSizeChange,
  onRemove,
  legendProps,
  ref,
}: ChartCardProps) => {
  const { t } = useTranslation();
  const showEmpty = view.rows.length === 0 || view.series.length === 0;

  return (
    <SortableChartCard
      ref={ref}
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
            {view.latestText}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <SegmentedControl.Root
            size="1"
            value={chart.size}
            onValueChange={(value) => onSizeChange(chart.id, value as ChartSize)}
          >
            <SegmentedControl.Item value="small">S</SegmentedControl.Item>
            <SegmentedControl.Item value="medium">M</SegmentedControl.Item>
            <SegmentedControl.Item value="large">L</SegmentedControl.Item>
          </SegmentedControl.Root>
          <button
            type="button"
            title={t("common.delete", "Delete")}
            aria-label={t("common.delete", "Delete")}
            onClick={() => onRemove(chart.id)}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent-4 hover:text-accent-12"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/*
        图例与图表主体：数据在路上时原位进入骨架态（旧曲线淡出、出现折线轮廓），
        到达后同一批 DOM 淡回内容，卡片尺寸不变。图例行数变化由 AutoHeight 弹簧过渡。
      */}
      <Skeletonize loading={busy} className="flex min-w-0 flex-col gap-km-group">
      <AutoHeight>
      <ChartLegend chart={chart} series={view.series} {...legendProps} />
      </AutoHeight>

      {/* 空态与图表共用同一个固定比例的盒子：有无数据卡片都一样高，切换不跳 */}
      {/* 主列铺满后宽卡片会按 16:9 变得很高：上限与原先 1100px 内容宽时的 L 图表高度一致 */}
      <div className="km-load-chart-body relative aspect-video min-h-[220px] max-h-[600px] w-full">
      <SkeletonChartShape />
      {showEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {busy ? null : t("common.none")}
        </div>
      ) : (
        <ChartContainer config={view.config} className="absolute inset-0 aspect-auto h-full min-h-0 w-full">
          <LineChart
            data={view.rows}
            accessibilityLayer
            margin={METRIC_CHART_MARGIN}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              {...METRIC_X_AXIS_PROPS}
              ticks={view.ticks}
              tick={<MetricBoundaryAxisTick boundaries={view.ticks} />}
              allowDuplicatedCategory={false}
            />
            {view.axes.map((axis) => (
              <YAxis
                {...METRIC_Y_AXIS_PROPS}
                key={axis.id}
                yAxisId={axis.id}
                domain={axis.kind === "percent" ? [0, 100] : undefined}
                tickFormatter={(value) =>
                  formatValue(Number(value), axis.kind).replace(
                    / /g,
                    "\u00a0",
                  )
                }
                orientation={axis.orientation}
                tick={{ dx: axis.orientation === "left" ? 8 : -8 }}
              />
            ))}
            <ChartTooltip
              cursor={false}
              formatter={(value, name) => {
                const item = view.series.find((series) => series.dataKey === name);
                return formatValue(value, item?.kind ?? "raw");
              }}
              content={
                <ChartTooltipContent
                  labelFormatter={labelFormatter(displayRangeHours)}
                  indicator="dot"
                />
              }
            />
            {view.series.map((item) => (
              <Line
                key={item.dataKey}
                dataKey={item.dataKey}
                name={item.dataKey}
                yAxisId={item.yAxisId}
                stroke={item.color}
                dot={item.pointCount !== undefined && item.pointCount <= 30}
                isAnimationActive={false}
                {...METRIC_LINE_PROPS}
                hide={legendProps.isSeriesHidden(chart.id, item)}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
      </div>
      </Skeletonize>
    </SortableChartCard>
  );
};

export default ChartCard;
