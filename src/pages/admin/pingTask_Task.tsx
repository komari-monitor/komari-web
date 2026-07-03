import NodeSelectorDialog from "@/components/NodeSelectorDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  Flex,
  IconButton,
  Select,
  TextField,
} from "@radix-ui/themes";
import { AlertCircle, MenuIcon, MoreHorizontal, Pencil, Trash } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const getTaskSortableId = (task: { id?: number; name?: string; target?: string }) =>
  task.id !== undefined
    ? `id-${task.id}`
    : `tmp-${task.name ?? ""}-${task.target ?? ""}`;

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
      return [] as (PingTask & {
        __allClientsDeleted?: boolean;
        __originalCount?: number;
      })[];
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
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkEditOpen, setBulkEditOpen] = React.useState(false);
  const [bulkIntervalEnabled, setBulkIntervalEnabled] = React.useState(false);
  const [bulkInterval, setBulkInterval] = React.useState("60");
  const [bulkClientsEnabled, setBulkClientsEnabled] = React.useState(false);
  const [bulkClients, setBulkClients] = React.useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = React.useState(false);
  const [bulkError, setBulkError] = React.useState("");

  React.useEffect(() => {
    setLocalTasks(processedTasks);
  }, [processedTasks]);

  React.useEffect(() => {
    const existingIds = new Set(
      processedTasks
        .map((task) => task.id)
        .filter((id): id is number => id !== undefined)
    );
    setSelectedIds((ids) => ids.filter((id) => existingIds.has(id)));
  }, [processedTasks]);

  const selectedTasks = React.useMemo(
    () =>
      localTasks.filter(
        (task) => task.id !== undefined && selectedIds.includes(task.id)
      ),
    [localTasks, selectedIds]
  );
  const selectableIds = React.useMemo(
    () =>
      localTasks
        .map((task) => task.id)
        .filter((id): id is number => id !== undefined),
    [localTasks]
  );
  const allSelected =
    selectableIds.length > 0 && selectedIds.length === selectableIds.length;

  const setTaskSelected = (id: number | undefined, checked: boolean) => {
    if (id === undefined) return;
    setSelectedIds((ids) =>
      checked ? Array.from(new Set([...ids, id])) : ids.filter((x) => x !== id)
    );
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const response = await fetch("/api/admin/ping/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedIds }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || t("common.error"));
      }
      toast.success(t("common.deleted_successfully"));
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      refresh();
    } catch (error: any) {
      toast.error(error?.message || t("common.error"));
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!bulkIntervalEnabled && !bulkClientsEnabled) {
      setBulkError(t("common.error"));
      return;
    }
    const interval = Number(bulkInterval);
    if (bulkIntervalEnabled && (!Number.isInteger(interval) || interval <= 0)) {
      setBulkError(t("ping.interval") + " " + t("common.error"));
      return;
    }
    if (
      bulkClientsEnabled &&
      bulkClients.length === 0 &&
      selectedTasks.some((task) => !task.default_on)
    ) {
      setBulkError(t("ping.batch_select_server"));
      return;
    }
    setBulkError("");
    setBulkSaving(true);
    try {
      const response = await fetch("/api/admin/ping/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: selectedTasks.map((task) => ({
            id: task.id,
            name: task.name,
            type: task.type,
            target: task.target,
            default_on: task.default_on,
            clients: bulkClientsEnabled ? bulkClients : task.clients,
            interval: bulkIntervalEnabled ? interval : task.interval,
          })),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || t("common.error"));
      }
      toast.success(t("common.updated_successfully"));
      setBulkEditOpen(false);
      refresh();
    } catch (error: any) {
      setBulkError(error?.message || t("common.error"));
    } finally {
      setBulkSaving(false);
    }
  };

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
      const response = await fetch("/api/admin/ping/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || t("common.error"));
      }
    } catch (error: any) {
      setLocalTasks(previousTasks);
      toast.error(error?.message || t("common.error"));
      refresh();
    }
  };

  return (
    <div>
      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {t("common.selected", { count: selectedIds.length })}
          </span>
          <Flex gap="2" wrap="wrap" justify="end">
            <Dialog.Root
              open={bulkEditOpen}
              onOpenChange={(open) => {
                setBulkEditOpen(open);
                if (!open) setBulkError("");
              }}
            >
              <Dialog.Trigger>
                <Button variant="soft">
                  {t("common.batch_edit")} ({selectedIds.length})
                </Button>
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Title>
                  {t("common.batch_edit")} ({selectedIds.length})
                </Dialog.Title>
                <Flex direction="column" gap="4">
                  {bulkError && (
                    <Callout.Root color="red" size="1" variant="surface">
                      <Callout.Icon>
                        <AlertCircle size="16" />
                      </Callout.Icon>
                      <Callout.Text>{bulkError}</Callout.Text>
                    </Callout.Root>
                  )}
                  <label className="flex items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={bulkIntervalEnabled}
                      onCheckedChange={(checked) => {
                        setBulkIntervalEnabled(!!checked);
                        setBulkError("");
                      }}
                    />
                    <span>
                      {t("ping.interval")} ({t("time.second")})
                    </span>
                  </label>
                  <TextField.Root
                    id="bulk_interval"
                    type="number"
                    value={bulkInterval}
                    disabled={!bulkIntervalEnabled}
                    onChange={(event) => {
                      setBulkInterval(event.target.value);
                      setBulkError("");
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={bulkClientsEnabled}
                      onCheckedChange={(checked) => {
                        setBulkClientsEnabled(!!checked);
                        setBulkError("");
                      }}
                    />
                    <span>{t("common.server")}</span>
                  </label>
                  <div
                    className={
                      bulkClientsEnabled
                        ? ""
                        : "pointer-events-none opacity-50"
                    }
                  >
                    <Flex align="center" gap="2" wrap="wrap">
                      <NodeSelectorDialog
                        value={bulkClients}
                        onChange={(clients) => {
                          setBulkClients(clients);
                          setBulkError("");
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {t("common.selected", { count: bulkClients.length })}
                      </span>
                    </Flex>
                  </div>
                  <Flex gap="2" justify="end" className="mt-2">
                    <Dialog.Close>
                      <Button variant="soft" color="gray" type="button">
                        {t("common.cancel")}
                      </Button>
                    </Dialog.Close>
                    <Button
                      onClick={handleBulkEdit}
                      disabled={
                        bulkSaving ||
                        (!bulkIntervalEnabled && !bulkClientsEnabled)
                      }
                    >
                      {t("common.save")}
                    </Button>
                  </Flex>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
            <Dialog.Root open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
              <Dialog.Trigger>
                <Button variant="solid" color="red">
                  <Trash size="16" />
                  {t("common.batch_delete")} ({selectedIds.length})
                </Button>
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Title>
                  {t("common.batch_delete")} ({selectedIds.length})
                </Dialog.Title>
                <p className="text-sm text-muted-foreground">
                  {t("ping.batch_delete_desc", {
                    count: selectedIds.length,
                  })}
                </p>
                <Flex gap="2" justify="end" className="mt-4">
                  <Dialog.Close>
                    <Button variant="soft" color="gray" type="button">
                      {t("common.cancel")}
                    </Button>
                  </Dialog.Close>
                  <Button
                    variant="solid"
                    color="red"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                  >
                    {t("common.delete")}
                  </Button>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          </Flex>
        </div>
      )}
      <div className="rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" aria-label={t("common.sort")}></TableHead>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) =>
                  setSelectedIds(checked ? selectableIds : [])
                }
                aria-label={t("common.selected", { count: selectedIds.length })}
              />
            </TableHead>
            <TableHead>{t("common.name")}</TableHead>
            <TableHead>{t("common.server")}</TableHead>
            <TableHead>{t("ping.target")}</TableHead>
            <TableHead>{t("ping.type")}</TableHead>
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
              {localTasks.map((task) => (
                <Row
                  key={getTaskSortableId(task)}
                  task={task}
                  selected={
                    task.id !== undefined && selectedIds.includes(task.id)
                  }
                  onSelectedChange={setTaskSelected}
                />
              ))}
            </TableBody>
          </SortableContext>
        </DndContext>
      </Table>
      </div>
    </div>
  );
};

