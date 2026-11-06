import { Flex, Text } from "@radix-ui/themes";
import { ArrowUpRight, Bell, Boxes, Cpu, HardDrive, MemoryStick, Server, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import { formatBytes } from "@/utils/unitHelper";
import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import { AnimatedNumber } from "@/components/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";

export type DashboardStatus = { online?: boolean; disk?: number };

export function ExtraWidget({ kind, nodes, latest, limit = 5, loading = false }: {
  kind: "resources" | "disk" | "shortcuts";
  nodes: NodeBasicInfo[];
  latest: Record<string, DashboardStatus> | null;
  limit?: number;
  /** 数据未到：用同结构的占位渲染并骨架化（shortcuts 是静态链接，不受影响） */
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const icons = { resources: Boxes, disk: HardDrive, shortcuts: Terminal };
  const Icon = icons[kind];
  const disks = nodes.flatMap((node) => {
    const status = latest?.[node.uuid];
    if (!status?.online || typeof status.disk !== "number" || !Number.isFinite(status.disk) || node.disk_total <= 0) return [];
    return [{ ...node, used: Math.max(0, status.disk), percent: Math.max(0, status.disk / node.disk_total * 100) }];
  }).sort((a, b) => b.percent - a.percent).slice(0, limit);
  // feedback 层：总量用滚动数字，只有真的变化时才动
  // 加载中不挂 AnimatedNumber：否则数据到达时会从 0 滚到总量，像是在「增长」
  const resources = [
    { label: t("dashboardLayout.cores"), value: loading ? skeletonText(3) : <AnimatedNumber value={nodes.reduce((sum, node) => sum + (node.cpu_cores || 0), 0)} />, icon: Cpu },
    { label: t("dashboardLayout.ram"), value: loading ? skeletonText(7) : <AnimatedNumber value={nodes.reduce((sum, node) => sum + (node.mem_total || 0), 0)} format={formatBytes} />, icon: MemoryStick },
    { label: t("dashboardLayout.storage"), value: loading ? skeletonText(7) : <AnimatedNumber value={nodes.reduce((sum, node) => sum + (node.disk_total || 0), 0)} format={formatBytes} />, icon: HardDrive },
  ];
  return <Flex direction="column" gap="4">
    <Flex gap="2" align="center">
      <Icon size={18} color={`var(--${kind === "disk" ? "amber" : "gray"}-11)`} />
      <Text size="3" weight="bold">{t(`dashboardLayout.widgets.${kind}`)}</Text>
    </Flex>
    {kind === "resources" && <Skeletonize loading={loading}>
      {resources.map(({ label, value, icon: ResourceIcon }) => <div key={label} className="km-dashboard-stat-row">
        <Flex align="center" gap="2"><ResourceIcon size={15} color="var(--gray-10)" /><Text size="2" color="gray">{label}</Text></Flex>
        <Text size="4" weight="bold">{value}</Text>
      </div>)}
      <Text as="p" size="1" color="gray" mt="2">{loading ? skeletonText(12) : t("dashboardLayout.capacityCount", { count: nodes.length })}</Text>
    </Skeletonize>}
    {kind === "disk" && <Skeletonize loading={loading}>{loading ? <Flex direction="column" gap="3">
      {/* 占位行：名称 + 百分比 / 条 / 容量，与真实行同结构 */}
      {Array.from({ length: Math.min(limit, 3) }, (_, index) => <div key={index} className="flex flex-col gap-1">
        <Flex justify="between" gap="2" align="center">
          <Text size="2">{skeletonText(10 - index)}</Text>
          <Text size="2" weight="bold">{skeletonText(5)}</Text>
        </Flex>
        <div className="km-dashboard-meter" />
        <Text size="1">{skeletonText(14)}</Text>
      </div>)}
    </Flex> : disks.length ? <Flex direction="column" gap="3" className="relative">
      {/*
        content 层：磁盘占用行只在排序/成员变化时补位，条宽变化由 CSS token 过渡。
        layout="position" + 顺序 key：所在卡片被拖动或网格重排时不跟着再滑一遍（避免与 dnd-kit 双重位移）。
      */}
      <AnimatePresence initial={false} mode="popLayout">
      {disks.map((node) => <motion.div
        key={node.uuid}
        layout="position"
        layoutDependency={disks.map((entry) => entry.uuid).join("|")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ layout: MOTION_SPRING.layout, opacity: MOTION_TRANSITION.fadeIn }}
        className="flex flex-col gap-1"
      >
        <Flex justify="between" gap="2" align="center">
          <Text size="2" className="truncate" title={node.name}>{node.name}</Text>
          <Text size="2" weight="bold" color={node.percent >= 90 ? "red" : node.percent >= 75 ? "amber" : "green"}>{node.percent.toFixed(1)}%</Text>
        </Flex>
        <div className="km-dashboard-meter"><div style={{ width: `${Math.min(100, node.percent)}%`, background: `var(--${node.percent >= 90 ? "red" : node.percent >= 75 ? "amber" : "green"}-9)` }} /></div>
        <Text size="1" color="gray">{formatBytes(node.used)} / {formatBytes(node.disk_total)}</Text>
      </motion.div>)}
      </AnimatePresence>
    </Flex> : <Text size="2" color="gray">{t("dashboard.noData", "No data")}</Text>}</Skeletonize>}
    {kind === "shortcuts" && <div>
      <Link className="km-dashboard-quick-link" to="/admin/servers"><Server size={17} />{t("dashboardLayout.servers")}<ArrowUpRight size={15} /></Link>
      <a className="km-dashboard-quick-link" href="/terminal" target="_blank" rel="noreferrer"><Terminal size={17} />{t("dashboardLayout.terminal")}<ArrowUpRight size={15} /></a>
      <Link className="km-dashboard-quick-link" to="/admin/settings/notification"><Bell size={17} />{t("dashboardLayout.notifications")}<ArrowUpRight size={15} /></Link>
    </div>}
  </Flex>;
}
