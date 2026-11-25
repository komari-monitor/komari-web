import { Button, Flex, Separator, Text, Tooltip } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { Activity, Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatedNumber } from "@/components/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { formatSpeed } from "@/utils/unitHelper";
import { MiniChartButton, PlaceholderRankRow, RankEntryRow, RankListPopover } from "./RankList";
import type { LiveBandwidthSummary } from "./types";
import { NET_METRIC_KEYS, rankRowMotion } from "./utils";

/** 实时带宽总览：原生 Radix Button + Separator + TopRankCard 统一风格 */
export const LiveBandwidthWidget = ({
  summary,
  limit = 5,
  loading = false,
  liveEnabled,
  onToggleLive,
}: {
  summary: LiveBandwidthSummary;
  limit?: number;
  loading?: boolean;
  liveEnabled: boolean;
  onToggleLive: () => void;
}) => {
  const { t } = useTranslation();
  const reduced = useKmReducedMotion();
  const topTotal = summary.nodes[0]?.total ?? 0;

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center" gap="2" style={{ color: "var(--gray-10)" }}>
        <Flex gap="2" align="center">
          <Activity size={18} />
          <Text size="3" weight="bold">
            {t("dashboardLayout.widgets.liveBandwidth", "Live bandwidth")}
          </Text>
        </Flex>
        <Flex gap="1" align="center">
          <Tooltip
            content={
              liveEnabled
                ? t("dashboard.livePause", "Pause live updates")
                : t("dashboard.liveResume", "Resume live updates")
            }
          >
            <Button
              size="1"
              variant="soft"
              color={liveEnabled ? "green" : "gray"}
              onClick={onToggleLive}
              aria-pressed={liveEnabled}
            >
              <span
                className={`km-dashboard-live-dot${liveEnabled && !reduced ? " is-pulsing" : ""}`}
              />
              {liveEnabled
                ? t("dashboard.liveActive", "Live")
                : t("dashboard.livePaused", "Paused")}
              {liveEnabled ? <Pause size={11} /> : <Play size={11} />}
            </Button>
          </Tooltip>
          {summary.nodes.length > 0 && (
            <RankListPopover
              title={t("dashboardLayout.widgets.liveBandwidth", "Live bandwidth")}
              ariaLabel={t("common.details", "Details")}
            >
              <Flex direction="column" gap="2">
                {summary.nodes.map((node, index) => (
                  <RankEntryRow
                    key={node.uuid}
                    index={index}
                    name={node.name}
                    title={node.name}
                    valueGap="2"
                  >
                    <Text size="2" color="gray" className="whitespace-nowrap">
                      ↑ {formatSpeed(node.up)} ↓ {formatSpeed(node.down)}
                    </Text>
                    <MiniChartButton
                      uuid={node.uuid}
                      metricKeys={NET_METRIC_KEYS}
                      ariaLabel={t("dashboard.viewChart", "View 24h chart")}
                    />
                  </RankEntryRow>
                ))}
              </Flex>
            </RankListPopover>
          )}
        </Flex>
      </Flex>

      <Skeletonize loading={loading}>
        <Flex align="center" justify="between" gap="4">
          <Flex direction="column" gap="1" className="min-w-0 flex-1">
            <Flex align="center" gap="1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--green-9)" }}
              />
              <Text size="1" color="gray">
                {t("dashboard.uploadRate", "Upload rate")}
              </Text>
            </Flex>
            <Text size="4" weight="bold" className="truncate">
              {loading ? (
                skeletonText(8)
              ) : (
                <AnimatedNumber value={summary.totalUp} format={formatSpeed} />
              )}
            </Text>
          </Flex>
          <Separator orientation="vertical" size="2" />
          <Flex direction="column" gap="1" className="min-w-0 flex-1">
            <Flex align="center" gap="1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--blue-9)" }}
              />
              <Text size="1" color="gray">
                {t("dashboard.downloadRate", "Download rate")}
              </Text>
            </Flex>
            <Text size="4" weight="bold" className="truncate">
              {loading ? (
                skeletonText(8)
              ) : (
                <AnimatedNumber value={summary.totalDown} format={formatSpeed} />
              )}
            </Text>
          </Flex>
        </Flex>
      </Skeletonize>

      <Separator size="4" />

      <Skeletonize loading={loading}>
        {loading ? (
          <Flex direction="column" gap="3">
            {Array.from({ length: Math.min(limit, 3) }, (_, index) => (
              <PlaceholderRankRow key={index} index={index} />
            ))}
          </Flex>
        ) : summary.nodes.length === 0 ? (
          <Text size="2" color="gray">
            {t("dashboard.noData", "No data")}
          </Text>
        ) : (
          <Flex direction="column" gap="3" className="relative">
            <AnimatePresence initial={false} mode="popLayout">
              {summary.nodes.slice(0, limit).map((node, index) => {
                const totalShare = topTotal > 0 ? (node.total / topTotal) * 100 : 0;
                const upShare = node.total > 0 ? (node.up / node.total) * totalShare : 0;
                const downShare = Math.max(0, totalShare - upShare);
                return (
                  <motion.div
                    key={node.uuid}
                    {...rankRowMotion(
                      summary.nodes
                        .slice(0, limit)
                        .map((entry) => entry.uuid)
                        .join("|"),
                    )}
                    className="flex flex-col gap-1"
                  >
                    <RankEntryRow
                      index={index}
                      name={node.name}
                      title={node.name}
                      valueGap="2"
                    >
                      <Text size="2" color="gray" className="whitespace-nowrap">
                        ↑ {formatSpeed(node.up)} ↓ {formatSpeed(node.down)}
                      </Text>
                      <MiniChartButton
                        uuid={node.uuid}
                        metricKeys={NET_METRIC_KEYS}
                        ariaLabel={t("dashboard.viewChart", "View 24h chart")}
                      />
                    </RankEntryRow>
                    <div className="km-dashboard-meter km-dashboard-meter-split">
                      <div
                        style={{
                          width: `${Math.min(100, upShare)}%`,
                          background: "var(--green-9)",
                        }}
                      />
                      <div
                        style={{
                          width: `${Math.min(100, downShare)}%`,
                          background: "var(--blue-9)",
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
