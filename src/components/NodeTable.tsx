import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge, Flex, IconButton } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronUp } from "lucide-react";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData, Record } from "../types/LiveData";
import { formatUptime } from "@/utils/unitHelper";
import { compareNodesByStatus, EMPTY_LIVE_RECORD } from "@/utils/nodeOrder";
import { settledLayoutTransition, useOrderSettled } from "@/hooks/useOrderSettled";
import { preloadInstancePage } from "./preloadInstancePage";
import { formatBytes } from "@/utils/unitHelper";
import UsageBar from "./UsageBar";
import Flag from "./Flag";
import PriceTags from "./PriceTags";
import Tips from "./ui/tips";
import { DetailsGrid } from "./DetailsGrid";
import MiniPingChart from "./MiniPingChart";
import { getOSImage } from "@/utils";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { AnimatePresence, motion } from "motion/react";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import {
  CONTROL_MOTION,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { sharedHeroStyle, useSharedHero } from "@/lib/sharedElement";
import { StatusFeedback } from "@/components/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";

interface NodeTableProps {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  onlineSet: ReadonlySet<string>;
  /** live 数据第一次请求还没回来：数值、状态画成与文字等宽的骨架条 */
  liveLoading?: boolean;
}

type SortField =
  | "name"
  | "os"
  | "status"
  | "cpu"
  | "ram"
  | "disk"
  | "price"
  | "networkUp"
  | "networkDown"
  | "totalUp"
  | "totalDown";
type SortOrder = "asc" | "desc" | "default";

interface SortState {
  field: SortField | null;
  order: SortOrder;
}


const NodeTable: React.FC<NodeTableProps> = ({ nodes, liveData, onlineSet, liveLoading = false }) => {
  const [t] = useTranslation();
  const { navigate: navigateWithTransition } = useViewTransitionNavigate();
  const { publicInfo, isLoading: publicInfoLoading } = usePublicInfo();
  // 默认顺序依赖实时状态和「离线节点位置」设置：首次定序瞬时完成，之后的重排才补位
  const orderSettled = useOrderSettled(!liveLoading && !publicInfoLoading);
  const offlineServerPosition =
    publicInfo?.theme_settings?.offlineServerPosition;
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  // 小骨架：只包住数值本身；live 到达时同一批 DOM 上条淡出、数字淡入
  const sk = (node: React.ReactNode, chars = 7) => (
    <Skeletonize as="span" loading={liveLoading}>
      {liveLoading ? skeletonText(chars) : node}
    </Skeletonize>
  );
  const [sortState, setSortState] = useState<SortState>({
    field: null,
    order: "default",
  });

  const toggleRowExpansion = useCallback((uuid: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(uuid)) {
        newSet.delete(uuid);
      } else {
        newSet.add(uuid);
      }
      return newSet;
    });
  }, []);

  const handleSort = useCallback((field: SortField) => {
    return (event: React.MouseEvent) => {
      event.preventDefault();

      setSortState((prev) => {
        if (prev.field === field) {
          // 循环切换：default -> asc -> desc -> default
          const nextOrder: SortOrder =
            prev.order === "default"
              ? "asc"
              : prev.order === "asc"
                ? "desc"
                : "default";
          return {
            field: nextOrder === "default" ? null : field,
            order: nextOrder,
          };
        } else {
          // 新字段，从正序开始
          return { field, order: "asc" };
        }
      });
    };
  }, []);

  const getSortIcon = useCallback(
    (field: SortField) => (
      <SortIcon order={sortState.field === field ? sortState.order : null} />
    ),
    [sortState.field, sortState.order],
  );

  const getNodeData = useCallback(
    (uuid: string): Record => liveData.data[uuid] || EMPTY_LIVE_RECORD,
    [liveData.data],
  );

  // 排序节点函数
  const sortedNodes = useMemo(() => [...nodes].sort((a, b) => {
    const aOnline = onlineSet.has(a.uuid);
    const bOnline = onlineSet.has(b.uuid);
    const aData = getNodeData(a.uuid);
    const bData = getNodeData(b.uuid);

    // 如果没有排序字段或为默认排序，使用原来的排序逻辑
    if (!sortState.field || sortState.order === "default") {
      // 遵循后台离线节点位置设置（First/Keep/Last），再按权重排序
      return compareNodesByStatus(a, b, onlineSet, offlineServerPosition);
    }

    // 自定义排序逻辑
    let comparison = 0;
    switch (sortState.field) {
      case "name": {
        comparison = a.name.localeCompare(b.name);
        break;
      }
      case "os": {
        comparison = a.os.localeCompare(b.os);
        break;
      }
      case "status": {
        comparison = Number(bOnline) - Number(aOnline); // 在线状态：true > false
        break;
      }
      case "cpu": {
        comparison = aData.cpu.usage - bData.cpu.usage;
        break;
      }
      case "ram": {
        const aRamPercent = a.mem_total
          ? (aData.ram.used / a.mem_total) * 100
          : 0;
        const bRamPercent = b.mem_total
          ? (bData.ram.used / b.mem_total) * 100
          : 0;
        comparison = aRamPercent - bRamPercent;
        break;
      }
      case "disk": {
        const aDiskPercent = a.disk_total
          ? (aData.disk.used / a.disk_total) * 100
          : 0;
        const bDiskPercent = b.disk_total
          ? (bData.disk.used / b.disk_total) * 100
          : 0;
        comparison = aDiskPercent - bDiskPercent;
        break;
      }
      case "price": {
        comparison = a.price - b.price;
        break;
      }
      case "networkUp": {
        comparison = aData.network.up - bData.network.up;
        break;
      }
      case "networkDown": {
        comparison = aData.network.down - bData.network.down;
        break;
      }
      case "totalUp": {
        comparison = aData.network.totalUp - bData.network.totalUp;
        break;
      }
      case "totalDown": {
        comparison = aData.network.totalDown - bData.network.totalDown;
        break;
      }
      default:
        comparison = 0;
    }

    return sortState.order === "desc" ? -comparison : comparison;
  }), [nodes, onlineSet, getNodeData, offlineServerPosition, sortState]);

  return (
    <div className="km-node-table overflow-x-auto rounded-xl node-table-container">
      <Table>
        <TableHeader className="km-node-table-header">
          <TableRow>
            <TableHead className="w-[24px]"></TableHead>
            <TableHead
              className="w-[200px] min-w-[150px] cursor-pointer hover:bg-accent-2 select-none"
              onClick={handleSort("name")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.name")}
                {getSortIcon("name")}
              </Flex>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent-2 select-none"
              onClick={handleSort("os")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.os")}
                {getSortIcon("os")}
              </Flex>
            </TableHead>
            <TableHead
              className="max-w-[128px] cursor-pointer hover:bg-accent-2 select-none"
              onClick={handleSort("status")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("common.status")}
                {getSortIcon("status")}
              </Flex>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent-2 select-none"
              onClick={handleSort("cpu")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("admin.nodeDetail.cpu")}
                {getSortIcon("cpu")}
              </Flex>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent-2 select-none"
              onClick={handleSort("ram")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.ram")}
                {getSortIcon("ram")}
              </Flex>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent-2 select-none"
              onClick={handleSort("disk")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.disk")}
                {getSortIcon("disk")}
              </Flex>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent-2 select-none"
              onClick={handleSort("price")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("admin.nodeTable.price")}
                {getSortIcon("price")}
              </Flex>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent-2 select-none text-center min-w-[80px]"
              onClick={handleSort("networkUp")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1" justify="center">
                {t("nodeCard.networkUploadSpeed")}
                {getSortIcon("networkUp")}
              </Flex>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent-2 select-none text-center min-w-[80px]"
              onClick={handleSort("networkDown")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1" justify="center">
                {t("nodeCard.networkDownloadSpeed")}
                {getSortIcon("networkDown")}
              </Flex>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent-2 select-none text-center min-w-[80px]"
              onClick={handleSort("totalUp")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1" justify="center">
                {t("nodeCard.totalUpload")}
                {getSortIcon("totalUp")}
              </Flex>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent-2 select-none text-center min-w-[80px]"
              onClick={handleSort("totalDown")}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1" justify="center">
                {t("nodeCard.totalDownload")}
                {getSortIcon("totalDown")}
              </Flex>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/*
            首次渲染的行由外层视图负责入场（initial={false}）；之后筛选/新节点出现的行淡入，
            被筛掉的行先淡出，其余行再用 layout="position" 补位。
          */}
          <AnimatePresence initial={false}>
          {sortedNodes.map((node) => {
            const isOnline = onlineSet.has(node.uuid);
            const nodeData = getNodeData(node.uuid);
            const isExpanded = expandedRows.has(node.uuid);

            const memoryUsagePercent = node.mem_total
              ? (nodeData.ram.used / node.mem_total) * 100
              : 0;
            const diskUsagePercent = node.disk_total
              ? (nodeData.disk.used / node.disk_total) * 100
              : 0;

            return (
              <React.Fragment key={node.uuid}>
                {/*
                  content 层：排序/筛选导致的行重排用 layout="position" 补位，
                  看得出「这一行挪到了那里」；只补位置不补尺寸，文字不会被拉伸。
                  className 与 ui/table 的 TableRow 完全一致（保留主题选择器）。
                */}
                <motion.tr
                  data-slot="table-row"
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: MOTION_TRANSITION.fadeOut }}
                  transition={{
                    layout: settledLayoutTransition(orderSettled),
                    opacity: MOTION_TRANSITION.fadeIn,
                  }}
                  className="km-ui-table-row border-b border-[var(--accent-2)] hover:bg-[var(--accent-2)] data-[state=selected]:bg-[var(--accent-3)] km-node-table-row hover:bg-accent-2 transition-colors duration-200 table-row-hover"
                  onClick={() => toggleRowExpansion(node.uuid)}
                  aria-expanded={isExpanded}
                >
                  <TableCell>
                    <div className="flex justify-center items-center">
                      <IconButton
                        variant="ghost"
                        size="1"
                        className="expand-button"
                        aria-label="Expand row"
                      >
                        {/* control 层：箭头用弹簧转向，连点展开/收起会顺势反转 */}
                        <motion.span
                          className="inline-flex"
                          initial={false}
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={CONTROL_MOTION.transition}
                        >
                          <ChevronRight size={16} />
                        </motion.span>
                      </IconButton>
                    </div>
                  </TableCell>
                  <TableCell className="node-name-cell">
                    <Flex align="center" gap="1">
                      <Flag flag={node.region} />
                      <Link
                        to={`/instance/${node.uuid}`}
                        className="hover:underline"
                        onPointerEnter={preloadInstancePage}
                        onFocus={preloadInstancePage}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            e.metaKey ||
                            e.ctrlKey ||
                            e.shiftKey ||
                            e.altKey ||
                            e.button !== 0
                          ) {
                            return;
                          }
                          e.preventDefault();
                          // 共享元素：表格里的节点名同样「飞」到详情页标题
                          navigateWithTransition(`/instance/${node.uuid}`, {
                            sharedHero: node.uuid,
                          });
                        }}
                      >
                        <Flex direction="column" gap="0">
                          <TableNodeName uuid={node.uuid} name={node.name} />
                          {liveLoading ? (
                            <label className="-mt-1 text-muted-foreground text-xs">
                              {sk(null, 10)}
                            </label>
                          ) : isOnline ? (
                            <label className="-mt-1 text-muted-foreground text-xs">
                              {formatUptime(nodeData.uptime, t)}
                            </label>
                          ) : (
                            <label className="-mt-1 text-muted-foreground">
                              -
                            </label>
                          )}
                        </Flex>
                      </Link>
                    </Flex>
                  </TableCell>

                  <TableCell className="w-4">
                    <img
                      src={getOSImage(node.os)}
                      alt={node.os}
                      className="w-5 h-5 mr-2"
                    />
                  </TableCell>

                  <TableCell>
                    <Flex
                      direction="row"
                      justify="start"
                      align="center"
                      gap="1"
                    >
                      {/* feedback 层：只在在线状态真的翻转时弹一下（与卡片视图一致） */}
                      {/* live 未到：灰色徽标 + 骨架文字，不先显示「离线」 */}
                      <StatusFeedback state={liveLoading ? "loading" : isOnline}>
                        <Badge
                          color={liveLoading ? "gray" : isOnline ? "green" : "red"}
                          variant="soft"
                          size="1"
                        >
                          {liveLoading ? (
                            <Skeletonize as="span" loading>
                              {t("nodeCard.online")}
                            </Skeletonize>
                          ) : isOnline ? (
                            t("nodeCard.online")
                          ) : (
                            t("nodeCard.offline")
                          )}
                        </Badge>
                      </StatusFeedback>
                      <AnimatePresence initial={false}>
                        {nodeData.message && (
                          <motion.span
                            key="message"
                            className="inline-flex"
                            initial={{ opacity: 0, scale: 0.86 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.86, transition: MOTION_TRANSITION.fadeOut }}
                            transition={MOTION_SPRING.pop}
                          >
                            <Tips color="#CE282E">{nodeData.message}</Tips>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Flex>
                  </TableCell>

                  <TableCell>
                    <div className="w-[100px]">
                      <UsageBar label="" value={nodeData.cpu.usage} compact loading={liveLoading} />
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="w-[100px]">
                      <UsageBar label="" value={memoryUsagePercent} compact loading={liveLoading} />
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="w-[100px]">
                      <UsageBar label="" value={diskUsagePercent} compact loading={liveLoading} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <PriceTags
                      price={node.price}
                      billing_cycle={node.billing_cycle}
                      expired_at={node.expired_at}
                      currency={node.currency}
                      gap="1"
                      tags={node.tags || ""}
                    />
                  </TableCell>
                  <TableCell className="text-center min-w-[80px]">
                    <label>{sk(<>↑{formatBytes(nodeData.network.up)}/s</>)}</label>
                  </TableCell>
                  <TableCell className="text-center min-w-[80px]">
                    <label>{sk(<>↓{formatBytes(nodeData.network.down)}/s</>)}</label>
                  </TableCell>
                  <TableCell className="text-center min-w-[80px]">
                    <label>{sk(<>↑{formatBytes(nodeData.network.totalUp)}</>)}</label>
                  </TableCell>
                  <TableCell className="text-center min-w-[80px]">
                    <label>{sk(<>↓{formatBytes(nodeData.network.totalDown)}</>)}</label>
                  </TableCell>
                </motion.tr>

                {/* 展开的详细信息行：同一个元素在展开/收起间弹簧切换，中途反向会保留速度 */}
                <ExpandedRow
                  open={isExpanded}
                  node={node}
                  nodeData={nodeData}
                />
              </React.Fragment>
            );
          })}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
};

/** 表格里的节点名：被点击的那一行会拿到共享元素名，与详情页标题配对 */
const TableNodeName = ({ uuid, name }: { uuid: string; name: string }) => {
  const isSharedHero = useSharedHero(uuid);
  return (
    <label
      className="max-w-[150px] font-bold text-lg truncate"
      style={sharedHeroStyle(isSharedHero)}
    >
      {name}
    </label>
  );
};

/**
 * 排序箭头（control 层）：出现/消失用淡入缩放；升序 <-> 降序是同一个箭头弹簧翻转 180°，
 * 连续点击时从当前角度顺势转向。
 */
const SortIcon = ({ order }: { order: SortOrder | null }) => (
  <AnimatePresence initial={false}>
    {order && order !== "default" && (
      <motion.span
        key="sort"
        className="inline-flex"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1, rotate: order === "desc" ? 180 : 0 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={CONTROL_MOTION.transition}
      >
        <ChevronUp size={14} />
      </motion.span>
    )}
  </AnimatePresence>
);

/**
 * 可展开的详情行。
 * 不用 AnimatePresence 来回挂载：展开/收起驱动的是同一个 motion 元素的 animate，
 * 收起到一半再点展开，高度弹簧会带着当前速度掉头（可中断）。
 * 收起动画真正播完后才卸载内容，下次展开再重新加载（与原先一致，图表不会常驻后台请求）。
 */
const EXPAND_VARIANTS = {
  open: { height: "auto", opacity: 1 },
  closed: { height: 0, opacity: 0 },
};

const ExpandedRow = ({
  open,
  node,
  nodeData,
}: {
  open: boolean;
  node: NodeBasicInfo;
  nodeData: Record;
}) => {
  const [mounted, setMounted] = useState(open);
  const openRef = useRef(open);
  openRef.current = open;
  if (open && !mounted) setMounted(true);
  if (!mounted) return null;
  return (
    <motion.tr
      layout="position"
      transition={{ layout: MOTION_SPRING.layout }}
      className="expanded-row"
      aria-hidden={!open}
    >
      <TableCell colSpan={12} className="bg-accent-1 p-0">
        <motion.div
          initial="closed"
          animate={open ? "open" : "closed"}
          variants={EXPAND_VARIANTS}
          transition={{
            height: MOTION_SPRING.soft,
            opacity: open ? MOTION_TRANSITION.fadeIn : MOTION_TRANSITION.fadeOut,
          }}
          // 被打断的动画也会回调 onAnimationComplete：只有「收起」这个目标真正播完、
          // 且期间没有再次展开时才卸载
          onAnimationComplete={(definition) => {
            if (definition === "closed" && !openRef.current) setMounted(false);
          }}
          className="km-node-table-expand overflow-hidden"
        >
          <ExpandedNodeDetails node={node} nodeData={nodeData} />
        </motion.div>
      </TableCell>
    </motion.tr>
  );
};

// 展开的节点详细信息组件
interface ExpandedNodeDetailsProps {
  node: NodeBasicInfo;
  nodeData: Record;
}

const ExpandedNodeDetails: React.FC<ExpandedNodeDetailsProps> = ({
  node,
  nodeData,
}) => {
  return (
    // 展开详情：内边距 block（原来 p-2 套 p-4 叠成 24），详情网格与延迟图之间 block
    <div className="p-km-block space-y-km-block">
      <DetailsGrid
        gap="0"
        uuid={node.uuid}
        node={node}
        liveRecord={nodeData}
      />
      <div>
        <MiniPingChart hours={24} uuid={node.uuid} />
      </div>
    </div>
  );
};

export default NodeTable;