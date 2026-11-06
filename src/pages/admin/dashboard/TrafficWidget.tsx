import { Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE, MOTION_TRANSITION } from "@/lib/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { formatBytes } from "@/utils/unitHelper";
import {
  MiniChartButton,
  PlaceholderRankRow,
  RankEntryRow,
  RankListPopover,
} from "./RankList";
import { TrafficChart } from "./TrafficChart";
import type { TrafficSummary } from "./types";
import { formatSpeed } from "@/utils/unitHelper";
import { NET_METRIC_KEYS, formatPeakTime, rankRowMotion } from "./utils";

/** 24h 流量：图例与总量、流量图、流量 TOP 排行 */
export const TrafficWidget = ({
  limit,
  loading,
  traffic,
  nodeNameMap,
}: {
  limit: number;
  loading: boolean;
  traffic: TrafficSummary | null;
  nodeNameMap: Map<string, string>;
}) => {
  const { t } = useTranslation();
  return (
    <Flex direction="column" gap="4">
      <Flex justify="between" align="center" wrap="wrap" gap="2">
        <Text size="3" weight="bold">
          {t("dashboard.traffic24h", "Last 24h traffic")}
        </Text>
        <Flex gap="4" align="center" wrap="wrap">
          <Flex gap="1" align="center">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: "var(--green-9)" }}
            />
            <Text size="2" color="gray">
              {t("dashboard.uploadRate", "Upload rate")}
            </Text>
          </Flex>
          <Flex gap="1" align="center">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: "var(--blue-9)" }}
            />
            <Text size="2" color="gray">
              {t("dashboard.downloadRate", "Download rate")}
            </Text>
          </Flex>
          <Flex gap="1" align="center">
            <span
              className="w-4 border-t-2 border-dashed"
              style={{ borderColor: "var(--green-9)" }}
            />
            <Text size="2" color="gray">
              {t("dashboard.uploadTotal", "Upload cumulative")}
            </Text>
          </Flex>
          <Flex gap="1" align="center">
            <span
              className="w-4 border-t-2 border-dashed"
              style={{ borderColor: "var(--blue-9)" }}
            />
            <Text size="2" color="gray">
              {t("dashboard.downloadTotal", "Download cumulative")}
            </Text>
          </Flex>
          <Skeletonize as="span" loading={loading}>
            <Text size="2" color="gray">
              ↑ {loading ? skeletonText(6) : formatBytes(traffic?.totalUp ?? 0)} ↓{" "}
              {loading ? skeletonText(6) : formatBytes(traffic?.totalDown ?? 0)}
            </Text>
          </Skeletonize>
        </Flex>
      </Flex>
      <TrafficChart traffic={traffic} loading={loading} />
      <Skeletonize loading={loading}>
      {loading && (
        // 排行区的占位：与真实排行同结构，避免数据到达时卡片突然长出一大截
          <Flex direction="column" gap="3">
            <Text size="3" weight="bold">
              {t("dashboard.topTraffic", "Top traffic servers")}
            </Text>
            {Array.from({ length: Math.min(limit, 3) }, (_, index) => (
              <PlaceholderRankRow key={index} index={index} />
            ))}
          </Flex>
      )}
      {traffic && traffic.nodeTotals.length > 0 && (
        <>
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center" gap="2">
              <Text size="3" weight="bold">
                {t("dashboard.topTraffic", "Top traffic servers")}
              </Text>
              <RankListPopover
                title={t("dashboard.topTraffic", "Top traffic servers")}
                ariaLabel={t("common.details", "Details")}
              >
                <Flex direction="column" gap="2">
                  {traffic.nodeTotals.map((node, index) => (
                    <RankEntryRow
                      key={node.uuid}
                      index={index}
                      name={nodeNameMap.get(node.uuid) ?? node.uuid.slice(0, 8)}
                      valueGap="2"
                    >
                      <Text
                        size="2"
                        color="gray"
                        className="whitespace-nowrap"
                      >
                        ↑ {formatBytes(node.up)} ↓{" "}
                        {formatBytes(node.down)}
                      </Text>
                      <MiniChartButton
                        uuid={node.uuid}
                        metricKeys={NET_METRIC_KEYS}
                        ariaLabel={t(
                          "dashboard.viewChart",
                          "View 24h chart",
                        )}
                      />
                    </RankEntryRow>
                  ))}
                </Flex>
              </RankListPopover>
            </Flex>
            <Flex direction="column" gap="3" className="relative">
              {/* content 层：流量排行随刷新重排，条目用 layout="position" 跟随（规则同上方到期列表） */}
              <AnimatePresence initial={false} mode="popLayout">
              {traffic.nodeTotals.slice(0, limit).map((node, index) => (
                <motion.div
                  key={node.uuid}
                  {...rankRowMotion(traffic.nodeTotals.slice(0, limit).map((entry) => entry.uuid).join("|"), {
                    layout: MOTION_TRANSITION.layout,
                    y: MOTION_TRANSITION.layout,
                    opacity: MOTION_TRANSITION.fadeIn,
                  })}
                  className="flex flex-col gap-1"
                >
                  <RankEntryRow
                    index={index}
                    name={nodeNameMap.get(node.uuid) ?? node.uuid.slice(0, 8)}
                    valueGap="2"
                  >
                    <Text
                      size="2"
                      color="gray"
                      className="whitespace-nowrap"
                    >
                      ↑ {formatBytes(node.up)} ↓ {formatBytes(node.down)}
                    </Text>
                    <MiniChartButton
                      uuid={node.uuid}
                      metricKeys={NET_METRIC_KEYS}
                      ariaLabel={t(
                        "dashboard.viewChart",
                        "View 24h chart",
                      )}
                    />
                  </RankEntryRow>
                  {node.peakRate > 0 && (
                    <Text size="1" color="gray" className="truncate">
                      {t(
                        "dashboard.peakAt",
                        "Peak {{value}} at {{time}}",
                        {
                          value: formatSpeed(node.peakRate),
                          time: formatPeakTime(t, node.peakTime),
                        },
                      )}
                    </Text>
                  )}
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--gray-5)" }}
                  >
                    {/* feedback 层：占比条只在数据刷新时平滑追上去 */}
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${
                          (node.total / traffic.nodeTotals[0].total) *
                          100
                        }%`,
                        backgroundColor: "var(--accent-9)",
                        transition: `width ${MOTION_DURATION.slow}s ${MOTION_EASE.out}`,
                      }}
                    />
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
            </Flex>
          </Flex>
        </>
      )}
      </Skeletonize>
    </Flex>
  );
};
