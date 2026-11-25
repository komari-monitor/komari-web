import { useCallback, useState } from "react";
import { Button } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Cpu, MemoryStick, RefreshCw } from "lucide-react";
import {
  DashboardBoard,
  DashboardWidget,
  type DashboardBoardState,
} from "@/components/admin/dashboard/DashboardBoard";
import { ExtraWidget } from "@/components/admin/dashboard/ExtraWidgets";
import PageHeader from "@/components/PageHeader";
import { BillingWidget } from "./dashboard/BillingWidget";
import { DatabaseWidget } from "./dashboard/DatabaseWidget";
import { ExpiryWidget } from "./dashboard/ExpiryWidget";
import { GlobeWidget } from "./dashboard/GlobeWidget";
import { LiveBandwidthWidget } from "./dashboard/LiveBandwidthWidget";
import { OverviewWidget } from "./dashboard/OverviewWidget";
import { PingWidget } from "./dashboard/PingWidget";
import { TopRankCard } from "./dashboard/TopRankCard";
import { TrafficQuotaWidget } from "./dashboard/TrafficQuotaWidget";
import { TrafficWidget } from "./dashboard/TrafficWidget";
import { UptimeWidget } from "./dashboard/UptimeWidget";
import { useDashboardData } from "./dashboard/useDashboardData";
import { CPU_METRIC_KEYS, MEM_METRIC_KEYS } from "./dashboard/utils";

const Dashboard = () => {
  return <DashboardContent />;
};

const DashboardContent = () => {
  const { t } = useTranslation();
  const [livePollingEnabled, setLivePollingEnabled] = useState(true);
  const [boardState, setBoardState] = useState<DashboardBoardState>({
    visibleIds: new Set(),
    editing: false,
    dragging: false,
  });

  const handleBoardStateChange = useCallback((next: DashboardBoardState) => {
    setBoardState(next);
  }, []);

  const shouldPollLatest =
    livePollingEnabled &&
    !boardState.editing &&
    !boardState.dragging &&
    boardState.visibleIds.has("liveBandwidth");

  const {
    nodeList,
    isLoading,
    error,
    latest,
    loaded,
    refreshing,
    fetchAll,
    dbInfo,
    traffic,
    topCpu,
    topMem,
    nodeNameMap,
    stats,
    health,
    offlineNodes,
    expiringNodes,
    renewingUuid,
    handleRenew,
    stableLatencyItems,
    unstableLatencyItems,
    highestLossItems,
    trafficQuotaItems,
    billingSummary,
    liveBandwidth,
    uptimeSummary,
    globeSummary,
  } = useDashboardData({ pollLatest: shouldPollLatest });

  if (error) return <div>{error}</div>;

  // 首屏不再整页 early return：每个 widget 用真实结构 + 占位数据骨架化，数据到哪块就揭开哪块
  const nodesLoading = isLoading;
  const overviewLoading = nodesLoading || !loaded.latest;
  const metricsLoading = !loaded.metrics;
  const pingLoading = !loaded.ping || !loaded.metrics;

  return (
    <div className="km-page km-page-admin-dashboard">
      <PageHeader
        title={t("dashboard.title", "Dashboard")}
        description={t(
          "dashboard.greeting",
          "May every server run smoothly and everything is under control.",
        )}
        actions={
          <Button
            size="1"
            variant="soft"
            disabled={refreshing}
            onClick={() => void fetchAll()}
          >
            <RefreshCw size={14} />
            {t("common.refresh", "Refresh")}
          </Button>
        }
      />

      <DashboardBoard onStateChange={handleBoardStateChange}>
        <DashboardWidget id="overview">
          <OverviewWidget
            loading={overviewLoading}
            stats={stats}
            health={health}
            offlineNodes={offlineNodes}
          />
        </DashboardWidget>

        <DashboardWidget id="globe">
          <GlobeWidget loading={overviewLoading} summary={globeSummary} />
        </DashboardWidget>

        <DashboardWidget id="trafficQuota" supportsLimit>
          {(limit) => (
            <TrafficQuotaWidget
              items={trafficQuotaItems}
              limit={limit}
              loading={overviewLoading}
            />
          )}
        </DashboardWidget>

        <DashboardWidget id="billing">
          <BillingWidget summary={billingSummary} loading={nodesLoading} />
        </DashboardWidget>

        <DashboardWidget id="database">
          <DatabaseWidget dbInfo={dbInfo} loaded={loaded.db} />
        </DashboardWidget>

        <DashboardWidget id="expiry" supportsLimit>
          {(limit) => (
            <ExpiryWidget
              limit={limit}
              loading={nodesLoading}
              nodes={expiringNodes}
              renewingUuid={renewingUuid}
              onRenew={handleRenew}
            />
          )}
        </DashboardWidget>

        <DashboardWidget id="liveBandwidth" supportsLimit>
          {(limit) => (
            <LiveBandwidthWidget
              summary={liveBandwidth}
              limit={limit}
              loading={overviewLoading}
              liveEnabled={livePollingEnabled}
              onToggleLive={() => setLivePollingEnabled((prev) => !prev)}
            />
          )}
        </DashboardWidget>

        <DashboardWidget id="traffic" supportsLimit>
          {(limit) => (
            <TrafficWidget
              limit={limit}
              loading={metricsLoading}
              traffic={traffic}
              nodeNameMap={nodeNameMap}
            />
          )}
        </DashboardWidget>

        <DashboardWidget id="cpu" supportsLimit>
          {(limit) => (
            <TopRankCard
              title={t("dashboard.topCpu", "Top CPU usage")}
              icon={<Cpu size={18} />}
              items={topCpu}
              loading={metricsLoading || nodesLoading}
              limit={limit}
              metricKeys={CPU_METRIC_KEYS}
              t={t}
            />
          )}
        </DashboardWidget>

        <DashboardWidget id="memory" supportsLimit>
          {(limit) => (
            <TopRankCard
              title={t("dashboard.topMem", "Top memory usage")}
              icon={<MemoryStick size={18} />}
              items={topMem}
              loading={metricsLoading || nodesLoading}
              limit={limit}
              metricKeys={MEM_METRIC_KEYS}
              t={t}
            />
          )}
        </DashboardWidget>

        <DashboardWidget id="uptime" supportsLimit>
          {(limit) => (
            <UptimeWidget
              summary={uptimeSummary}
              limit={limit}
              loading={overviewLoading}
            />
          )}
        </DashboardWidget>

        <DashboardWidget id="ping" supportsLimit>
          {(limit) => (
            <PingWidget
              limit={limit}
              loading={pingLoading}
              stableItems={stableLatencyItems}
              unstableItems={unstableLatencyItems}
              lossItems={highestLossItems}
            />
          )}
        </DashboardWidget>

        <DashboardWidget id="resources">
          <ExtraWidget
            kind="resources"
            nodes={nodeList ?? []}
            latest={latest}
            loading={nodesLoading}
          />
        </DashboardWidget>

        <DashboardWidget id="disk" supportsLimit>
          {(limit) => (
            <ExtraWidget
              kind="disk"
              nodes={nodeList ?? []}
              latest={latest}
              limit={limit}
              loading={overviewLoading}
            />
          )}
        </DashboardWidget>

        <DashboardWidget id="shortcuts">
          <ExtraWidget kind="shortcuts" nodes={nodeList ?? []} latest={latest} />
        </DashboardWidget>
      </DashboardBoard>
    </div>
  );
};

export default Dashboard;
