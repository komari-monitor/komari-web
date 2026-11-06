import { useCallback } from "react";
import { Flex, Progress, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "motion/react";
import { AnimatedNumber } from "@/components/motion";
import { GapCollapse } from "@/components/GapCollapse";
import { SPACE } from "@/lib/spacing";
import { LEGACY_I18N, STRUCTURE_I18N } from "./constants";
import type { MigrationStatus } from "./types";

/** 迁移进行中：阶段名/百分比、进度条、明细是同一组（group） */
export default function MigrationProgress({
  status,
  legacy,
  locale,
  phaseText,
  displayedProgress,
}: {
  status: MigrationStatus;
  legacy: boolean;
  locale: string;
  phaseText: string;
  displayedProgress: number;
}) {
  const { t } = useTranslation();
  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  );
  return (
    <Flex direction="column" gap="2">
      <Flex justify="between" align="baseline" gap="2" wrap="wrap">
        <Text weight="bold">{phaseText}</Text>
        <Text size="2" color="gray" className="tabular-nums">
          {/* feedback 层：百分比滚动到新值，避免每 500ms 硬跳 */}
          <AnimatedNumber
            value={displayedProgress * 10}
            format={(value) =>
              new Intl.NumberFormat(locale, {
                maximumFractionDigits: 1,
              }).format(value / 10)
            }
          />
          %
        </Text>
      </Flex>
      <Progress value={displayedProgress} size="3" />
      <AnimatePresence initial={false}>
      {(legacy ||
        status.state === "copying" ||
        status.state === "discarding") && (
        <GapCollapse key="migration-progress-detail" gap={SPACE.group}>
        <Text size="2" color="gray">
          {legacy
            ? t(`${LEGACY_I18N}.progress_detail`, {
                done: formatNumber(status.source_rows_done ?? 0),
                total: formatNumber(status.source_rows_total ?? 0),
                points: formatNumber(status.written_points ?? 0),
              })
            : status.state === "copying"
              ? t(`${STRUCTURE_I18N}.copy_detail`, {
                  rows: formatNumber(status.rows_done ?? 0),
                  total: formatNumber(status.rows_total ?? 0),
                  metrics: formatNumber(status.metrics_done ?? 0),
                  metricTotal: formatNumber(status.metrics_total ?? 0),
                  metric: status.current_metric || "-",
                })
              : t(`${STRUCTURE_I18N}.discard_detail`)}
        </Text>
        </GapCollapse>
      )}
      </AnimatePresence>
    </Flex>
  );
}
