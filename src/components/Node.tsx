import {
  Card,
  Flex,
  Text,
  Badge,
  Separator,
  IconButton,
} from "@radix-ui/themes";
import type { LiveData, Record } from "../types/LiveData";
import UsageBar from "./UsageBar";
import Flag from "./Flag";
import { useTranslation } from "react-i18next";
import Tips from "./ui/tips";

/** 将字节转换为人类可读的大小 */

/** 格式化秒*/
export function formatUptime(seconds: number, t: TFunction): string {
  if (!seconds || seconds < 0) return t("nodeCard.time_second", { val: 0 });
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d} ${t("nodeCard.time_day")}`);
  if (h) parts.push(`${h} ${t("nodeCard.time_hour")}`);
  if (m) parts.push(`${m} ${t("nodeCard.time_minute")}`);
  if (s || parts.length === 0) parts.push(`${s} ${t("nodeCard.time_second")}`);
  return parts.join(" ");
}
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

interface NodeProps {
  basic: NodeBasicInfo;
  live: Record | undefined;
  online: boolean;
}
const Node = ({ basic, live, online }: NodeProps) => {
  const [t] = useTranslation();
  const isMobile = useIsMobile();
  const defaultLive = {
    cpu: { usage: 0 },
    ram: { used: 0 },
    disk: { used: 0 },
    network: { up: 0, down: 0, totalUp: 0, totalDown: 0 },
  } as Record;

  const liveData = live || defaultLive;

  const memoryUsagePercent = basic.mem_total
    ? (liveData.ram.used / basic.mem_total) * 100
    : 0;
  const diskUsagePercent = basic.disk_total
    ? (liveData.disk.used / basic.disk_total) * 100
    : 0;

  const uploadSpeed = formatBytes(liveData.network.up);
  const downloadSpeed = formatBytes(liveData.network.down);
  const totalUpload = formatBytes(liveData.network.totalUp);
  const totalDownload = formatBytes(liveData.network.totalDown);
  //const totalTraffic = formatBytes(liveData.network.totalUp + liveData.network.totalDown);
  return (
    <Card
      style={{
        width: "100%",
        margin: "0 auto",
        transition: "all 0.2s ease-in-out",
      }}
      className="node-card hover:cursor-pointer hover:bg-accent-2 overflow-hidden"
    >
      <Flex direction="column" gap="3">
        {/* Status indicator strip at the top */}
        <div 
          className={`h-1 w-full -mt-3 -mx-3 mb-1`} 
          style={{ 
            backgroundColor: online ? 'var(--chart-3)' : 'var(--destructive)',
            opacity: online ? 0.8 : 0.6,
            transition: 'background-color 0.3s ease'
          }}
        />
        
        <Flex justify="between" align="center" my={isMobile ? "-1" : "0"}>
          <Flex justify="start" align="center" style={{ flex: 1, minWidth: 0 }} gap="2">
            <div className="relative">
              <Flag flag={basic.region} className="rounded-full" />
              <div 
                className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-card ${online ? 'bg-green-500' : 'bg-red-500'}`}
              />
            </div>
            <Link to={`/instance/${basic.uuid}`} style={{ flex: 1, minWidth: 0 }}>
              <Flex direction="column" style={{ minWidth: 0 }}>
                <Text
                  weight="bold"
                  size={isMobile ? "2" : "4"}
                  truncate
                  style={{ maxWidth: "100%" }}
                  className="group-hover:text-primary transition-colors"
                >
                  {basic.name}
                </Text>
                <Text
                  color="gray"
                  hidden={!isMobile}
                  style={{
                    marginTop: "-3px",
                    fontSize: "0.728rem",
                  }}
                  className="text-sm"
                >
                  {formatUptime(liveData.uptime, t)}
                </Text>
                <PriceTags
                  hidden={isMobile}
                  price={basic.price}
                  billing_cycle={basic.billing_cycle}
                  expired_at={basic.expired_at}
                  currency={basic.currency}
                  tags={basic.tags}
                />
              </Flex>
            </Link>
          </Flex>
          <Flex gap="2" align="center" style={{ flex: "none" }}>
            {live?.message && <Tips color="#CE282E">{live.message}</Tips>}
            <MiniPingChartFloat
              uuid={basic.uuid}
              hours={24}
              trigger={
                <IconButton variant="ghost" size="1" className="rounded-full hover:bg-accent-3 transition-colors">
                  <TrendingUp size="14" />
                </IconButton>
              }
            />
            <Badge 
              color={online ? "green" : "red"} 
              variant="soft"
              radius="full"
              className="px-2 py-0.5"
            >
              {online ? t("nodeCard.online") : t("nodeCard.offline")}
            </Badge>
          </Flex>
        </Flex>

        <Separator size="4" className="-mt-1" />

        <Flex direction="column" gap="2">
          <Flex justify="between" hidden={isMobile}>
            <Text size="2" color="gray">
              OS
            </Text>
            <Flex align="center">
              <img
                src={getOSImage(basic.os)}
                alt={basic.os}
                className="w-5 h-5 mr-2"
              />
              <Text size="2">{getOSName(basic.os)} / {basic.arch}</Text>
            </Flex>
          </Flex>
          <Flex className="md:flex-col flex-row md:gap-1 gap-4">
            {/* CPU Usage */}
            <UsageBar label={t("nodeCard.cpu")} value={liveData.cpu.usage} />

            {/* Memory Usage */}
            <UsageBar label={t("nodeCard.ram")} value={memoryUsagePercent} />
            <Text
              className="md:block hidden"
              size="1"
              color="gray"
              style={{ marginTop: "-4px" }}
            >
              ({formatBytes(liveData.ram.used)} / {formatBytes(basic.mem_total)}
              )
            </Text>

            {/* Disk Usage */}
            <UsageBar label={t("nodeCard.disk")} value={diskUsagePercent} />
            <Text
              size="1"
              className="md:block hidden"
              color="gray"
              style={{ marginTop: "-4px" }}
            >
              ({formatBytes(liveData.disk.used)} /{" "}
              {formatBytes(basic.disk_total)})
            </Text>
          </Flex>

          <Flex justify="between" hidden={isMobile}>
            <Text size="2" color="gray">
              {t("nodeCard.networkSpeed")}
            </Text>
            <Text size="2">
              ↑ {uploadSpeed}/s ↓ {downloadSpeed}/s
            </Text>
          </Flex>

          <Flex justify="between" hidden={isMobile}>
            <Text size="2" color="gray">
              {t("nodeCard.totalTraffic")}
            </Text>
            <Text size="2">
              ↑ {totalUpload} ↓ {totalDownload}
            </Text>
          </Flex>
          <Flex justify="between" gap="2" hidden={!isMobile}>
            <Text size="2">{t("nodeCard.networkSpeed")}</Text>
            <Text size="2">
              ↑ {uploadSpeed}/s ↓ {downloadSpeed}/s
            </Text>
          </Flex>
          <Flex justify="between" gap="2" hidden={!isMobile}>
            <Text size="2">{t("nodeCard.totalTraffic")}</Text>
            <Text size="2">
              ↑ {totalUpload} ↓ {totalDownload}
            </Text>
          </Flex>
          <Flex justify="between" hidden={isMobile}>
            <Text size="2" color="gray">
              {t("nodeCard.uptime")}
            </Text>
            {online ? (
              <Text size="2">{formatUptime(liveData.uptime, t)}</Text>
            ) : (
              <Text size="2" color="gray">
                -
              </Text>
            )}
          </Flex>
        </Flex>
        <PriceTags
          hidden={!isMobile}
          price={basic.price}
          billing_cycle={basic.billing_cycle}
          expired_at={basic.expired_at}
          currency={basic.currency}
          tags={basic.tags || ""}
        />
      </Flex>
    </Card>
  );
};

