import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import Flag from "./Flag";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { LiveData, NodeBasicInfo, Record } from "@/types/NodeInfo";
import { useIsMobile } from "@/hooks/use-mobile";
import UsageBar from "./ui/UsageBar";
import { formatUptime } from "@/utils/formatTime";
function formatOs(os: string): string {
  const patterns = [
    { regex: /debian/i, name: "Debian" },
    { regex: /ubuntu/i, name: "Ubuntu" },
    { regex: /windows/i, name: "Windows" },
    { regex: /arch/i, name: "Arch" },
    { regex: /alpine/i, name: "Alpine" },
    { regex: /centos/i, name: "CentOS" },
    { regex: /fedora/i, name: "Fedora" },
    { regex: /red\s*hat/i, name: "RHEL" },
    { regex: /opensuse/i, name: "openSUSE" },
    { regex: /manjaro/i, name: "Manjaro" },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(os)) {
      return pattern.name;
    }
  }

  return os.split(/[\s/]/)[0];
}

function formatBytes(bytes: number): string {
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
    uptime: 0,
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
    <Link to={`/instance/${basic.uuid}`}>
      <Card className="w-full mx-auto transition-all duration-200 ease-in-out hover:shadow-2xl hover:scale-102 hover:cursor-pointer p-3 md:p-4">
        <div className={`flex flex-col ${isMobile ? "gap-2" : "gap-3"}`}>
          <div
            className={`flex justify-between items-center ${
              isMobile ? "my-[-2px]" : "my-0"
            }`}
          >
            <div className="flex justify-start items-center space-x-2">
              <Flag flag={basic.region} />
              <div className="flex flex-col">
                <p
                  className={`font-bold ${
                    isMobile ? "text-sm" : "text-base"
                  } truncate max-w-[180px] sm:max-w-[200px]`}
                >
                  {basic.name}
                </p>
                <p
                  className={`text-muted-foreground ${
                    !isMobile ? "hidden" : ""
                  } mt-[-3px] text-[0.728rem]`}
                >
                  {formatUptime(liveData.uptime, t)}
                </p>
              </div>
            </div>

            <Badge
              className={
                online
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
              }
            >
              {online ? t("nodeCard.online") : t("nodeCard.offline")}
            </Badge>
          </div>

          <Separator className="my-1 md:my-2" />

          <div className="flex flex-col gap-2">
            <div
              className={`flex justify-between ${isMobile ? "hidden" : "flex"}`}
            >
              <p className="text-sm text-muted-foreground">OS</p>
              <p className="text-sm">
                {formatOs(basic.os)} - {basic.arch}
              </p>
            </div>
            <div className="flex md:flex-col flex-row md:gap-1 gap-3">
              {/* CPU Usage */}
              <UsageBar label={t("nodeCard.cpu")} value={liveData.cpu.usage} />

              {/* Memory Usage */}
              <UsageBar label={t("nodeCard.ram")} value={memoryUsagePercent} />
              <p className="text-xs text-muted-foreground mt-[-4px] hidden md:block">
                ({formatBytes(liveData.ram.used)} /{" "}
                {formatBytes(basic.mem_total)})
              </p>

              {/* Disk Usage */}
              <UsageBar label={t("nodeCard.disk")} value={diskUsagePercent} />
              <p className="text-xs text-muted-foreground mt-[-4px] hidden md:block">
                ({formatBytes(liveData.disk.used)} /{" "}
                {formatBytes(basic.disk_total)})
              </p>
            </div>

            <div
              className={`flex justify-between ${isMobile ? "hidden" : "flex"}`}
            >
              <p className="text-sm text-muted-foreground">
                {t("nodeCard.networkSpeed")}
              </p>
              <p className="text-sm">
                ↑ {uploadSpeed}/s ↓ {downloadSpeed}/s
              </p>
            </div>

            <div
              className={`flex justify-between ${isMobile ? "hidden" : "flex"}`}
            >
              <p className="text-sm text-muted-foreground">
                {t("nodeCard.totalTraffic")}
              </p>
              <p className="text-sm">
                ↑ {totalUpload} ↓ {totalDownload}
              </p>
            </div>
            <div
              className={`flex justify-between gap-2 ${
                !isMobile ? "hidden" : "flex"
              }`}
            >
              <p className="text-sm">{t("nodeCard.networkSpeed")}</p>
              <p className="text-sm">
                ↑ {uploadSpeed}/s ↓ {downloadSpeed}/s
              </p>
            </div>
            <div
              className={`flex justify-between gap-2 ${
                !isMobile ? "hidden" : "flex"
              }`}
            >
              <p className="text-sm">{t("nodeCard.totalTraffic")}</p>
              <p className="text-sm">
                ↑ {totalUpload} ↓ {totalDownload}
              </p>
            </div>
            <div
              className={`flex justify-between ${isMobile ? "hidden" : "flex"}`}
            >
              <p className="text-sm text-muted-foreground">
                {t("nodeCard.uptime")}
              </p>
              {online ? (
                <p className="text-sm">{formatUptime(liveData.uptime, t)}</p>
              ) : (
                <p className="text-sm text-muted-foreground">-</p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

type NodeGridProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
};

export const NodeGrid = ({ nodes, liveData }: NodeGridProps) => {
  const onlineNodes = liveData && liveData.online ? liveData.online : [];
  const sortedNodes = [...nodes].sort((a, b) => {
    const aOnline = onlineNodes.includes(a.uuid);
    const bOnline = onlineNodes.includes(b.uuid);
    if (aOnline !== bOnline) {
      return aOnline ? -1 : 1;
    }
    return a.weight - b.weight;
  });

  return (
    <div
      className="grid gap-2 md:gap-4 p-4 w-full box-border"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
      }}
    >
      {sortedNodes.map((node) => {
        const isOnline = onlineNodes.includes(node.uuid);
        const nodeData =
          liveData && liveData.data ? liveData.data[node.uuid] : undefined;

        return (
          <Node
            key={node.uuid}
            basic={node}
            live={nodeData}
            online={isOnline}
          />
        );
      })}
    </div>
  );
};
