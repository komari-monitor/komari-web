import NodeSelectorDialog from "@/components/NodeSelectorDialog";
import { TableCell } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNodeDetails } from "@/contexts/NodeDetailsContext";
import { usePingTask } from "@/contexts/PingTaskContext";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  Checkbox,
  Dialog,
  Flex,
  IconButton,
  Select,
  TextField,
} from "@radix-ui/themes";
import { MenuIcon, MoreHorizontal, Pencil, Trash } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion } from "motion/react";
import { MOTION_TRANSITION } from "@/lib/motion";
import { postPingTask } from "./api";
import { getTaskSortableId, type ProcessedPingTask } from "./types";

const TaskRow = ({
  task,
  index,
}: {
  task: ProcessedPingTask;
  index: number;
}) => {
  const { t } = useTranslation();
  const { refresh } = usePingTask();
  const { nodeDetail } = useNodeDetails();
  const isMobile = useIsMobile();
  const sortableId = getTaskSortableId(task);
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sortableId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [editOpen, setEditOpen] = React.useState(false);
  const [editSaving, setEditSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [form, setForm] = React.useState({
    name: task.name || "",
    type: task.type || "icmp",
    target: task.target || "",
    clients: task.clients || [],
    default_on: task.default_on || false,
    interval: task.interval || 60,
  });

  const submitEdit = (newForm: typeof form) => {
    setEditSaving(true);
    postPingTask(
      "/api/admin/ping/edit",
      {
        tasks: [
          {
            id: task.id,
            name: newForm.name,
            type: newForm.type,
            target: newForm.target,
            default_on: newForm.default_on,
            clients: newForm.clients,
            interval: newForm.interval,
          },
        ],
      },
      t
    )
      .then(() => {
        setEditOpen(false);
        toast.success(t("common.updated_successfully"));
        refresh();
      })
      .catch((error) => {
        toast.error(error.message);
      })
      .finally(() => setEditSaving(false));
  };

  // 编辑提交
  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitEdit(form);
  };

  // 删除
  const handleDelete = () => {
    setDeleteLoading(true);
    postPingTask("/api/admin/ping/delete", { id: [task.id] }, t)
      .then(() => {
        setDeleteOpen(false);
        toast.success(t("common.deleted_successfully"));
        refresh();
      })
      .catch((error) => {
        toast.error(error.message);
      })
      .finally(() => setDeleteLoading(false));
  };

  return (
    // content 层：行增删做淡入淡出——transform 由 dnd-kit 负责，避免两边抢同一个属性
    <motion.tr
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        ...MOTION_TRANSITION.fadeIn,
        delay: Math.min(index * 0.015, 0.12),
      }}
      className="km-ui-table-row transition-colors border-b border-[var(--accent-2)] hover:bg-[var(--accent-2)]"
    >
      <TableCell>
        <div
          {...attributes}
          {...listeners}
          className={`cursor-move p-2 rounded hover:bg-accent-a3 transition-colors ${
            isMobile ? "touch-manipulation select-none" : ""
          }`}
          style={{
            touchAction: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          title={
            isMobile
              ? t("admin.nodeTable.dragToReorder", "长按拖拽重新排序")
              : undefined
          }
        >
          <MenuIcon size={isMobile ? 18 : 16} color={"var(--gray-8)"} />
        </div>
      </TableCell>
      <TableCell>{task.name}</TableCell>
      <TableCell>
        <Flex gap="2" align="center">
          {task.clients && task.clients.length > 0
            ? (() => {
                const names = task.clients.map((uuid) => {
                  const name =
                    nodeDetail.find((node) => node.uuid === uuid)?.name || uuid;
                  return name;
                });
                const joined = names.join(", ");
                return joined.length > 40
                  ? joined.slice(0, 40) + "..."
                  : joined;
              })()
            : t("common.none")}
          {task.default_on && (
            <span className="text-xs text-accent-11">
              {t("ping.default_on_short")}
            </span>
          )}
          <NodeSelectorDialog
            value={form.clients ?? []}
            onChange={(uuids) => {
              const nextForm = { ...form, clients: uuids };
              setForm(nextForm);
              submitEdit(nextForm);
            }}
          >
            <IconButton
              variant="ghost"
              title={t("common.select_clients", "Select clients")}
              aria-label={t("common.select_clients", "Select clients")}
            >
              <MoreHorizontal size="16" />
            </IconButton>
          </NodeSelectorDialog>
        </Flex>
      </TableCell>
      <TableCell>{task.target}</TableCell>
      <TableCell>{task.type}</TableCell>
      <TableCell>{task.interval}</TableCell>
      <TableCell className="flex items-center gap-2">
        {/* 编辑按钮 */}
        <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
          <Dialog.Trigger>
            <IconButton
              variant="soft"
              title={t("common.edit", "Edit")}
              aria-label={t("common.edit", "Edit")}
            >
              <Pencil size="16" />
            </IconButton>
          </Dialog.Trigger>
          <Dialog.Content className="km-pingtask-task-form">
            <Dialog.Title>{t("common.edit")}</Dialog.Title>
            <form onSubmit={handleEdit} className="flex flex-col gap-2">
              <label>{t("common.name")}</label>
              <TextField.Root
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
              <label>{t("common.type")}</label>
              <Select.Root
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as any }))
                }
              >
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="icmp">ICMP</Select.Item>
                  <Select.Item value="tcp">TCP</Select.Item>
                  <Select.Item value="http">HTTP</Select.Item>
                </Select.Content>
              </Select.Root>
              <label>{t("ping.target")}</label>
              <TextField.Root
                value={form.target}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target: e.target.value }))
                }
                required
              />
              <label>{t("common.server")}</label>
              <Flex direction="column" gap="2">
                <NodeSelectorDialog
                  value={form.clients}
                  onChange={(v) => setForm((f) => ({ ...f, clients: v }))}
                />
                <label className="text-sm font-normal text-gray-500">
                  {t("common.selected", { count: form.clients.length })}
                </label>
                <label className="flex min-h-10 items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={form.default_on}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, default_on: !!checked }))
                    }
                  />
                  <span>{t("ping.default_on")}</span>
                </label>
                <label className="text-sm font-normal text-gray-500">
                  {t("ping.default_on_description")}
                </label>
              </Flex>
              <label>
                {t("ping.interval")} ({t("time.second")})
              </label>
              <TextField.Root
                type="number"
                value={form.interval}
                onChange={(e) =>
                  setForm((f) => ({ ...f, interval: Number(e.target.value) }))
                }
                required
              />
              {/* 表单栈 gap 是 group：再加 block，与内容之间合计 section */}
              <Flex gap="2" justify="end" className="mt-km-block">
                <Dialog.Close>
                  <Button
                    variant="soft"
                    color="gray"
                    type="button"
                    onClick={() => setEditOpen(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                </Dialog.Close>
                <Button variant="solid" type="submit" disabled={editSaving}>
                  {t("common.save")}
                </Button>
              </Flex>
            </form>
          </Dialog.Content>
        </Dialog.Root>
        {/* 删除按钮 */}
        <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
          <Dialog.Trigger>
            <IconButton
              variant="soft"
              color="red"
              title={t("common.delete", "Delete")}
              aria-label={t("common.delete", "Delete")}
            >
              <Trash size="16" />
            </IconButton>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>{t("common.delete")}</Dialog.Title>
            <Flex gap="2" justify="end" mt="5">
              <Dialog.Close>
                <Button
                  variant="soft"
                  color="gray"
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              <Button
                variant="solid"
                color="red"
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                {t("common.delete")}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </TableCell>
    </motion.tr>
  );
};

export default TaskRow;
