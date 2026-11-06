import type React from "react";
import { Flex, Text } from "@radix-ui/themes";
import type { TFunction } from "i18next";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { AnimatedNumber } from "@/components/motion";
import { Skeletonize } from "@/components/ui/skeleton";
import {
  MiniChartButton,
  PlaceholderRankRow,
  RankEntryRow,
  RankListPopover,
} from "./RankList";
import type { TopRankItem } from "./types";
import { formatPeakTime, rankRowMotion } from "./utils";

/** CPU / 内存占用 TOP 排行卡片 */
export const TopRankCard = ({
  title,
  icon,
  items,
  metricKeys,
  limit = 4,
  loading = false,
  t,
}: {
  title: string;
  icon: React.ReactNode;
  items: TopRankItem[];
  metricKeys: string[];
  limit?: number;
  loading?: boolean;
  t: TFunction;
}) => {
  return (
    <Flex direction="column" gap="4">
      <Flex
        gap="2"
        align="center"
        justify="between"
        style={{ color: "var(--gray-10)" }}
      >
        <Flex gap="2" align="center">
          {icon}
          <Text size="3" weight="bold">
            {title}
          </Text>
        </Flex>
        <RankListPopover
          title={title}
          ariaLabel={t("common.details", "Details")}
        >
          <Flex direction="column" gap="2">
            {items.map((item, index) => (
              <RankEntryRow key={item.uuid} index={index} name={item.name} title={item.name}>
                <Text size="2" weight="bold" className="whitespace-nowrap">
                  {item.value.toFixed(1)}%
                </Text>
                <MiniChartButton
                  uuid={item.uuid}
                  metricKeys={metricKeys}
                  ariaLabel={t("dashboard.viewChart", "View 24h chart")}
                />
              </RankEntryRow>
            ))}
          </Flex>
        </RankListPopover>
      </Flex>
      <Skeletonize loading={loading}>
      {loading ? (
          <Flex direction="column" gap="3">
            {Array.from({ length: limit }, (_, index) => (
              <PlaceholderRankRow key={index} index={index} />
            ))}
          </Flex>
      ) : items.length === 0 ? (
        <Text size="2" color="gray">
          {t("dashboard.noData", "No data")}
        </Text>
      ) : (
        <Flex direction="column" gap="3" className="relative">
          {/* content 层：排行条目随排序变化重排（layout="position" + 顺序 key，规则同到期列表） */}
          <AnimatePresence initial={false} mode="popLayout">
          {items.slice(0, limit).map((item, index) => {
            const percent = Math.min(Math.max(item.value, 0), 100);
            const barColor =
              percent >= 80 ? "red" : percent >= 60 ? "orange" : "green";
            return (
              <motion.div
                key={item.uuid}
                {...rankRowMotion(items.slice(0, limit).map((entry) => entry.uuid).join("|"))}
                className="flex flex-col gap-1"
              >
                <RankEntryRow index={index} name={item.name} title={item.name}>
                  <Text size="2" weight="bold" className="whitespace-nowrap">
                    <AnimatedNumber value={item.value} format={(v) => `${v.toFixed(1)}%`} />
                  </Text>
                  <MiniChartButton
                    uuid={item.uuid}
                    metricKeys={metricKeys}
                    ariaLabel={t("dashboard.viewChart", "View 24h chart")}
                  />
                </RankEntryRow>
                <Text size="1" color="gray" className="truncate">
                  {t("dashboard.peakAt", "Peak {{value}} at {{time}}", {
                    value: `${item.peak.toFixed(1)}%`,
                    time: formatPeakTime(t, item.peakTime),
                  })}
                </Text>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--gray-5)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: `var(--${barColor}-9)`,
                      transition: `width ${MOTION_DURATION.slow}s ${MOTION_EASE.out}`,
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </Flex>
      )}
      </Skeletonize>
    </Flex>
  );
};
