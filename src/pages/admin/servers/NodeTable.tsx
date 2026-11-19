import React, { useCallback, useMemo, useState } from "react";
import type { NodeDetail } from "@/contexts/NodeDetailsContext";
import { Checkbox } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { DndContext, closestCenter, useSensor, useSensors, TouchSensor, MouseSensor, KeyboardSensor } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnimatePresence } from "motion/react";
import { reorderClients } from "./api";
import useIsSnapshotBackend from "./useIsSnapshotBackend";
import SortableRow from "./SortableRow";

const NodeTable = ({
  nodes,
  selectedNodes,
  setSelectedNodes,
  settings,
}: {
  nodes: NodeDetail[];
  selectedNodes: string[];
  setSelectedNodes: React.Dispatch<React.SetStateAction<string[]>>;
  settings: any;
}) => {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(MouseSensor, {
      // 需要按住 10px 距离才开始拖拽，避免与点击冲突
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      // 移动端需要按住 5px 距离才开始拖拽，并且延迟 200ms，避免与滚动冲突
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {})
  );
  // 添加 localNodes 状态，实现即时 UI 更新
  const [localNodes, setLocalNodes] = useState<NodeDetail[]>(nodes);
  const [isDragging, setIsDragging] = useState(false);
  const isSnapshotBackend = useIsSnapshotBackend();
  // 拖拽过程中忽略后台 5 秒轮询写回，避免排序顺序被半途覆盖
  React.useEffect(() => {
    if (!isDragging) {
      setLocalNodes(nodes);
    }
  }, [nodes, isDragging]);
  const handleDragStart = () => {
    setIsDragging(true);
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleDragEnd = async (event: any) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localNodes.findIndex((node) => node.uuid === active.id);
    const newIndex = localNodes.findIndex((node) => node.uuid === over.id);
    const reorderedNodes = Array.from(localNodes);
    const [reorderedItem] = reorderedNodes.splice(oldIndex, 1);
    reorderedNodes.splice(newIndex, 0, reorderedItem);

    // 立即更新 UI
    setLocalNodes(reorderedNodes);

    if ("vibrate" in navigator) {
      navigator.vibrate([30, 10, 30]);
    }

    try {
      const orderData = reorderedNodes.reduce((acc, node, index) => {
        acc[node.uuid] = index;
        return acc;
      }, {} as Record<string, number>);

      await reorderClients(orderData);
      // 不再调用 refresh，以免覆盖本地排序
    } catch {
      toast.error(t("admin.nodeTable.errorRefreshNodeList"));
    }
  };

  const selectedSet = useMemo(() => new Set(selectedNodes), [selectedNodes]);
  const sortableItems = useMemo(
    () => localNodes.map((node) => node.uuid),
    [localNodes],
  );

  // 更新全选逻辑，使用 localNodes
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedNodes(checked ? localNodes.map((node) => node.uuid) : []);
    },
    [localNodes, setSelectedNodes],
  );

  const handleSelectNode = useCallback(
    (uuid: string, checked: boolean) => {
      setSelectedNodes((prev) =>
        checked
          ? prev.includes(uuid)
            ? prev
            : [...prev, uuid]
          : prev.filter((id) => id !== uuid),
      );
    },
    [setSelectedNodes],
  );
  return (
    <div
      className={`rounded-md overflow-hidden ${
        isDragging ? "select-none" : ""
      }`}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Table>
          <TableHeader style={{ backgroundColor: "var(--accent-4)" }}>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>
                <Checkbox
                  checked={
                    selectedNodes.length === localNodes.length &&
                    localNodes.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>{t("admin.nodeTable.name")}</TableHead>
              <TableHead>{t("admin.nodeDetail.ipAddress")}</TableHead>
              <TableHead>{t("admin.nodeDetail.clientVersion")}</TableHead>
              <TableHead>{t("common.group")}</TableHead>
              <TableHead>{t("admin.nodeEdit.remark")}</TableHead>
              <TableHead>{t("admin.nodeTable.billing")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext
              items={sortableItems}
              strategy={verticalListSortingStrategy}
            >
              {/* content 层：增删行用 AnimatePresence，选中/拖拽重排由 dnd-kit 与 motion 同步 */}
              <AnimatePresence initial={false}>
              {localNodes.map((node) => (
                <SortableRow
                  key={node.uuid}
                  node={node}
                  isSelected={selectedSet.has(node.uuid)}
                  handleSelectNode={handleSelectNode}
                  settings={settings}
                  isSnapshotBackend={isSnapshotBackend}
                />
              ))}
              </AnimatePresence>
            </SortableContext>
          </TableBody>
        </Table>
      </DndContext>
    </div>
  );
};

export default NodeTable;
