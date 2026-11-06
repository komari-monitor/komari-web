import { useTranslation } from "react-i18next";
import { Eye, EyeOff, X } from "lucide-react";
import MetricLegendItem from "@/components/MetricLegendItem";
import type { PingMetricStat } from "@/types/metrics";
import {
  isPingMetric,
  metricSeriesColor,
  pingMetricStatKey,
  pingTaskId,
} from "@/utils/metricSeries";
import { getMetricLabel } from "./catalog";
import MetricSelect from "./MetricSelect";
import type {
  DashboardChart,
  MetricCatalogItem,
  MetricDefinition,
  RenderSeries,
} from "./types";

export type ChartLegendProps = {
  chart: DashboardChart;
  series: RenderSeries[];
  uuid: string | undefined;
  pingStatsMap: ReadonlyMap<string, PingMetricStat>;
  definitionMap: Map<string, MetricDefinition>;
  metricOptions: MetricCatalogItem[];
  isSeriesHidden: (chartId: string, series: RenderSeries) => boolean;
  toggleSeries: (chartId: string, series: RenderSeries) => void;
  toggleAllSeries: (chartId: string, series: RenderSeries[]) => void;
  addMetric: (chartId: string, metricKey: string) => void;
  removeMetric: (chartId: string, metricKey: string) => void;
};

/**
 * 图表卡片的图例行：全部显示/隐藏、每条曲线的图例条（延迟任务带统计详情、可删除指标）、添加指标。
 * 还没有数据时按图表配置的指标列出占位条。
 */
const ChartLegend = ({
  chart,
  series,
  uuid,
  pingStatsMap,
  definitionMap,
  metricOptions,
  isSeriesHidden,
  toggleSeries,
  toggleAllSeries,
  addMetric,
  removeMetric,
}: ChartLegendProps) => {
  const { t } = useTranslation();
  const allHidden = series.length > 0 && series.every((item) => isSeriesHidden(chart.id, item));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {series.length > 0 && (
        <button
          type="button"
          title={allHidden ? t("chart.showAll") : t("chart.hideAll")}
          aria-label={allHidden ? t("chart.showAll") : t("chart.hideAll")}
          onClick={() => toggleAllSeries(chart.id, series)}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent-4 hover:text-accent-12"
        >
          {allHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
      )}
      {series.length > 0
        ? series.map((item) => {
            const taskId = pingTaskId(item.tags);
            const stat =
              isPingMetric(item.metricKey) && uuid && taskId
                ? pingStatsMap.get(pingMetricStatKey(uuid, taskId))
                : undefined;
            return (
              <MetricLegendItem
                key={item.stableKey}
                className="transition-colors"
                label={item.label}
                color={item.color}
                hidden={isSeriesHidden(chart.id, item)}
                onToggle={() => toggleSeries(chart.id, item)}
                stat={stat}
              >
                <button
                  type="button"
                  title={t("chart.removeMetric", "Remove metric")}
                  aria-label={t("chart.removeMetric", "Remove metric")}
                  onClick={() => removeMetric(chart.id, item.metricKey)}
                  className="self-stretch px-1.5 text-muted-foreground hover:bg-accent-4 hover:text-accent-12"
                >
                  <X className="size-3" />
                </button>
              </MetricLegendItem>
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
      <MetricSelect
        options={metricOptions}
        onSelect={(value) => addMetric(chart.id, value)}
        placeholder="+"
        ariaLabel={t("chart.addMetric", "Add metric")}
        triggerClassName="h-7 w-8"
      />
    </div>
  );
};

export default ChartLegend;
