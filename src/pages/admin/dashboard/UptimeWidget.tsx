import { useState } from "react";
import { Badge, Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeletonize } from "@/components/ui/skeleton";
import { formatUptimeCompact } from "@/utils/unitHelper";
import { PlaceholderRankRow, RankEntryRow, RankListPopover } from "./RankList";
import type { UptimeSummary } from "./types";
import { formatPeakTime, rankRowMotion } from "./utils";

type UptimeViewMode = "recent" | "longest";

/** 近期重启与运行时长：采用原生 Radix SegmentedControl + Badge + TopRankCard 统一列表风格 */
export const UptimeWidget = ({
  summary,
  limit = 5,
  loading = false,
}: {
  summary: UptimeSummary;
  limit?: number;
  loading?: boolean;
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<UptimeViewMode>("recent");
  const list = mode === "recent" ? summary.shortest : summary.longest;
  const maxUptime = summary.longest[0]?.uptime ?? 0;

  return (
    <Flex direction="column" gap="4">
      <Flex
        justify="between"
        align="center"
        gap="2"
        wrap="wrap"
        style={{ color: "var(--gray-10)" }}
      >
        <Flex gap="2" align="center">
          <History size={18} />
          <Text size="3" weight="bold">
            {t("dashboardLayout.widgets.uptime", "Reboots & uptime")}
          </Text>
        </Flex>
        <Flex gap="1" align="center">
          <SegmentedControl.Root
            size="1"
            value={mode}
            onValueChange={(value) => setMode(value as UptimeViewMode)}
          >
            <SegmentedControl.Item value="recent">
              {t("dashboard.uptimeRecent", "Recent")}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="longest">
              {t("dashboard.uptimeLongest", "Longest")}
            </SegmentedControl.Item>
          </SegmentedControl.Root>
          {list.length > 0 && (
            <RankListPopover
              title={
                mode === "recent"
                  ? t("dashboard.uptimeRecent", "Recent")
                  : t("dashboard.uptimeLongest", "Longest")
              }
              ariaLabel={t("common.details", "Details")}
            >
              <Flex direction="column" gap="2">
                {list.map((item, index) => (
                  <RankEntryRow key={item.uuid} index={index} name={item.name} title={item.name}>
                    <Text
                      size="2"
                      weight="medium"
                      color={item.recentReboot24h ? "amber" : "gray"}
                      className="whitespace-nowrap"
                    >
                      {formatUptimeCompact(item.uptime, t)}
                    </Text>
                  </RankEntryRow>
                ))}
              </Flex>
            </RankListPopover>
          )}
        </Flex>
      </Flex>

      <Skeletonize loading={loading}>
        {loading ? (
          <Flex direction="column" gap="3">
            {Array.from({ length: Math.min(limit, 3) }, (_, index) => (
              <PlaceholderRankRow key={index} index={index} />
            ))}
          </Flex>
        ) : list.length === 0 ? (
          <Text size="2" color="gray">
            {t("dashboard.noData", "No data")}
          </Text>
        ) : (
          <Flex direction="column" gap="3">
            {mode === "recent" && (
              <Flex align="center" justify="between" gap="2">
                <Text size="2" color="gray">
                  {summary.recentCount24h > 0
                    ? t("dashboard.uptimeRebootAlert", "{{count}} server(s) rebooted in 24h", {
                        count: summary.recentCount24h,
                      })
                    : t("dashboard.uptimeAllStable", "No server reboots in the last 24h")}
                </Text>
                <Badge
                  size="1"
                  variant="soft"
                  color={summary.recentCount24h > 0 ? "amber" : "green"}
                >
                  {summary.recentCount24h > 0 ? `${summary.recentCount24h}` : "24h OK"}
                </Badge>
              </Flex>
            )}

            <Flex direction="column" gap="3" className="relative">
              <AnimatePresence initial={false} mode="popLayout">
                {list.slice(0, limit).map((item, index) => {
                  const ratio =
                    mode === "longest" && maxUptime > 0
                      ? Math.max(4, (item.uptime / maxUptime) * 100)
                      : 0;
                  return (
                    <motion.div
                      key={`${mode}-${item.uuid}`}
                      {...rankRowMotion(
                        list
                          .slice(0, limit)
                          .map((entry) => entry.uuid)
                          .join("|"),
                      )}
                      className="flex flex-col gap-1"
                    >
                      <RankEntryRow index={index} name={item.name} title={item.name}>
                        {mode === "recent" && item.recentReboot24h && (
                          <Badge size="1" variant="soft" color="amber">
                            &lt; 24h
                          </Badge>
                        )}
                        <Text
                          size="2"
                          weight="bold"
                          color={mode === "recent" && item.recentReboot24h ? "amber" : undefined}
                          className="whitespace-nowrap"
                        >
                          {formatUptimeCompact(item.uptime, t)}
                        </Text>
                      </RankEntryRow>
                      {mode === "recent" ? (
                        <Text size="1" color="gray" className="truncate">
                          {t("dashboard.uptimeBootedAt", "Booted {{time}}", {
                            time: formatPeakTime(t, item.bootTime),
                          })}
                        </Text>
                      ) : (
                        <div className="km-dashboard-meter">
                          <div
                            style={{
                              width: `${Math.min(100, ratio)}%`,
                              background: "var(--accent-9)",
                            }}
                          />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </Flex>
          </Flex>
        )}
      </Skeletonize>
    </Flex>
  );
};
