export type TrafficLimitType = "sum" | "max" | "min" | "up" | "down";

/** 按节点计费方式计算当前已计入配额的字节数（与后端 notifier 及前端卡片口径一致） */
export function computeTrafficQuotaUsed(
  totalUp: number,
  totalDown: number,
  type?: TrafficLimitType | string,
): number {
  const up = Math.max(0, Number.isFinite(totalUp) ? totalUp : 0);
  const down = Math.max(0, Number.isFinite(totalDown) ? totalDown : 0);
  switch ((type || "sum").toLowerCase()) {
    case "max":
      return Math.max(up, down);
    case "min":
      return Math.min(up, down);
    case "up":
      return up;
    case "down":
      return down;
    case "sum":
    default:
      return up + down;
  }
}

/** 计算流量配额占用百分比（允许超过 100%，便于预警超额） */
export function computeTrafficQuotaPercent(
  totalUp: number,
  totalDown: number,
  limit: number,
  type?: TrafficLimitType | string,
): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return (computeTrafficQuotaUsed(totalUp, totalDown, type) / limit) * 100;
}
