import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { ApiError, api } from "@/lib/http";
import { getMetricLabel } from "./catalog";
import { DASHBOARD_TEMPLATE_KEY } from "./constants";
import { parseDashboardTemplate } from "./dashboard";
import type { ChartSize, DashboardChart, MetricDefinition } from "./types";

/** 保存失败提示里的原因：服务器 message，否则 "HTTP 状态码" */
const saveErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    const body = error.body as { message?: unknown } | null;
    return (typeof body?.message === "string" && body.message) || `HTTP ${error.status}`;
  }
  return error instanceof Error ? error.message : String(error);
};

/** 图表看板：卡片列表（由全局模板初始化）、增删改排序，以及保存为全局模板 */
export function useDashboard(definitionMap: Map<string, MetricDefinition>) {
  const { t } = useTranslation();
  const { publicInfo, refresh: refreshPublicInfo } = usePublicInfo();
  const globalDashboardTemplate =
    publicInfo?.theme_settings?.[DASHBOARD_TEMPLATE_KEY];
  // parseDashboardTemplate 已经返回规范化后的数组，后续所有变更保持未修改卡片的对象引用稳定
  const [charts, setCharts] = useState<DashboardChart[]>(() =>
    parseDashboardTemplate(globalDashboardTemplate),
  );
  const [savingGlobalTemplate, setSavingGlobalTemplate] = useState(false);

  const definitionMapRef = useRef(definitionMap);
  definitionMapRef.current = definitionMap;
  const chartsRef = useRef(charts);
  chartsRef.current = charts;

  useEffect(() => {
    setCharts(parseDashboardTemplate(globalDashboardTemplate));
  }, [globalDashboardTemplate]);

  const updateChart = useCallback(
    (id: string, updater: (chart: DashboardChart) => DashboardChart) => {
      setCharts((current) =>
        current.map((chart) => (chart.id === id ? updater(chart) : chart)),
      );
    },
    [],
  );

  const addChart = useCallback((metricKey: string) => {
    if (!metricKey) return;
    setCharts((current) => {
      const nextIndex = current.length + 1;
      const title = getMetricLabel(metricKey, definitionMapRef.current);
      return [
        ...current,
        {
          id: `custom-${Date.now()}`,
          title: title || `Chart ${nextIndex}`,
          metrics: [metricKey],
          size: "medium",
        },
      ];
    });
  }, []);

  const removeChart = useCallback((id: string) => {
    setCharts((current) => current.filter((chart) => chart.id !== id));
  }, []);

  const resetDashboard = useCallback(() => {
    setCharts(parseDashboardTemplate(globalDashboardTemplate));
  }, [globalDashboardTemplate]);

  const saveGlobalTemplate = useCallback(async () => {
    const theme = publicInfo?.theme;
    if (!theme) return;

    setSavingGlobalTemplate(true);
    try {
      const existingSettings =
        publicInfo.theme_settings &&
        typeof publicInfo.theme_settings === "object" &&
        !Array.isArray(publicInfo.theme_settings)
          ? publicInfo.theme_settings
          : {};
      // 只看 HTTP 状态，不检查响应体的 status 字段
      await api.post(
        `/api/admin/theme/settings?theme=${encodeURIComponent(theme)}`,
        {
          ...existingSettings,
          [DASHBOARD_TEMPLATE_KEY]: JSON.stringify(chartsRef.current, null, 2),
        },
        { expectSuccess: false },
      );
      toast.success(t("chart.globalTemplateSaved"));
      refreshPublicInfo();
    } catch (saveError) {
      toast.error(`${t("chart.globalTemplateSaveFailed")}: ${saveErrorMessage(saveError)}`);
    } finally {
      setSavingGlobalTemplate(false);
    }
  }, [publicInfo, refreshPublicInfo, t]);

  const addMetric = useCallback(
    (chartId: string, metricKey: string) => {
      updateChart(chartId, (chart) => {
        if (!metricKey || chart.metrics.includes(metricKey)) return chart;
        return {
          ...chart,
          metrics: [...chart.metrics, metricKey],
        };
      });
    },
    [updateChart],
  );

  const removeMetric = useCallback(
    (chartId: string, metricKey: string) => {
      updateChart(chartId, (chart) => ({
        ...chart,
        metrics: chart.metrics.filter((item) => item !== metricKey),
      }));
    },
    [updateChart],
  );

  const setChartSize = useCallback(
    (chartId: string, size: ChartSize) => {
      updateChart(chartId, (chart) => (chart.size === size ? chart : { ...chart, size }));
    },
    [updateChart],
  );

  const handleChartDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setCharts((current) => {
      const oldIndex = current.findIndex((chart) => chart.id === active.id);
      const newIndex = current.findIndex((chart) => chart.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }, []);

  return {
    charts,
    savingGlobalTemplate,
    saveGlobalTemplate,
    resetDashboard,
    addChart,
    removeChart,
    addMetric,
    removeMetric,
    setChartSize,
    handleChartDragEnd,
  };
}
