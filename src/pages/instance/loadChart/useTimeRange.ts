import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CUSTOM_RANGE_DEFAULT_DAYS } from "./constants";
import { buildRecentRange, buildTimeViews, toQueryRange } from "./timeRange";
import type { CustomTimeRange, MetricRangeParams } from "./types";

/** 时间范围：预设视图（实时 / 10 分钟 / … / 自定义）与自定义范围的草稿、校验和查询参数 */
export function useTimeRange(
  maxMetricRetentionDays: number,
  onRealtimeActiveChange?: (active: boolean) => void,
) {
  const { t } = useTranslation();
  const timeViews = useMemo(
    () => buildTimeViews(t, maxMetricRetentionDays),
    [t, maxMetricRetentionDays],
  );
  const [viewKey, setViewKey] = useState("real-time");
  const selectedView = timeViews.find((view) => view.key === viewKey) ?? timeViews[0];
  const isRealtime = selectedView.key === "real-time";
  const isCustomRange = selectedView.key === "custom";
  const [customDraftRange, setCustomDraftRange] = useState<CustomTimeRange>(() =>
    buildRecentRange(CUSTOM_RANGE_DEFAULT_DAYS),
  );
  const [customQueryRange, setCustomQueryRange] = useState<CustomTimeRange>(() =>
    buildRecentRange(CUSTOM_RANGE_DEFAULT_DAYS),
  );
  const [customQueryRevision, setCustomQueryRevision] = useState(0);
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);

  useEffect(() => {
    onRealtimeActiveChange?.(isRealtime);
  }, [isRealtime, onRealtimeActiveChange]);

  useEffect(() => {
    if (!timeViews.some((view) => view.key === viewKey)) {
      setViewKey(timeViews[0]?.key ?? "real-time");
    }
  }, [timeViews, viewKey]);

  const customQuery = useMemo(
    () => toQueryRange(customQueryRange),
    [customQueryRange],
  );
  const queryHours = isRealtime ? 1 : selectedView.hours;
  const queryRange = isCustomRange ? customQuery : null;
  const queryStart = queryRange?.start;
  const queryEnd = queryRange?.end;
  const queryRangeSignature =
    queryStart && queryEnd
      ? `${queryStart}|${queryEnd}|${customQueryRevision}`
      : "";
  const displayRangeHours =
    queryStart && queryEnd
      ? (new Date(queryEnd).getTime() - new Date(queryStart).getTime()) / 3_600_000
      : selectedView.hours;
  const metricRangeParams = useMemo<MetricRangeParams>(
    () =>
      queryRangeSignature
        ? { start: queryStart!, end: queryEnd! }
        : { hours: queryHours ?? 1 },
    [queryEnd, queryHours, queryRangeSignature, queryStart],
  );

  const selectRecentRange = (days: number) => {
    setCustomDraftRange(buildRecentRange(days));
    setCustomRangeError(null);
  };

  const applyCustomRange = () => {
    if (!toQueryRange(customDraftRange)) {
      setCustomRangeError(t("chart.invalidTimeRange"));
      return;
    }
    setCustomQueryRange(customDraftRange);
    setCustomQueryRevision((current) => current + 1);
    setCustomRangeError(null);
  };

  const updateCustomDraft = (patch: Partial<CustomTimeRange>) => {
    setCustomDraftRange((current) => ({ ...current, ...patch }));
    setCustomRangeError(null);
  };

  return {
    timeViews,
    selectedView,
    setViewKey,
    isRealtime,
    isCustomRange,
    customDraftRange,
    customRangeError,
    updateCustomDraft,
    selectRecentRange,
    applyCustomRange,
    displayRangeHours,
    metricRangeParams,
  };
}
