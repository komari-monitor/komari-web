import { useEffect, useMemo, useState } from "react";
import { Card, Switch } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_TRANSITION, SKELETON_MOTION } from "@/lib/motion";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import {
  SkeletonChartShape,
  Skeletonize,
  skeletonText,
} from "@/components/ui/skeleton";
import MetricBoundaryAxisTick from "@/components/MetricBoundaryAxisTick";
import MetricLegendItem from "@/components/MetricLegendItem";
import {
  METRIC_CHART_MARGIN,
  METRIC_LINE_PROPS,
  METRIC_X_AXIS_PROPS,
  METRIC_Y_AXIS_PROPS,
  toMetricChartConfig,
} from "@/components/metricChartShared";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import Tips from "@/components/ui/tips";
import { useRPC2Call } from "@/contexts/RPC2Context";
import type {
  MetricSeries,
  MetricTags,
  PingMetricStat,
  PingMetricStatsResponse,
  PublicPingTask,
  QueryMetricsResponse,
} from "@/types/metrics";
import {
  PING_LATENCY_METRIC,
  applyMetricEwma,
  comparePingTaskOrder,
  countMetricPoints,
  formatRemainingTags,
  metricChartBoundaryTicks,
  metricSeriesColor,
  metricSeriesDataKey,
  metricSeriesKey,
  metricTags,
  normalizeMetricSeriesList,
  pingMetricStatKey,
  pingTaskId,
  pingTaskName,
  sortMetricChartRows,
  toPingMetricStatMap,
  toPingTaskMap,
  trimMetricChartBoundaryRows,
  type MetricChartRow,
} from "@/utils/metricSeries";

type RenderSeries = {
  dataKey: string;
  stableKey: string;
  taskId?: string;
  label: string;
  color: string;
  pointCount: number;
  tags?: MetricTags;
};

type MiniPingChartProps = {
  uuid: string;
  width?: string | number;
  height?: string | number;
  hours?: number;
};

