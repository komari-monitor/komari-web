import { memo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Flex } from "@radix-ui/themes";
import { AnimatePresence } from "motion/react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Collapse } from "@/components/motion";
import { useNodeList } from "@/contexts/NodeListContext";
import type { RecordFormat } from "@/utils/RecordHelper";
import { hasRealtimeSource } from "./loadChart/catalog";
import ChartCard from "./loadChart/ChartCard";
import ChartToolbar from "./loadChart/ChartToolbar";
import { STACK_COLLAPSE_TRANSITION, STACK_COLLAPSE_VARIANTS } from "./loadChart/constants";
import CustomRangePanel from "./loadChart/CustomRangePanel";
import { buildChartView } from "./loadChart/series";
import TimeViewSelector from "./loadChart/TimeViewSelector";
import { ChartFlipProvider, useChartFlip } from "./loadChart/useChartFlip";
import { useChartPreferences } from "./loadChart/useChartPreferences";
import { useDashboard } from "./loadChart/useDashboard";
import { useMetricCatalog } from "./loadChart/useMetricCatalog";
import { useMetricQueries } from "./loadChart/useMetricQueries";
import { useTimeRange } from "./loadChart/useTimeRange";

type LoadChartProps = {
  data: RecordFormat[];
  /** 实时历史（/api/recent）还没拉到当前服务器的数据 */
  realtimeLoading?: boolean;
  onRealtimeActiveChange?: (active: boolean) => void;
};

/*
  详情页的指标图表区：时间范围 → 自定义范围 → 工具栏 → 可拖拽排序的图表网格。
  数据与状态分在 loadChart/ 下的 hook 里：
  - useMetricCatalog：指标定义与延迟任务；
  - useTimeRange：时间范围视图与自定义范围；
  - useChartPreferences：localStorage 里的采样算法 / EWMA / 隐藏曲线；
  - useDashboard：图表卡片列表与全局模板；
  - useMetricQueries：历史指标与延迟统计查询。
*/
const LoadChart = ({ data = [], realtimeLoading = false, onRealtimeActiveChange }: LoadChartProps) => {
  const { t } = useTranslation();
  const { uuid } = useParams<{ uuid: string }>();
  const { nodeList } = useNodeList();
  const node = nodeList?.find((item) => item.uuid === uuid);
  const { maxMetricRetentionDays, definitionMap, pingTaskMap, metricOptions } =
    useMetricCatalog();
  const timeRange = useTimeRange(maxMetricRetentionDays, onRealtimeActiveChange);
  const { isRealtime } = timeRange;
  const preferences = useChartPreferences();
  const dashboard = useDashboard(definitionMap);
  const { charts } = dashboard;
  // 改尺寸 / 增删 / 重置：相关卡片从旧位置、旧尺寸平滑过渡到新格子（拖放重排不经过这里）
  const flip = useChartFlip(charts);
  const { metricSeries, metricKeys, metricsLoading, error, pingStatsMap } = useMetricQueries({
    uuid,
    charts,
    isRealtime,
    metricRangeParams: timeRange.metricRangeParams,
    aggregation: preferences.aggregation,
  });
  const chartSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    // 图表区：时间范围 → 工具栏 → 图表网格之间 block；宽度铺满主列，左右边缘与页头信息卡对齐
    <Flex direction="column" gap="4" className="km-load-chart w-full min-w-0">
      <TimeViewSelector
        timeViews={timeRange.timeViews}
        value={timeRange.selectedView.key}
        onChange={timeRange.setViewKey}
      />

      <CustomRangePanel
        open={timeRange.isCustomRange}
        draft={timeRange.customDraftRange}
        error={timeRange.customRangeError}
        onDraftChange={timeRange.updateCustomDraft}
        onSelectRecentRange={timeRange.selectRecentRange}
        onApply={timeRange.applyCustomRange}
      />

      <ChartToolbar
        aggregation={preferences.aggregation}
        onAggregationChange={preferences.setAggregation}
        ewmaEnabled={preferences.ewmaEnabled}
        onEwmaChange={preferences.setEwmaEnabled}
        savingGlobalTemplate={dashboard.savingGlobalTemplate}
        onSaveGlobalTemplate={dashboard.saveGlobalTemplate}
        onReset={() => {
          flip.capture();
          dashboard.resetDashboard();
        }}
        metricOptions={metricOptions}
        onAddChart={(metricKey) => {
          flip.capture();
          dashboard.addChart(metricKey);
        }}
      />

      {/*
        加载不再在图表上方插一块「加载中」（它会把整片图表往下推再弹回来）：
        每张卡片在原位进入骨架态。错误提示用 Collapse 展开/收起，不跳。
      */}
      <Collapse
        open={!!error}
        variants={STACK_COLLAPSE_VARIANTS}
        transition={STACK_COLLAPSE_TRANSITION}
        className="w-full"
      >
        <div className="w-full text-center text-red-500">{error}</div>
      </Collapse>

      <DndContext
        sensors={chartSensors}
        collisionDetection={closestCenter}
        onDragStart={flip.cancel}
        onDragEnd={dashboard.handleChartDragEnd}
      >
        <SortableContext
          items={charts.map((chart) => chart.id)}
          strategy={rectSortingStrategy}
        >
          {/*
            content 层：图表卡片各自淡入落位，删除时淡出（popLayout：退场卡片立即脱离网格，其余卡片同时补位）。
            网格容器不开 layout：它是 useSortable 卡片的父层，layout 会在拖放落下后再补一次位移；
            S/M/L 改尺寸时还会对整块网格做尺寸补间，图表文字和坐标轴被拉伸。
            尺寸/位置过渡由 useChartFlip 在每张卡片内层用真实宽高完成。
            relative：退场卡片 absolute 定位的参照。
          */}
          <ChartFlipProvider value={flip.register}>
          <div className="km-load-chart-canvas relative grid w-full grid-cols-1 gap-km-block lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
            {charts.map((chart) => {
              // 这张卡片依赖的数据还在路上：历史指标请求中，或实时模式下当前服务器的 recent 还没到
              const chartUsesRealtime = isRealtime && chart.metrics.some(hasRealtimeSource);
              const chartBusy =
                (metricsLoading && chart.metrics.some((metricKey) => metricKeys.includes(metricKey))) ||
                (chartUsesRealtime && realtimeLoading);

              return (
                <ChartCard
                  key={chart.id}
                  chart={chart}
                  view={buildChartView({
                    chart,
                    metricSeries,
                    records: data,
                    node,
                    definitionMap,
                    pingTaskMap,
                    isRealtime,
                    ewmaEnabled: preferences.ewmaEnabled,
                    t,
                  })}
                  busy={chartBusy}
                  displayRangeHours={timeRange.displayRangeHours}
                  onSizeChange={(chartId, size) => {
                    flip.capture(chartId);
                    dashboard.setChartSize(chartId, size);
                  }}
                  onRemove={(chartId) => {
                    flip.capture();
                    dashboard.removeChart(chartId);
                  }}
                  legendProps={{
                    uuid,
                    pingStatsMap,
                    definitionMap,
                    metricOptions,
                    isSeriesHidden: preferences.isSeriesHidden,
                    toggleSeries: preferences.toggleSeries,
                    toggleAllSeries: preferences.toggleAllSeries,
                    addMetric: dashboard.addMetric,
                    removeMetric: dashboard.removeMetric,
                  }}
                />
              );
            })}
            </AnimatePresence>
          </div>
          </ChartFlipProvider>
        </SortableContext>
      </DndContext>
    </Flex>
  );
};

export default memo(LoadChart);
