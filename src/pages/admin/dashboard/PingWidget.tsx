import { useState, type ReactNode } from "react";
import { Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Gauge } from "lucide-react";
import { useDashboardWidgetContext } from "@/components/admin/dashboard/widgetContext";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { MiniChartButton, RankEntryRow, RankListPopover } from "./RankList";
import type { PingRankItem } from "./types";
import { PING_METRIC_KEYS, latencyColor, volatilityColor } from "./utils";

type PingTab = "stable" | "unstable" | "loss";

/** 延迟排行的一列：标题 + 完整列表弹层 + 前 limit 条 */
const LatencyColumn = ({
  title,
  items,
  renderValue,
  limit,
  loading = false,
}: {
  title: string;
  items: PingRankItem[];
  renderValue: (item: PingRankItem) => ReactNode;
  limit: number;
  loading?: boolean;
}) => {
  const { t } = useTranslation();
  const renderRow = (item: PingRankItem, index: number) => (
    <RankEntryRow key={item.key} index={index} name={item.label} title={item.label}>
      {renderValue(item)}
      <MiniChartButton
        uuid={item.entityId}
        metricKeys={PING_METRIC_KEYS}
        tags={{ task_id: item.taskId }}
        ariaLabel={t("dashboard.viewChart", "View 24h chart")}
      />
    </RankEntryRow>
  );
  return (
    <Flex direction="column" gap="2" className="flex-1 min-w-56">
      <Flex justify="between" align="center" gap="2">
        <Text size="2" weight="bold">
          {title}
        </Text>
        <RankListPopover
          title={title}
          ariaLabel={t("common.details", "Details")}
        >
          {items.length === 0 ? (
            <Text size="2" color="gray">
              {t("dashboard.noData", "No data")}
            </Text>
          ) : (
            <Flex direction="column" gap="2">
              {items.map(renderRow)}
            </Flex>
          )}
        </RankListPopover>
      </Flex>
      {loading ? (
        <Flex direction="column" gap="2">
          {Array.from({ length: limit }, (_, index) => (
            <Flex key={index} justify="between" align="center" gap="2">
              <Text size="2">{skeletonText(14 - (index % 3) * 2)}</Text>
              <Text size="2">{skeletonText(12)}</Text>
            </Flex>
          ))}
        </Flex>
      ) : items.length === 0 ? (
        <Text size="2" color="gray">
          {t("dashboard.noData", "No data")}
        </Text>
      ) : (
        <Flex direction="column" gap="2">
          {items.slice(0, limit).map(renderRow)}
        </Flex>
      )}
    </Flex>
  );
};

/** 延迟：最稳定 / 最不稳定 / 丢包最高 三列排行 */
export const PingWidget = ({
  limit,
  loading,
  stableItems,
  unstableItems,
  lossItems,
}: {
  limit: number;
  loading: boolean;
  stableItems: PingRankItem[];
  unstableItems: PingRankItem[];
  lossItems: PingRankItem[];
}) => {
  const { t } = useTranslation();
  const { width } = useDashboardWidgetContext();
  const [tab, setTab] = useState<PingTab>("stable");
  const compactMode = width === "compact";

  const renderLatencyValue = (item: PingRankItem) => (
    <Text size="2" className="whitespace-nowrap">
      <Text
        size="2"
        color={item.p95 != null ? latencyColor(item.p95) : "gray"}
      >
        {item.p95 != null ? `${Math.round(item.p95)} ms` : "-"}
      </Text>{" "}
      ·{" "}
      <Text size="2" color={volatilityColor(item.volatility)}>
        {t("chart.volatility", "Volatility")} {item.volatility.toFixed(2)}
      </Text>
    </Text>
  );

  const renderLossValue = (item: PingRankItem) => (
    <Text size="2" className="whitespace-nowrap">
      {item.loss.toFixed(1)}%
    </Text>
  );

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center" gap="2" wrap="wrap" style={{ color: "var(--gray-10)" }}>
        <Flex gap="2" align="center">
          <Gauge size={18} />
          <Text size="3" weight="bold">
            {t("nodeCard.ping", "Ping")}
          </Text>
        </Flex>
        {compactMode && (
          <SegmentedControl.Root
            size="1"
            value={tab}
            onValueChange={(value) => setTab(value as PingTab)}
          >
            <SegmentedControl.Item value="stable">
              {t("dashboard.pingTabStable", "Stable")}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="unstable">
              {t("dashboard.pingTabUnstable", "Jitter")}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="loss">
              {t("dashboard.pingTabLoss", "Loss")}
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        )}
      </Flex>
      <Skeletonize loading={loading}>
      {compactMode ? (
        tab === "stable" ? (
          <LatencyColumn
            title={t("dashboard.stableLatency", "Most stable latency")}
            items={stableItems}
            renderValue={renderLatencyValue}
            limit={limit}
            loading={loading}
          />
        ) : tab === "unstable" ? (
          <LatencyColumn
            title={t("dashboard.unstableLatency", "Most unstable latency")}
            items={unstableItems}
            renderValue={renderLatencyValue}
            limit={limit}
            loading={loading}
          />
        ) : (
          <LatencyColumn
            title={t("dashboard.highestLoss", "Highest packet loss")}
            items={lossItems}
            renderValue={renderLossValue}
            limit={limit}
            loading={loading}
          />
        )
      ) : (
      <Flex gap="5" wrap="wrap">
        <LatencyColumn
          title={t("dashboard.stableLatency", "Most stable latency")}
          items={stableItems}
          renderValue={renderLatencyValue}
          limit={limit}
          loading={loading}
        />
        <LatencyColumn
          title={t("dashboard.unstableLatency", "Most unstable latency")}
          items={unstableItems}
          renderValue={renderLatencyValue}
          limit={limit}
          loading={loading}
        />
        <LatencyColumn
          title={t("dashboard.highestLoss", "Highest packet loss")}
          items={lossItems}
          renderValue={renderLossValue}
          limit={limit}
          loading={loading}
        />
      </Flex>
      )}
      </Skeletonize>
    </Flex>
  );
};