const Row = ({
  task,
  selected,
  onSelectedChange,
}: {
  task: PingTask & { __allClientsDeleted?: boolean; __originalCount?: number };
  selected: boolean;
  onSelectedChange: (id: number | undefined, checked: boolean) => void;
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
    if (!newForm.default_on && newForm.clients.length === 0) {
      toast.error(t("ping.default_on_description"));
      return;
    }
    if (!Number.isInteger(newForm.interval) || newForm.interval <= 0) {
      toast.error(t("ping.interval") + " " + t("common.error"));
      return;
    }
    setEditSaving(true);
    fetch("/api/admin/ping/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data?.message || t("common.error"));
          });
        }
        return res.json();
      })
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
    fetch("/api/admin/ping/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: [task.id] }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data?.message || t("common.error"));
          });
        }
        return res.json();
      })
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
    <TableRow ref={setNodeRef} style={style}>
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
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange(task.id, !!checked)}
          aria-label={task.name}
        />
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
            <IconButton variant="ghost">
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
            <IconButton variant="soft">
              <Pencil size="16" />
            </IconButton>
          </Dialog.Trigger>
          <Dialog.Content>
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
              <label>{t("ping.type")}</label>
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
              <Flex gap="2" justify="end" className="mt-4">
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
            <IconButton variant="soft" color="red">
              <Trash size="16" />
            </IconButton>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>{t("common.delete")}</Dialog.Title>
            <Flex gap="2" justify="end" className="mt-4">
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
    </TableRow>
  );
};
