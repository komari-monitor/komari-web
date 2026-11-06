import { Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { StatusFeedback } from "@/components/motion";
import { Skeletonize } from "@/components/ui/skeleton";
import Tips from "@/components/ui/tips";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import { ProgressRing } from "./ProgressRing";
import type { DashboardHealth, DashboardStats } from "./types";

/** 概览：在线率圆环 + 健康描述 + 在线 / 离线数（离线数可展开离线列表） */
export const OverviewWidget = ({
  loading,
  stats,
  health,
  offlineNodes,
}: {
  loading: boolean;
  stats: DashboardStats;
  health: DashboardHealth;
  offlineNodes: NodeBasicInfo[];
}) => {
  const { t } = useTranslation();

  const healthDesc = {
    empty: t("dashboard.health.emptyDesc", "No servers have been added yet."),
    healthy: t(
      "dashboard.health.healthyDesc",
      "All servers are online and healthy.",
    ),
    warning: t(
      "dashboard.health.warningDesc",
      "Some servers are offline, please check.",
    ),
    danger: t(
      "dashboard.health.dangerDesc",
      "Most servers are offline, cluster is abnormal.",
    ),
  };

  return (
    <Skeletonize loading={loading}>
    <Flex gap="4" align="center">
      <ProgressRing
        percent={stats.onlineRate}
        color={health.color}
        ariaLabel={t(
          "dashboard.onlineRateAria",
          "{{percent}}% of servers online",
          {
            percent: stats.onlineRate.toFixed(0),
          },
        )}
      />
      <Flex direction="column" gap="2" style={{ minWidth: 0 }}>
        <Text size="4" weight="bold" className="truncate">
          {healthDesc[health.level]}
        </Text>
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">
            {t("dashboard.overview", "Overview")}
          </Text>
          {/* feedback 层：在线数只在真的变化时播一次轻微过冲 */}
          <Text size="2" weight="medium">
            <StatusFeedback state={stats.online}>
              {t("dashboard.onlineNodes", "Online {{online}}/{{total}}", {
                online: stats.online,
                total: stats.total,
              })}
            </StatusFeedback>
          </Text>
          <Tips
            side="right"
            className="mr-auto"
            ariaLabel={t("dashboard.offlineListAria", "Offline servers")}
            trigger={
              <Text
                size="2"
                weight="medium"
                color={stats.offline > 0 ? "red" : "gray"}
                className={
                  offlineNodes.length > 0
                    ? "cursor-pointer hover:underline"
                    : ""
                }
              >
                <StatusFeedback state={stats.offline}>
                  {t("dashboard.offlineNodes", "Offline {{offline}}", {
                    offline: stats.offline,
                  })}
                </StatusFeedback>
              </Text>
            }
          >
            {offlineNodes.length > 0 ? (
              <Flex direction="column" gap="1">
                {offlineNodes.map((node) => (
                  <Text key={node.uuid} size="2">
                    {node.name}
                  </Text>
                ))}
              </Flex>
            ) : (
              <Text size="2">
                {t("dashboard.noOfflineNodes", "All servers are online")}
              </Text>
            )}
          </Tips>
        </Flex>
      </Flex>
    </Flex>
    </Skeletonize>
  );
};
