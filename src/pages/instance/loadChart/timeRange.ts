import type { CustomTimeRange, TFn, TimeView } from "./types";

export const buildTimeViews = (
  t: TFn,
  maxMetricRetentionDays: number,
): TimeView[] => {
  const views: TimeView[] = [
    { key: "real-time", label: t("common.real_time") },
    { key: "10m", label: t("chart.minutes", { count: 10 }), hours: 10 / 60 },
    { key: "1h", label: t("chart.hours", { count: 1 }), hours: 1 },
  ];
  const validRetentionDays =
    Number.isFinite(maxMetricRetentionDays) && maxMetricRetentionDays > 0
      ? maxMetricRetentionDays
      : 0;

  if (validRetentionDays >= 1) {
    views.push({ key: "1d", label: t("chart.days", { count: 1 }), hours: 24 });
  }
  if (validRetentionDays >= 7) {
    views.push({ key: "7d", label: t("chart.days", { count: 7 }), hours: 7 * 24 });
  }
  if (validRetentionDays > 0 && validRetentionDays !== 1 && validRetentionDays !== 7) {
    const retentionHours = validRetentionDays * 24;
    views.push({
      key: `retention-${retentionHours}`,
      label: Number.isInteger(validRetentionDays)
        ? t("chart.days", { count: validRetentionDays })
        : t("chart.hours", { count: retentionHours }),
      hours: retentionHours,
    });
  }

  views.push({ key: "custom", label: t("chart.customRange") });
  return views;
};

export const toDateTimeLocalValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const buildRecentRange = (days: number): CustomTimeRange => {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    start: toDateTimeLocalValue(start),
    end: toDateTimeLocalValue(end),
  };
};

export const toQueryRange = (range: CustomTimeRange) => {
  const start = new Date(range.start);
  const end = new Date(range.end);
  if (
    !range.start ||
    !range.end ||
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start
  ) {
    return null;
  }
  return { start: start.toISOString(), end: end.toISOString() };
};
