import type { PingTask } from "@/contexts/PingTaskContext";

/** 任务视图里的一行：clients 已去掉被删除的节点 */
export type ProcessedPingTask = PingTask & {
  __allClientsDeleted?: boolean;
  __originalCount?: number;
};

export const getTaskSortableId = (task: { id?: number; name?: string; target?: string }) =>
  task.id !== undefined
    ? `id-${task.id}`
    : `tmp-${task.name ?? ""}-${task.target ?? ""}`;
