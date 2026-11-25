import { Badge, Flex, Link as RadixLink, Text } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpDown, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatedNumber } from "@/components/motion";
import { Skeletonize } from "@/components/ui/skeleton";
import { formatBytes } from "@/utils/unitHelper";
import { PlaceholderRankRow, RankEntryRow, RankListPopover } from "./RankList";
import type { TrafficQuotaItem } from "./types";
import { DAY_MS, rankRowMotion } from "./utils";

const quotaTone = (percent: number): "red" | "orange" | "green" => {
  if (percent >= 90) return "red";
  if (percent >= 75) return "orange";
  return "green";
};

function formatRemainingText(
  item: TrafficQuotaItem,
  t: ReturnType<typeof useTranslation>["t"],
): string | null {
  if (item.projectedExhaust && item.projectedDaysLeft !== null) {
    const days = Math.max(1, Math.ceil(item.projectedDaysLeft));
    return t("dashboard.quotaProjectedExhaust", "Est. full in {{days}}d", { days });
  }
  if (item.remainingMs !== null) {
    if (item.remainingMs <= 0) {
      return t("dashboard.quotaResetting", "Resetting soon");
    }
    const days = Math.ceil(item.remainingMs / DAY_MS);
    return t("dashboard.quotaResetIn", "Resets in {{days}}d", { days });
  }
  return null;
}

/** 流量配额预警：风格与 TopRankCard / ExtraWidget(disk) 统一 */
export const TrafficQuotaWidget = ({
  items,
  limit = 5,
  loading = false,
}: {
  items: TrafficQuotaItem[];
  limit?: number;
  loading?: boolean;
}) => {
  const { t } = useTranslation();

  const renderEntryMeta = (item: TrafficQuotaItem) => {
    const typeLabel = t(
      `admin.nodeEdit.trafficLimitType_${item.limitType}`,
      item.limitType.toUpperCase(),
    );
    const cycleHint = formatRemainingText(item, t);
    return (
      <Flex justify="between" align="center" gap="2">
        <Text size="1" color="gray" className="truncate">
          {formatBytes(item.used)} / {formatBytes(item.limit)} · {typeLabel}
        </Text>
        {cycleHint && (
          <Text
            size="1"
            color={item.projectedExhaust ? "orange" : "gray"}
            className="shrink-0 whitespace-nowrap"
          >
            {cycleHint}
          </Text>
        )}
      </Flex>
    );
  };

  return (
    <Flex direction="column" gap="4">
      <Flex justify="between" align="center" gap="2" style={{ color: "var(--gray-10)" }}>
        <Flex gap="2" align="center">
          <ArrowUpDown size={18} />
          <Text size="3" weight="bold">
            {t("dashboardLayout.widgets.trafficQuota", "Traffic quota")}
          </Text>
        </Flex>
        {items.length > 0 && (
          <RankListPopover
            title={t("dashboardLayout.widgets.trafficQuota", "Traffic quota")}
            ariaLabel={t("common.details", "Details")}
          >
            <Flex direction="column" gap="2">
              {items.map((item, index) => {
                const color = quotaTone(item.percent);
                return (
                  <div key={item.uuid} className="flex flex-col gap-0.5">
                    <RankEntryRow index={index} name={item.name} title={item.name}>
                      <Text size="2" weight="bold" color={color} className="whitespace-nowrap">
                        {item.percent.toFixed(1)}%
                      </Text>
                    </RankEntryRow>
                    {renderEntryMeta(item)}
                  </div>
                );
              })}
            </Flex>
          </RankListPopover>
        )}
      </Flex>

      <Skeletonize loading={loading}>
        {loading ? (
          <Flex direction="column" gap="3">
            {Array.from({ length: Math.min(limit, 3) }, (_, index) => (
              <PlaceholderRankRow key={index} index={index} />
            ))}
          </Flex>
        ) : items.length === 0 ? (
          <Flex direction="column" gap="2" align="start">
            <Text size="2" color="gray">
              {t("dashboard.noTrafficQuota", "No traffic quota configured")}
            </Text>
            <RadixLink asChild size="2">
              <Link to="/admin/servers" className="inline-flex items-center gap-1">
                {t("dashboard.configureQuota", "Configure in Servers")}
                <ArrowUpRight size={14} />
              </Link>
            </RadixLink>
          </Flex>
        ) : (
          <Flex direction="column" gap="3" className="relative">
            <AnimatePresence initial={false} mode="popLayout">
              {items.slice(0, limit).map((item, index) => {
                const color = quotaTone(item.percent);
                const barWidth = Math.min(100, Math.max(0, item.percent));
                return (
                  <motion.div
                    key={item.uuid}
                    {...rankRowMotion(
                      items
                        .slice(0, limit)
                        .map((entry) => entry.uuid)
                        .join("|"),
                    )}
                    className="flex flex-col gap-1"
                  >
                    <RankEntryRow index={index} name={item.name} title={item.name}>
                      {!item.online && (
                        <Badge size="1" variant="soft" color="gray">
                          {t("nodeCard.offline", "Offline")}
                        </Badge>
                      )}
                      {item.percent >= 100 && (
                        <Badge size="1" variant="soft" color="red">
                          {t("dashboard.quotaExceeded", "Exceeded")}
                        </Badge>
                      )}
                      <Text size="2" weight="bold" color={color} className="whitespace-nowrap">
                        <AnimatedNumber
                          value={item.percent}
                          format={(value) => `${value.toFixed(1)}%`}
                        />
                      </Text>
                    </RankEntryRow>
                    {renderEntryMeta(item)}
                    <div className="km-dashboard-meter">
                      <div
                        style={{
                          width: `${barWidth}%`,
                          background: `var(--${color}-9)`,
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
