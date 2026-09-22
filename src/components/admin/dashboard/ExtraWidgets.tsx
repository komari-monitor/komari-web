import { Flex, Text } from "@radix-ui/themes";
import { ArrowUpRight, Bell, Boxes, Cpu, HardDrive, MemoryStick, Server, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import { formatBytes } from "@/utils/unitHelper";

export type DashboardStatus = { online?: boolean; disk?: number };

export function ExtraWidget({ kind, nodes, latest, limit = 5 }: {
  kind: "resources" | "disk" | "shortcuts";
  nodes: NodeBasicInfo[];
  latest: Record<string, DashboardStatus> | null;
  limit?: number;
}) {
  const { t } = useTranslation();
  const icons = { resources: Boxes, disk: HardDrive, shortcuts: Terminal };
  const Icon = icons[kind];
  const disks = nodes.flatMap((node) => {
    const status = latest?.[node.uuid];
    if (!status?.online || typeof status.disk !== "number" || !Number.isFinite(status.disk) || node.disk_total <= 0) return [];
    return [{ ...node, used: Math.max(0, status.disk), percent: Math.max(0, status.disk / node.disk_total * 100) }];
  }).sort((a, b) => b.percent - a.percent).slice(0, limit);
  const resources = [
    { label: t("dashboardLayout.cores"), value: nodes.reduce((sum, node) => sum + (node.cpu_cores || 0), 0).toLocaleString(), icon: Cpu },
    { label: t("dashboardLayout.ram"), value: formatBytes(nodes.reduce((sum, node) => sum + (node.mem_total || 0), 0)), icon: MemoryStick },
    { label: t("dashboardLayout.storage"), value: formatBytes(nodes.reduce((sum, node) => sum + (node.disk_total || 0), 0)), icon: HardDrive },
  ];
  return <Flex direction="column" gap="3">
    <Flex gap="2" align="center">
      <Icon size={18} color={`var(--${kind === "disk" ? "amber" : "gray"}-11)`} />
      <Text size="3" weight="bold">{t(`dashboardLayout.widgets.${kind}`)}</Text>
    </Flex>
    {kind === "resources" && <div>
      {resources.map(({ label, value, icon: ResourceIcon }) => <div key={label} className="km-dashboard-stat-row">
        <Flex align="center" gap="2"><ResourceIcon size={15} color="var(--gray-10)" /><Text size="2" color="gray">{label}</Text></Flex>
        <Text size="4" weight="bold">{value}</Text>
      </div>)}
      <Text as="p" size="1" color="gray" mt="3">{t("dashboardLayout.capacityCount", { count: nodes.length })}</Text>
    </div>}
    {kind === "disk" && (disks.length ? <Flex direction="column" gap="3">
      {disks.map((node) => <Flex direction="column" gap="1" key={node.uuid}>
        <Flex justify="between" gap="2" align="center">
          <Text size="2" className="truncate" title={node.name}>{node.name}</Text>
          <Text size="2" weight="bold" color={node.percent >= 90 ? "red" : node.percent >= 75 ? "amber" : "green"}>{node.percent.toFixed(1)}%</Text>
        </Flex>
        <div className="km-dashboard-meter"><div style={{ width: `${Math.min(100, node.percent)}%`, background: `var(--${node.percent >= 90 ? "red" : node.percent >= 75 ? "amber" : "green"}-9)` }} /></div>
        <Text size="1" color="gray">{formatBytes(node.used)} / {formatBytes(node.disk_total)}</Text>
      </Flex>)}
    </Flex> : <Text size="2" color="gray">{t("dashboard.noData", "No data")}</Text>)}
    {kind === "shortcuts" && <div>
      <Link className="km-dashboard-quick-link" to="/admin/servers"><Server size={17} />{t("dashboardLayout.servers")}<ArrowUpRight size={15} /></Link>
      <a className="km-dashboard-quick-link" href="/terminal" target="_blank" rel="noreferrer"><Terminal size={17} />{t("dashboardLayout.terminal")}<ArrowUpRight size={15} /></a>
      <Link className="km-dashboard-quick-link" to="/admin/settings/notification"><Bell size={17} />{t("dashboardLayout.notifications")}<ArrowUpRight size={15} /></Link>
    </div>}
  </Flex>;
}
