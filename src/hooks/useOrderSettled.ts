import { useEffect, useState } from "react";
import { MOTION_SPRING } from "@/lib/motion";

/**
 * 列表的「首次定序」是否已经完成。
 *
 * 首页卡片、首页表格、详情页侧栏的节点顺序要等实时状态（在线/离线）和公开设置
 * （离线节点位置）都到了才是最终顺序。节点列表通常先到：先按权重画出来，状态到达后
 * 离线节点被挪到末尾，layout 补间会让卡片横跨整个网格飞过去，看起来像闪了一下。
 *
 * ready 第一次为 true 之后再过 SETTLE_DELAY_MS 才返回 true：这期间的重排瞬时完成，
 * 之后节点上下线、筛选、排序带来的重排照常有补位动画。
 */
/** 首次定序完成到打开补位动画之间的间隔（毫秒） */
const SETTLE_DELAY_MS = 200;

export function useOrderSettled(ready: boolean): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!ready || settled) return;
    // 不能在同一个 effect 里立即打开：motion 在提交之后的下一帧才启动布局补间，
    // 那时读到的已经是新的 transition，首次重排仍会被弹簧补间。留出 SETTLE_DELAY_MS 再打开。
    const id = window.setTimeout(() => setSettled(true), SETTLE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [ready, settled]);
  return settled;
}

/** 定序完成前的 layout 补间：瞬时完成；完成后用统一的布局弹簧 */
export const INSTANT_LAYOUT = { duration: 0 } as const;
export const settledLayoutTransition = (settled: boolean) =>
  settled ? MOTION_SPRING.layout : INSTANT_LAYOUT;
