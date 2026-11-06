import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNodeDetails } from "@/contexts/NodeDetailsContext";
import { usePingTask, type PingTask } from "@/contexts/PingTaskContext";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnimatePresence } from "motion/react";
import TaskRow from "./pingTask/TaskRow";
import { postPingTask } from "./pingTask/api";
import { getTaskSortableId, type ProcessedPingTask } from "./pingTask/types";

export const TaskView = ({ pingTasks }: { pingTasks: PingTask[] }) => {
  const { t } = useTranslation();
  const { refresh } = usePingTask();
  const { nodeDetail } = useNodeDetails();
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {})
  );

  // 过滤已删除的节点
  const processedTasks = React.useMemo(() => {
    if (!pingTasks)
      return [] as ProcessedPingTask[];
    const nodeUuidSet = new Set(nodeDetail.map((n) => n.uuid));
    return pingTasks.map((task) => {
      const original = task.clients || [];
      const existing = original.filter((uuid) => nodeUuidSet.has(uuid));
      const allDeleted = original.length > 0 && existing.length === 0;
      return {
        ...task,
        clients: existing,
        __allClientsDeleted: allDeleted,
        __originalCount: original.length,
      };
    });
  }, [pingTasks, nodeDetail]);

  const [localTasks, setLocalTasks] = React.useState(processedTasks);

  React.useEffect(() => {
    setLocalTasks(processedTasks);
  }, [processedTasks]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localTasks.findIndex(
      (task) => getTaskSortableId(task) === String(active.id)
    );
    const newIndex = localTasks.findIndex(
      (task) => getTaskSortableId(task) === String(over.id)
    );
    if (oldIndex < 0 || newIndex < 0) return;

    const previousTasks = Array.from(localTasks);
    const reorderedTasks = Array.from(localTasks);
    const [reorderedItem] = reorderedTasks.splice(oldIndex, 1);
    reorderedTasks.splice(newIndex, 0, reorderedItem);

    setLocalTasks(reorderedTasks);

    const orderData = reorderedTasks.reduce((acc, task, index) => {
      if (task.id !== undefined) {
        acc[String(task.id)] = index;
      }
      return acc;
    }, {} as Record<string, number>);

    try {
      await postPingTask("/api/admin/ping/order", orderData, t);
    } catch (error: any) {
      setLocalTasks(previousTasks);
      toast.error(error?.message || t("common.error"));
      refresh();
    }
  };

  return (
    <div className="km-page-admin-pingtask-task km-pingtask-task-table rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" aria-label={t("common.sort")}></TableHead>
            <TableHead>{t("common.name")}</TableHead>
            <TableHead>{t("common.server")}</TableHead>
            <TableHead>{t("ping.target")}</TableHead>
            <TableHead>{t("common.type")}</TableHead>
            <TableHead>{t("ping.interval")}</TableHead>
            <TableHead>{t("common.action")}</TableHead>
          </TableRow>
        </TableHeader>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localTasks.map((task) => getTaskSortableId(task))}
            strategy={verticalListSortingStrategy}
          >
            <TableBody>
              {/* content 层：任务行增删/重排都用 layout 弹簧 */}
              <AnimatePresence initial={false}>
              {localTasks.map((task, index) => (
                <TaskRow key={getTaskSortableId(task)} task={task} index={index} />
              ))}
              </AnimatePresence>
            </TableBody>
          </SortableContext>
        </DndContext>
      </Table>
    </div>
  );
};