const MiniPingChart = ({
  uuid,
  width = "100%",
  height = 300,
  hours = 12,
}: MiniPingChartProps) => {
  const { t } = useTranslation();
  const { call } = useRPC2Call();
  const [metricSeries, setMetricSeries] = useState<MetricSeries[]>([]);
  const [tasks, setTasks] = useState<PublicPingTask[]>([]);
  const [stats, setStats] = useState<PingMetricStat[]>([]);
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({});
  const [ewmaEnabled, setEwmaEnabled] = useState(false);
  // 有 uuid 时首帧就是加载态：否则会先闪一帧「无」再变成骨架
  const [loading, setLoading] = useState(Boolean(uuid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) {
      setMetricSeries([]);
      setTasks([]);
      setStats([]);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setHiddenLines({});

    const taskRequest = call<unknown, PublicPingTask[]>(
      "public:getPublicPingTasks",
    ).catch(() => []);
    const metricRequest = call<unknown, QueryMetricsResponse>(
      "public:queryMetrics",
      {
        metric_keys: [PING_LATENCY_METRIC],
        entity_id: uuid,
        hours,
        max_points: 240,
        aggregation: "avg",
        fill_empty: true,
      },
      { timeout: 30000 },
    );
    const statsRequest = call<unknown, PingMetricStatsResponse>(
      "public:getPingMetricStats",
      { entity_id: uuid, hours, max_points: 240 },
      { timeout: 30000 },
    ).catch(() => null);

    Promise.all([taskRequest, metricRequest, statsRequest])
      .then(([taskList, result, statsResult]) => {
        if (!active) return;
        setTasks(Array.isArray(taskList) ? taskList : []);
        setMetricSeries(normalizeMetricSeriesList(result?.series));
        setStats(Array.isArray(statsResult?.stats) ? statsResult.stats : []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError instanceof Error ? requestError.message : "Error",
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [call, hours, uuid]);

  const taskMap = useMemo(() => toPingTaskMap(tasks), [tasks]);
  const statsMap = useMemo(() => toPingMetricStatMap(stats), [stats]);

  const built = useMemo(() => {
    const rows = new Map<string, MetricChartRow>();
    const renderSeries: RenderSeries[] = [];

    metricSeries.forEach((series, index) => {
      const tags = metricTags(series);
      const taskId = pingTaskId(tags);
      const taskLabel = taskId
        ? pingTaskName(taskId, taskMap, (id) => `${t("ping.task")} ${id}`)
        : t("ping.task");
      const remainingTags = formatRemainingTags(tags, ["task_id"]);
      const stableKey = metricSeriesKey(series.metric_key, tags);
      const dataKey = metricSeriesDataKey(series.metric_key, tags);
      renderSeries.push({
        dataKey,
        stableKey,
        taskId,
        label: remainingTags ? `${taskLabel} ${remainingTags}` : taskLabel,
        color: metricSeriesColor(index),
        pointCount: countMetricPoints(series),
        tags,
      });

      for (const point of series.points ?? []) {
        const time = new Date(point.time).toISOString();
        const row = rows.get(time) ?? { time };
        row[dataKey] =
          typeof point.value === "number" && point.value >= 0
            ? point.value
            : null;
        rows.set(time, row);
      }
    });

    const orderedSeries = renderSeries
      .sort((left, right) =>
        comparePingTaskOrder(left.tags, right.tags, taskMap),
      )
      .map((series, index) => ({
        ...series,
        color: metricSeriesColor(index),
      }));

    return {
      rows: sortMetricChartRows(Array.from(rows.values())),
      series: orderedSeries,
    };
  }, [metricSeries, t, taskMap]);

  const chartData = useMemo(
    () =>
      trimMetricChartBoundaryRows(
        applyMetricEwma(built.rows, built.series, ewmaEnabled),
        built.series.map((item) => item.dataKey),
      ),
    [built.rows, built.series, ewmaEnabled],
  );

  const chartConfig = useMemo(() => toMetricChartConfig(built.series), [built.series]);
  const chartTicks = useMemo(
    () => metricChartBoundaryTicks(chartData),
    [chartData],
  );

  const labelFormatter = (value: string | number) =>
    new Date(value).toLocaleString([], {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const toggleLine = (dataKey: string) => {
    setHiddenLines((current) => ({ ...current, [dataKey]: !current[dataKey] }));
  };

  const view = loading
    ? "loading"
    : error
      ? "error"
      : chartData.length === 0
        ? "empty"
        : "chart";
  const showChrome = view === "loading" || view === "chart";
  const layerMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: SKELETON_MOTION.reveal.transition.opacity },
    exit: { opacity: 0, transition: MOTION_TRANSITION.fadeOut },
  };

  return (
    <Card
      size="2"
      style={{ width, height }}
      className="km-mini-ping-chart flex min-h-0 flex-col overflow-hidden"
    >
      {/*
        骨架就是图表本身的布局：图例条、图表区、EWMA 行都常驻，加载中由 Skeletonize 把文字画成条、
        图表区显示折线轮廓（SkeletonChartShape），数据到达时在同一批 DOM 上交叉淡化。
        卡片高度固定，加载/错误/空/图表四种状态都在同一块图表区里叠放切换，卡片不变高变矮。
      */}
      <Skeletonize
        loading={loading}
        label={typeof height === "number" && height >= 260}
        // Radix Card 自身是 display:block（覆盖了 flex 类），子元素靠显式 100% 高度撑满卡片
        className="flex min-h-0 flex-col gap-2"
        style={{ height: "100%" }}
      >
        {showChrome && (
          <div className="flex max-h-16 shrink-0 flex-wrap items-center gap-2 overflow-y-auto">
            {view === "loading"
              ? [10, 7].map((chars, index) => (
                  <div
                    key={`placeholder-${index}`}
                    className="inline-flex max-w-full items-center overflow-hidden rounded-md bg-accent-3 text-xs"
                  >
                    <span className="inline-flex min-w-0 items-center gap-1 px-2 py-1">
                      <span className="size-2 shrink-0 rounded-[2px] bg-[var(--gray-a5)]" />
                      <span>{skeletonText(chars)}</span>
                    </span>
                  </div>
                ))
              : built.series.map((item) => {
              const stat = item.taskId
                ? statsMap.get(pingMetricStatKey(uuid, item.taskId))
                : undefined;
              return (
                <MetricLegendItem
                  key={item.stableKey}
                  label={item.label}
                  color={item.color}
                  hidden={hiddenLines[item.dataKey] === true}
                  onToggle={() => toggleLine(item.dataKey)}
                  stat={stat}
                />
              );
            })}
          </div>
        )}

        <div className="km-mini-ping-chart-area relative min-h-0 flex-1">
          <SkeletonChartShape className="px-2 pb-8 pt-4" />
          <AnimatePresence initial={false}>
            {view === "error" && (
              <motion.div
                key="ping-error"
                {...layerMotion}
                className="absolute inset-0 flex items-center justify-center text-red-500"
              >
                {error}
              </motion.div>
            )}
            {view === "empty" && (
              <motion.div
                key="ping-empty"
                {...layerMotion}
                className="absolute inset-0 flex items-center justify-center text-muted-foreground"
              >
                {t("common.none")}
              </motion.div>
            )}
            {view === "chart" && (
              <motion.div key="ping-chart" {...layerMotion} className="absolute inset-0">
                <ChartContainer
                  config={chartConfig}
                  className="km-mini-ping-chart-canvas h-full w-full"
                >
                  <LineChart
                    data={chartData}
                    accessibilityLayer
                    margin={METRIC_CHART_MARGIN}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      {...METRIC_X_AXIS_PROPS}
                      ticks={chartTicks}
                      tick={<MetricBoundaryAxisTick boundaries={chartTicks} />}
                    />
                    <YAxis
                      {...METRIC_Y_AXIS_PROPS}
                      allowDecimals={false}
                      orientation="left"
                      tick={{ dx: 8 }}
                      tickFormatter={(value) => `${value}\u00a0ms`}
                    />
                    <ChartTooltip
                      cursor={false}
                      formatter={(value) =>
                        typeof value === "number" ? `${Math.round(value)} ms` : value
                      }
                      content={
                        <ChartTooltipContent
                          labelFormatter={labelFormatter}
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
                        dot={item.pointCount <= 30}
                        isAnimationActive={false}
                        {...METRIC_LINE_PROPS}
                        hide={hiddenLines[item.dataKey] === true}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showChrome && (
          <div className="flex shrink-0 items-center gap-2">
            <Switch
              size="1"
              checked={ewmaEnabled}
              onCheckedChange={setEwmaEnabled}
              aria-label="EWMA"
            />
            <span className="text-sm font-medium">EWMA</span>
            <Tips mode="auto" side="top">
              <span
                dangerouslySetInnerHTML={{ __html: t("chart.cutPeak_tips") }}
              />
            </Tips>
          </div>
        )}
      </Skeletonize>
    </Card>
  );
};

export default MiniPingChart;