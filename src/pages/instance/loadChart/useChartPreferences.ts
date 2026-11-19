import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Aggregation, RenderSeries } from "./types";

const hiddenKey = (chartId: string, series: RenderSeries) =>
  `${chartId}:${series.stableKey}`;

/** 持久化在 localStorage 的图表偏好：采样算法、EWMA 开关、每张图隐藏的曲线 */
export function useChartPreferences() {
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

  const isSeriesHidden = useCallback(
    (chartId: string, series: RenderSeries) =>
      hiddenSeries[hiddenKey(chartId, series)] === true,
    [hiddenSeries],
  );

  const toggleSeries = useCallback(
    (chartId: string, series: RenderSeries) => {
      const key = hiddenKey(chartId, series);
      setHiddenSeries((current) => ({
        ...current,
        [key]: !current[key],
      }));
    },
    [setHiddenSeries],
  );

  const toggleAllSeries = useCallback(
    (chartId: string, series: RenderSeries[]) => {
      setHiddenSeries((current) => {
        const allHidden =
          series.length > 0 &&
          series.every((item) => current[hiddenKey(chartId, item)] === true);
        const next = { ...current };
        for (const item of series) {
          next[hiddenKey(chartId, item)] = !allHidden;
        }
        return next;
      });
    },
    [setHiddenSeries],
  );

  return {
    aggregation,
    setAggregation,
    ewmaEnabled,
    setEwmaEnabled,
    isSeriesHidden,
    toggleSeries,
    toggleAllSeries,
  };
}
