import type { TFunction } from "i18next";
import { motion } from "motion/react";
import { MOTION_SPRING } from "@/lib/motion";
import { formatMilliseconds } from "@/components/metricChartShared";
import type { PingMetricStat } from "@/types/metrics";

type PingMetricStatContentProps = {
  stat: PingMetricStat;
  t: TFunction;
};

const PingMetricStatContent = ({ stat, t }: PingMetricStatContentProps) => {
  const rows: Array<[string, string]> = [
    [
      t("chart.lossRate"),
      `${Number(stat.loss ?? 0).toFixed(1)}%${
        stat.loss_approximate ? ` ${t("chart.approximate")}` : ""
      }`,
    ],
  ];

  if (typeof stat.min === "number") rows.push([t("chart.min"), formatMilliseconds(stat.min)]);
  if (typeof stat.max === "number") rows.push([t("chart.max"), formatMilliseconds(stat.max)]);
  if (typeof stat.avg === "number") rows.push([t("chart.avg"), formatMilliseconds(stat.avg)]);
  if (typeof stat.latest === "number") rows.push([t("chart.latest"), formatMilliseconds(stat.latest)]);
  if (typeof stat.p50 === "number") rows.push(["P50", formatMilliseconds(stat.p50)]);
  if (typeof stat.p99 === "number") rows.push(["P99", formatMilliseconds(stat.p99)]);
  if (typeof stat.stddev === "number") {
    rows.push([t("chart.sampling.stddev"), formatMilliseconds(stat.stddev)]);
  }
  if (typeof stat.p99_p50_ratio === "number" && (stat.valid ?? 0) > 0) {
    rows.push([t("chart.volatility"), stat.p99_p50_ratio.toFixed(2)]);
  }
  rows.push([t("chart.total"), String(stat.total)]);
  rows.push([t("chart.valid"), String(stat.valid)]);
  if (stat.interval) rows.push([t("chart.interval"), `${stat.interval}s`]);
  if (stat.type) rows.push([t("common.type"), stat.type.toUpperCase()]);

  return (
    <div className="km-ping-metric-stat grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
      {rows.map(([label, value], index) => {
        const transition = { ...MOTION_SPRING.snappy, delay: Math.min(index * 0.015, 0.12) };
        return (
          <div key={label} className="contents">
            <motion.span
              className="text-muted-foreground"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={transition}
            >
              {label}
            </motion.span>
            <motion.span
              className="text-right font-mono tabular-nums"
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={transition}
            >
              {value}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
};

export default PingMetricStatContent;
