import type { Record } from "@/types/LiveData";

/** 后台「离线节点位置」设置：First 离线在前，Keep 不调整，其它（Last/未设置）离线在后 */
export type OfflineServerPosition = "First" | "Keep" | "Last" | string | undefined;

/**
 * 首页卡片、首页表格默认排序、详情页侧栏共用的节点顺序：
 * 先按离线节点位置设置分出在线/离线，再按权重升序。
 */
export function compareNodesByStatus(
  a: { uuid: string; weight: number },
  b: { uuid: string; weight: number },
  onlineSet: ReadonlySet<string>,
  offlineServerPosition: OfflineServerPosition,
): number {
  const aIsOnline = onlineSet.has(a.uuid);
  const bIsOnline = onlineSet.has(b.uuid);
  if (offlineServerPosition === "First") {
    if (!aIsOnline && bIsOnline) return -1;
    if (aIsOnline && !bIsOnline) return 1;
  } else if (offlineServerPosition !== "Keep") {
    if (aIsOnline && !bIsOnline) return -1;
    if (!aIsOnline && bIsOnline) return 1;
  }
  return a.weight - b.weight;
}

/** 还没有实时数据时的空记录（全部为 0），卡片与表格共用 */
export const EMPTY_LIVE_RECORD = {
  cpu: { usage: 0 },
  ram: { used: 0 },
  swap: { used: 0 },
  load: { load1: 0, load5: 0, load15: 0 },
  disk: { used: 0 },
  network: { up: 0, down: 0, totalUp: 0, totalDown: 0 },
  connections: { tcp: 0, udp: 0 },
  uptime: 0,
  process: 0,
  message: "",
  updated_at: "",
} as Record;