export default Node;

type NodeGridProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
};

import { Box } from "@radix-ui/themes";
import type { TFunction } from "i18next";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import PriceTags from "./PriceTags";
import { TrendingUp } from "lucide-react";
import MiniPingChartFloat from "./MiniPingChartFloat";
import { getOSImage, getOSName } from "@/utils";
export const NodeGrid = ({ nodes, liveData }: NodeGridProps) => {
  // Ensure liveData is valid
  const onlineNodes = liveData && liveData.online ? liveData.online : [];
  const isMobile = useIsMobile();

  // Sort nodes: first by online/offline status, then by weight
  const sortedNodes = [...nodes].sort((a, b) => {
    const aOnline = onlineNodes.includes(a.uuid);
    const bOnline = onlineNodes.includes(b.uuid);

    // If one is online and one is offline, online comes first
    if (aOnline !== bOnline) {
      return aOnline ? -1 : 1;
    }

    // If both are online or both are offline, sort by weight (lower weight first)
    return a.weight - b.weight;
  });

  return (
    <Box
      className="animate-fadeIn"
      style={{
        display: "grid",
        gridTemplateColumns: isMobile 
          ? "1fr" 
          : "repeat(auto-fill, minmax(min(100%, 350px), 1fr))",
        gap: isMobile ? "1rem" : "1.25rem",
        padding: isMobile ? "0.75rem" : "1.25rem",
        width: "100%",
        boxSizing: "border-box",
        transition: "padding 0.3s ease, gap 0.3s ease",
      }}
    >
      {sortedNodes.map((node, index) => {
        const isOnline = onlineNodes.includes(node.uuid);
        const nodeData =
          liveData && liveData.data ? liveData.data[node.uuid] : undefined;

        return (
          <div 
            key={node.uuid} 
            className="animate-slideUp"
            style={{ 
              animationDelay: `${index * 0.05}s`,
              opacity: 0,
              animationFillMode: 'forwards'
            }}
          >
            <Node
              basic={node}
              live={nodeData}
              online={isOnline}
            />
          </div>
        );
      })}
    </Box>
  );
};
