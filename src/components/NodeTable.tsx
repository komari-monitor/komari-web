import React, { useState } from "react";
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
import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData, Record } from "../types/LiveData";
import { formatBytes, formatUptime } from "./Node";
import UsageBar from "./UsageBar";
import Flag from "./Flag";
import PriceTags from "./PriceTags";
import Tips from "./ui/tips";
import { DetailsGrid } from "./DetailsGrid";
import MiniPingChart from "./MiniPingChart";
import { getOSImage } from "@/utils";

interface NodeTableProps {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
}

type SortField = 'name' | 'os' | 'status' | 'cpu' | 'ram' | 'disk' | 'price' | 'networkUp' | 'networkDown' | 'totalUp' | 'totalDown';
type SortOrder = 'asc' | 'desc' | 'default';

interface SortState {
  field: SortField | null;
  order: SortOrder;
}

const NodeTable: React.FC<NodeTableProps> = ({ nodes, liveData }) => {
  const [t] = useTranslation();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<SortState>({ field: null, order: 'default' });

  const toggleRowExpansion = (uuid: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(uuid)) {
        newSet.delete(uuid);
      } else {
        newSet.add(uuid);
      }
      return newSet;
    });
  };

  const handleSort = (field: SortField) => {
    return (event: React.MouseEvent) => {
      event.preventDefault();
      
      setSortState((prev) => {
        if (prev.field === field) {
          // 循环切换：default -> asc -> desc -> default
          const nextOrder: SortOrder = 
            prev.order === 'default' ? 'asc' : 
            prev.order === 'asc' ? 'desc' : 'default';
          return { field: nextOrder === 'default' ? null : field, order: nextOrder };
        } else {
          // 新字段，从正序开始
          return { field, order: 'asc' };
        }
      });
    };
  };

  const getSortIcon = (field: SortField) => {
    if (sortState.field !== field) return null;
    return sortState.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  // 确保liveData是有效的
  const onlineNodes = liveData && liveData.online ? liveData.online : [];

  const getNodeData = (uuid: string): Record => {
    const defaultLive = {
      cpu: { usage: 0 },
      ram: { used: 0 },
      disk: { used: 0 },
      network: { up: 0, down: 0, totalUp: 0, totalDown: 0 },
      uptime: 0,
    } as Record;

    return liveData && liveData.data
      ? liveData.data[uuid] || defaultLive
      : defaultLive;
  };

  // 排序节点函数
  const sortedNodes = [...nodes].sort((a, b) => {
    const aOnline = onlineNodes.includes(a.uuid);
    const bOnline = onlineNodes.includes(b.uuid);
    const aData = getNodeData(a.uuid);
    const bData = getNodeData(b.uuid);

    // 如果没有排序字段或为默认排序，使用原来的排序逻辑
    if (!sortState.field || sortState.order === 'default') {
      // 先按在线/离线状态排序，再按权重排序（权重大的靠前）
      if (aOnline !== bOnline) {
        return aOnline ? -1 : 1;
      }
      return a.weight - b.weight;
    }

    // 自定义排序逻辑
    let comparison = 0;
    switch (sortState.field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'os':
        comparison = a.os.localeCompare(b.os);
        break;
      case 'status':
        comparison = Number(bOnline) - Number(aOnline); // 在线状态：true > false
        break;
      case 'cpu':
        comparison = aData.cpu.usage - bData.cpu.usage;
        break;
      case 'ram': {
        const aRamPercent = a.mem_total ? (aData.ram.used / a.mem_total) * 100 : 0;
        const bRamPercent = b.mem_total ? (bData.ram.used / b.mem_total) * 100 : 0;
        comparison = aRamPercent - bRamPercent;
        break;
      }
      case 'disk': {
        const aDiskPercent = a.disk_total ? (aData.disk.used / a.disk_total) * 100 : 0;
        const bDiskPercent = b.disk_total ? (bData.disk.used / b.disk_total) * 100 : 0;
        comparison = aDiskPercent - bDiskPercent;
        break;
      }
      case 'price':
        comparison = a.price - b.price;
        break;
      case 'networkUp':
        comparison = aData.network.up - bData.network.up;
        break;
      case 'networkDown':
        comparison = aData.network.down - bData.network.down;
        break;
      case 'totalUp':
        comparison = aData.network.totalUp - bData.network.totalUp;
        break;
      case 'totalDown':
        comparison = aData.network.totalDown - bData.network.totalDown;
        break;
      default:
        comparison = 0;
    }

    return sortState.order === 'desc' ? -comparison : comparison;
  });

  return (
    <div className="mx-4 overflow-x-auto rounded-xl node-table-container shadow-md animate-fadeIn">
      <Table>
        <TableHeader className="bg-accent-2/50 backdrop-blur-sm sticky top-0">
          <TableRow>
            <TableHead className="w-[24px]"></TableHead>
            <TableHead 
              className="w-[200px] min-w-[150px] cursor-pointer hover:bg-accent-3 select-none transition-colors"
              onClick={handleSort('name')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.name")}
                {getSortIcon('name')}
              </Flex>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-accent-3 select-none transition-colors"
              onClick={handleSort('os')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.os")}
                {getSortIcon('os')}
              </Flex>
            </TableHead>
            <TableHead 
              className="max-w-[128px] cursor-pointer hover:bg-accent-3 select-none transition-colors"
              onClick={handleSort('status')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.status")}
                {getSortIcon('status')}
              </Flex>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-accent-3 select-none transition-colors"
              onClick={handleSort('cpu')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.cpu")}
                {getSortIcon('cpu')}
              </Flex>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-accent-3 select-none transition-colors"
              onClick={handleSort('ram')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.ram")}
                {getSortIcon('ram')}
              </Flex>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-accent-3 select-none transition-colors"
              onClick={handleSort('disk')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.disk")}
                {getSortIcon('disk')}
              </Flex>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-accent-3 select-none transition-colors"
              onClick={handleSort('price')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1">
                {t("nodeCard.price")}
                {getSortIcon('price')}
              </Flex>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-accent-3 select-none text-center min-w-[80px] transition-colors"
              onClick={handleSort('networkUp')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1" justify="center">
                {t("nodeCard.networkUploadSpeed")}
                {getSortIcon('networkUp')}
              </Flex>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-accent-3 select-none text-center min-w-[80px] transition-colors"
              onClick={handleSort('networkDown')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1" justify="center">
                {t("nodeCard.networkDownloadSpeed")}
                {getSortIcon('networkDown')}
              </Flex>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-accent-3 select-none text-center min-w-[80px] transition-colors"
              onClick={handleSort('totalUp')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1" justify="center">
                {t("nodeCard.totalUpload")}
                {getSortIcon('totalUp')}
              </Flex>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-accent-3 select-none text-center min-w-[80px] transition-colors"
              onClick={handleSort('totalDown')}
              title={t("nodeCard.sortTooltip")}
            >
              <Flex align="center" gap="1" justify="center">
                {t("nodeCard.totalDownload")}
                {getSortIcon('totalDown')}
              </Flex>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedNodes.map((node) => {
            const isOnline = onlineNodes.includes(node.uuid);
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
                <TableRow
                  className={`hover:bg-accent-2 transition-all duration-200 table-row-hover animate-fadeIn ${isExpanded ? 'bg-accent-1/50' : ''} ${index % 2 === 0 ? 'bg-background' : 'bg-accent-1/20'}`}
                  onClick={() => toggleRowExpansion(node.uuid)}
                  style={{ 
                    animationDelay: `${index * 0.03}s`,
                    opacity: 0,
                    animationFillMode: 'forwards'
                  }}
                >
                  <TableCell className="p-2">
                    <div className="flex justify-center items-center">
                      <IconButton
                        variant="ghost"
                        size="1"
                        className={`expand-button rounded-full ${
                          isExpanded ? "expanded text-primary" : ""
                        } transition-all`}
                        aria-label="Expand row"
                      >
                        <ChevronRight size={16} />
                      </IconButton>
                    </div>
                  </TableCell>
                  <TableCell className="node-name-cell p-2">
                    <Flex align="center" gap="2">
                      <div className="relative">
                        <Flag flag={node.region} className="rounded-full" />
                        <div 
                          className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-card ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
                        />
                      </div>
                      <Link
                        to={`/instance/${node.uuid}`}
                        className="hover:underline group"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Flex direction="column" gap="0">
                          <span className="max-w-[150px] font-bold text-lg truncate group-hover:text-primary transition-colors">
                            {node.name}
                          </span>
                          {isOnline ? (
                            <span className="-mt-1 text-muted-foreground text-xs">
                              {formatUptime(nodeData.uptime, t)}
                            </span>
                          ) : (
                            <span className="-mt-1 text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </Flex>
                      </Link>
                    </Flex>
                  </TableCell>

                  <TableCell className="w-4 p-2">
                    <img src={getOSImage(node.os)} alt={node.os} className="w-5 h-5 mr-2" />
                  </TableCell>

                  <TableCell className="p-2">
                    <Flex
                      direction="row"
                      justify="start"
                      align="center"
                      gap="1"
                    >
                      <div>
                        <Badge
                          color={isOnline ? "green" : "red"}
                          variant="soft"
                          size="1"
                          radius="full"
                          className="px-2"
                        >
                          {isOnline
                            ? t("nodeCard.online")
                            : t("nodeCard.offline")}
                        </Badge>
                      </div>
                      {nodeData.message && (
                        <Tips color="#CE282E">{nodeData.message}</Tips>
                      )}
                    </Flex>
                  </TableCell>

                  <TableCell className="p-2">
                    <div className="w-[100px]">
                      <UsageBar label="" value={nodeData.cpu.usage} compact />
                    </div>
                  </TableCell>

                  <TableCell className="p-2">
                    <div className="w-[100px]">
                      <UsageBar label="" value={memoryUsagePercent} compact />
                    </div>
                  </TableCell>

                  <TableCell className="p-2">
                    <div className="w-[100px]">
                      <UsageBar label="" value={diskUsagePercent} compact />
                    </div>
                  </TableCell>
                  <TableCell className="p-2">
                    <PriceTags
                      price={node.price}
                      billing_cycle={node.billing_cycle}
                      expired_at={node.expired_at}
                      currency={node.currency}
                      gap="1"
                      tags={node.tags || ""}
                    />
                  </TableCell>
                  <TableCell className="text-center min-w-[80px] p-2">
                    <span className="text-sm">↑{formatBytes(nodeData.network.up)}/s</span>
                  </TableCell>
                  <TableCell className="text-center min-w-[80px] p-2">
                    <span className="text-sm">↓{formatBytes(nodeData.network.down)}/s</span>
                  </TableCell>
                  <TableCell className="text-center min-w-[80px] p-2">
                    <span className="text-sm">↑{formatBytes(nodeData.network.totalUp)}</span>
                  </TableCell>
                  <TableCell className="text-center min-w-[80px] p-2">
                    <span className="text-sm">↓{formatBytes(nodeData.network.totalDown)}</span>
                  </TableCell>
                </TableRow>

                {/* Expanded details row */}
                {isExpanded && (
                  <TableRow className="expanded-row">
                    <TableCell colSpan={12} className="bg-accent-1 p-4 border-t border-b border-accent-3/30">
                      <div className="expand-content animate-slideUp">
                        <ExpandedNodeDetails node={node} nodeData={nodeData} />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

// 展开的节点详细信息组件
interface ExpandedNodeDetailsProps {
  node: NodeBasicInfo;
  nodeData: Record;
}

const ExpandedNodeDetails: React.FC<ExpandedNodeDetailsProps> = ({ node }) => {
  return (
    <div className="p-4 space-y-4">
      <DetailsGrid gap="0" uuid={node.uuid} />
      <div>
        <MiniPingChart hours={24} uuid={node.uuid} />
      </div>
    </div>
  );
};

export default NodeTable;
