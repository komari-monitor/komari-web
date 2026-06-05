import Loading from "@/components/loading";
import NodeSelectorDialog from "@/components/NodeSelectorDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LoadAlertProvider,
  useLoadAlert,
  type LoadAlert,
} from "@/contexts/LoadAlertContext";
import {
  NodeDetailsProvider,
  useNodeDetails,
} from "@/contexts/NodeDetailsContext";
import { useLiveData } from "@/contexts/LiveDataContext";

import {
  Button,
  Checkbox,
  Dialog,
  Flex,
  IconButton,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/** 解析 partition 字段，兼容 JSON 数组和旧版单字符串 */
const parsePartitions = (partition: string | undefined): string[] => {
  if (!partition) return [];
  if (partition.startsWith("[")) {
    try {
      const parsed = JSON.parse(partition);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  return [partition];
};

/**
 * 从 LiveData 中获取指定节点的分区名
 * 同时尝试默认主题和 PurCarte 两种数据源，哪个有数据就用哪个
 * 数据结构：
 *   - 默认主题: { data: { data: { uuid: { disk: { partitions: [{name}] } } } } }
 *   - PurCarte:  { uuid: { disk_partitions: [{name}] } }
 * @param sources LiveData 数据源数组（依次尝试）
 * @param nodeUUIDs 要查询的节点 UUID 列表（空则查所有节点）
 */
const getAvailablePartitions = (
  sources: any[],
  nodeUUIDs?: string[],
): string[] => {
  const trySource = (liveData: any): string[] => {
    try {
      if (!liveData || typeof liveData !== "object") return [];
      const set = new Set<string>();
      const uuidSet = new Set(nodeUUIDs);

      const addNames = (arr: any[] | undefined) => {
        if (!Array.isArray(arr)) return;
        for (const p of arr) {
          if (p && typeof p.name === "string") set.add(p.name);
        }
      };

      // 尝试1: PurCarte 结构 —— 顶层 uuid → { disk_partitions: [...] }
      const topKeys = Object.keys(liveData);
      if (topKeys.length > 0) {
        const sample = liveData[topKeys[0]];
        if (
          sample &&
          typeof sample === "object" &&
          !Array.isArray(sample)
        ) {
          if (
            Array.isArray(sample.disk_partitions) ||
            "disk_permissions" in sample
          ) {
            for (const k of topKeys) {
              if (uuidSet.size > 0 && !uuidSet.has(k)) continue;
              addNames((liveData[k] as any)?.disk_partitions);
            }
            if (set.size > 0) return Array.from(set).sort();
          }
        }
      }

      // 尝试2: 默认主题嵌套结构 —— 循环解开 data.data...
      let inner = liveData;
      for (let i = 0; i < 4; i++) {
        if (
          inner &&
          inner.data &&
          typeof inner.data === "object" &&
          !Array.isArray(inner.data)
        ) {
          inner = inner.data;
        } else {
          break;
        }
      }
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        for (const k of Object.keys(inner)) {
          if (uuidSet.size > 0 && !uuidSet.has(k)) continue;
          const node = inner[k];
          if (node && typeof node === "object") {
            addNames(node?.disk?.partitions);
            addNames((node as any)?.disk_partitions);
          }
        }
        if (set.size > 0) return Array.from(set).sort();
      }

      return [];
    } catch {
      return [];
    }
  };

  // 依次尝试每个数据源，返回第一个非空结果
  for (const src of sources) {
    const result = trySource(src);
    if (result.length > 0) return result;
  }
  // 所有数据源都没找到，返回空（即使有数据但结构不匹配也不误报）
  return [];
};

/** 格式化分区列表为显示字符串 */
const formatPartitionDisplay = (partition: string | undefined): string => {
  const parts = parsePartitions(partition);
  if (parts.length === 0) return "";
  return parts.join(", ");
};

const LoadPage = () => {
  return (
    <LoadAlertProvider>
      <NodeDetailsProvider>
        <InnerLayout />
      </NodeDetailsProvider>
    </LoadAlertProvider>
  );
};

const InnerLayout = () => {
  const { loadAlerts, isLoading, error } = useLoadAlert();
  const { isLoading: nodeDetailLoading, error: nodeDetailError } =
    useNodeDetails();
  const { t } = useTranslation();
  if (isLoading || nodeDetailLoading) {
    return <Loading />;
  }
  if (error || nodeDetailError) {
    return <div>{error || nodeDetailError}</div>;
  }
  return (
    <Flex direction="column" gap="4" className="p-4">
      <div className="flex justify-between items-center">
        <label className="text-2xl font-bold">
          {t("notification.load.title")}
        </label>
        <AddButton />
      </div>

      <div className="rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableHead>{t("common.name")}</TableHead>
            <TableHead>{t("common.server")}</TableHead>
            <TableHead>{t("loadAlert.metric")}</TableHead>
            <TableHead>{t("common.threshold")}</TableHead>
            <TableHead>{t("loadAlert.ratio")}</TableHead>
            <TableHead>{t("ping.interval")}</TableHead>
            <TableHead>{t("common.action")}</TableHead>
          </TableHeader>
          <TableBody>
            {loadAlerts
              ?.slice()
              .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
              .map((alert) => (
                <Row key={alert.id} alert={alert} />
              ))}
          </TableBody>
        </Table>
      </div>
    </Flex>
  );
};

const Row = ({ alert }: { alert: LoadAlert }) => {
  const { t } = useTranslation();
  const { refresh } = useLoadAlert();
  const { nodeDetail } = useNodeDetails();
  const { live_data: liveDataDefault, liveData: liveDataPurcarte } =
    useLiveData() as any;
  const [editOpen, setEditOpen] = React.useState(false);
  const [editSaving, setEditSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [selectedPartitions, setSelectedPartitions] = React.useState<string[]>(
    parsePartitions(alert.partition),
  );
  const [form, setForm] = React.useState({
    name: alert.name || "",
    metric: alert.metric || "cpu",
    threshold: alert.threshold || 80,
    ratio: alert.ratio || 0.8,
    clients: alert.clients || [],
    interval: alert.interval || 15,
  });

  const availablePartitions = React.useMemo(
    () => getAvailablePartitions(
      [liveDataDefault, liveDataPurcarte],
      form.clients,
    ),
    [liveDataDefault, liveDataPurcarte, form.clients],
  );

  // 稳定 NodeSelectorDialog 的 value 引用，避免每次 render 创建新 []
  const nodeSelectorValue = React.useMemo(() => form.clients ?? [], [form.clients]);

  const submitEdit = (newForm: typeof form) => {
    setEditSaving(true);
    const payload: Record<string, any> = {
      id: alert.id,
      name: newForm.name,
      metric: newForm.metric,
      threshold: newForm.threshold,
      ratio: newForm.ratio,
      clients: newForm.clients,
      interval: newForm.interval,
    };
    if (newForm.metric === "disk" && selectedPartitions.length > 0) {
      payload.partition = JSON.stringify(selectedPartitions);
    }
    fetch("/api/admin/notification/load/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifications: [payload] }),
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
    fetch("/api/admin/notification/load/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: [alert.id] }),
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
    <TableRow key={alert.id}>
      <TableCell>{alert.name}</TableCell>
      <TableCell>
        <Flex gap="2" align="center">
          {alert.clients && alert.clients.length > 0
            ? (() => {
                const names = alert.clients.map((uuid) => {
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
          <NodeSelectorDialog
            value={nodeSelectorValue}
            hiddenUuidOnlyClient
            onChange={(uuids) => {
              setForm((f) => ({ ...f, clients: uuids }));
              submitEdit({ ...form, clients: uuids });
            }}
          >
            <IconButton variant="ghost">
              <MoreHorizontal size="16" />
            </IconButton>
          </NodeSelectorDialog>
        </Flex>
      </TableCell>
      <TableCell>
        {alert.metric?.toUpperCase()}
        {alert.partition
          ? ` (${formatPartitionDisplay(alert.partition)})`
          : ""}
      </TableCell>
      <TableCell>{alert.threshold}%</TableCell>
      <TableCell>{alert.ratio}</TableCell>
      <TableCell>
        {alert.interval} {t("time.minute")}
      </TableCell>
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
              <label>{t("common.server")}</label>
              <Flex>
                <NodeSelectorDialog
                  value={form.clients}
                  hiddenUuidOnlyClient
                  onChange={(v) => setForm((f) => ({ ...f, clients: v }))}
                />
              </Flex>
              <label>{t("loadAlert.metric")}</label>
              <Select.Root
                value={form.metric}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    metric: v as any,
                  }))
                }
              >
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="cpu">CPU</Select.Item>
                  <Select.Item value="ram">RAM</Select.Item>
                  <Select.Item value="disk">Disk</Select.Item>
                  <Select.Item value="net_in">Net In</Select.Item>
                  <Select.Item value="net_out">Net Out</Select.Item>
                </Select.Content>
              </Select.Root>
              {form.metric === "disk" && (
                <>
                  <label>{t("loadAlert.partition")}</label>
                  {availablePartitions.length === 0 ? (
                    <Text size="2" color="gray">
                      {form.clients.length === 0
                        ? t("loadAlert.selectServerFirst")
                        : t("loadAlert.noPartitionData")}
                    </Text>
                  ) : (
                    <>
                      <Flex gap="1" align="baseline" className="select-none">
                        <Checkbox
                          checked={
                            selectedPartitions.length ===
                              availablePartitions.length &&
                            availablePartitions.length > 0
                          }
                          onCheckedChange={(checked) =>
                            setSelectedPartitions(
                              checked ? availablePartitions : [],
                            )
                          }
                        />
                        <Text
                          size="2"
                          className="cursor-pointer"
                          onClick={() =>
                            setSelectedPartitions(
                              selectedPartitions.length ===
                                availablePartitions.length
                                ? []
                                : availablePartitions,
                            )
                          }
                        >
                          {selectedPartitions.length ===
                          availablePartitions.length
                            ? t("loadAlert.deselectAll")
                            : t("loadAlert.allPartitions")}
                        </Text>
                      </Flex>
                      <Flex gap="2" wrap="wrap" className="ml-1">
                        {availablePartitions.map((p) => {
                          const isSelected = selectedPartitions.includes(p);
                          return (
                            <Flex
                              key={p}
                              gap="1"
                              align="baseline"
                              className="select-none"
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() =>
                                  setSelectedPartitions((prev) =>
                                    prev.includes(p)
                                      ? prev.filter((x) => x !== p)
                                      : [...prev, p],
                                  )
                                }
                              />
                              <Text
                                size="2"
                                className="cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPartitions((prev) =>
                                    prev.includes(p)
                                      ? prev.filter((x) => x !== p)
                                      : [...prev, p],
                                  );
                                }}
                              >
                                {p}
                              </Text>
                            </Flex>
                          );
                        })}
                      </Flex>
                    </>
                  )}
                </>
              )}
              <label>{t("common.threshold")} (%)</label>
              <TextField.Root
                type="number"
                value={form.threshold}
                onChange={(e) =>
                  setForm((f) => ({ ...f, threshold: Number(e.target.value) }))
                }
                required
              />
              <label>{t("loadAlert.ratio")}</label>
              <TextField.Root
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={form.ratio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ratio: Number(e.target.value) }))
                }
                required
              />
              <label>
                {t("ping.interval")} ({t("time.minute")})
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

const AddButton: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const { refresh } = useLoadAlert();
  const { live_data: liveDataDefault, liveData: liveDataPurcarte } =
    useLiveData() as any;
  const [selectedType, setSelectedType] = React.useState<
    "cpu" | "ram" | "disk" | "net_in" | "net_out"
  >("cpu");
  const [selectedPartitions, setSelectedPartitions] = React.useState<string[]>(
    [],
  );
  const [saving, setSaving] = React.useState(false);

  const availablePartitions = React.useMemo(
    () => getAvailablePartitions(
      [liveDataDefault, liveDataPurcarte],
      selected,
    ),
    [liveDataDefault, liveDataPurcarte, selected],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload: Record<string, any> = {
      name: e.currentTarget.load_name.value,
      metric: selectedType,
      threshold: parseFloat(e.currentTarget.threshold.value),
      ratio: parseFloat(e.currentTarget.ratio.value),
      clients: selected,
      interval: parseInt(e.currentTarget.interval.value, 10),
    };
    if (selectedType === "disk" && selectedPartitions.length > 0) {
      payload.partition = JSON.stringify(selectedPartitions);
    }
    setSaving(true);
    fetch("/api/admin/notification/load/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (response.ok) {
          setIsOpen(false);
          setSelected([]);
          setSelectedType("cpu");
          setSelectedPartitions([]);
          toast.success(t("common.success"));
        } else {
          response
            .json()
            .then((data) => {
              toast.error(data?.message || t("common.error"));
            })
            .catch((error) => {
              toast.error(error.message);
            });
        }
      })
      .catch((error) => {
        console.error("Error adding load alert:", error);
        toast.error(error.message);
      })
      .finally(() => {
        setSaving(false);
        refresh();
      });
  };
  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger>
        <Button>{t("common.add")}</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{t("common.add")}</Dialog.Title>
        <form onSubmit={handleSubmit}>
          <Flex direction="column" justify="end" gap="2" className="font-bold">
            <label htmlFor="load_name">{t("common.name")}</label>
            <TextField.Root id="load_name" name="load_name" />
            <label htmlFor="select">{t("common.server")}</label>
            <div className="flex items-center justify-start gap-2">
              <NodeSelectorDialog value={selected} onChange={setSelected} />
              <label className="text-md font-normal">
                {t("common.selected", { count: selected.length })}
              </label>
            </div>
            <label htmlFor="type">{t("loadAlert.metric")}</label>
            <Select.Root
              value={selectedType}
              onValueChange={(value) => {
                setSelectedType(
                  value as "cpu" | "ram" | "disk" | "net_in" | "net_out",
                );
                if (value !== "disk") setSelectedPartitions([]);
              }}
            >
              <Select.Trigger id="type" name="type" />
              <Select.Content>
                <Select.Item value="cpu">CPU</Select.Item>
                <Select.Item value="ram">RAM</Select.Item>
                <Select.Item value="disk">Disk</Select.Item>
                <Select.Item value="net_in">Net In(Mbps)</Select.Item>
                <Select.Item value="net_out">Net Out(Mbps)</Select.Item>
              </Select.Content>
            </Select.Root>
            {selectedType === "disk" && (
              <>
                <label htmlFor="partition">{t("loadAlert.partition")}</label>
                {availablePartitions.length === 0 ? (
                  <Text size="2" color="gray">
                    {selected.length === 0
                      ? t("loadAlert.selectServerFirst")
                      : t("loadAlert.noPartitionData")}
                  </Text>
                ) : (
                  <>
                    <Flex gap="1" align="baseline" className="select-none">
                      <Checkbox
                        checked={
                          selectedPartitions.length ===
                            availablePartitions.length &&
                          availablePartitions.length > 0
                        }
                        onCheckedChange={(checked) =>
                          setSelectedPartitions(
                            checked ? availablePartitions : [],
                          )
                        }
                      />
                      <Text
                        size="2"
                        className="cursor-pointer"
                        onClick={() =>
                          setSelectedPartitions(
                            selectedPartitions.length ===
                              availablePartitions.length
                              ? []
                              : availablePartitions,
                          )
                        }
                      >
                        {selectedPartitions.length ===
                        availablePartitions.length
                          ? t("loadAlert.deselectAll")
                          : t("loadAlert.allPartitions")}
                      </Text>
                    </Flex>
                    <Flex gap="2" wrap="wrap" className="ml-1">
                      {availablePartitions.map((p) => {
                        const isSelected = selectedPartitions.includes(p);
                        return (
                          <Flex
                            key={p}
                            gap="1"
                            align="baseline"
                            className="select-none"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                setSelectedPartitions((prev) =>
                                  prev.includes(p)
                                    ? prev.filter((x) => x !== p)
                                    : [...prev, p],
                                )
                              }
                            />
                            <Text
                              size="2"
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPartitions((prev) =>
                                  prev.includes(p)
                                    ? prev.filter((x) => x !== p)
                                    : [...prev, p],
                                );
                              }}
                            >
                              {p}
                            </Text>
                          </Flex>
                        );
                      })}
                    </Flex>
                  </>
                )}
              </>
            )}
            <label htmlFor="threshold">{t("common.threshold")} (%/Mbps)</label>
            <TextField.Root
              id="threshold"
              name="threshold"
              type="number"
              defaultValue={80}
              step="0.1"
            />
            <label htmlFor="ratio">{t("loadAlert.ratio")}</label>
            <TextField.Root
              id="ratio"
              name="ratio"
              type="number"
              step="0.1"
              min="0"
              max="1"
              defaultValue={0.8}
            />
            <label htmlFor="interval">
              {t("ping.interval")} ({t("time.minute")})
            </label>
            <TextField.Root
              id="interval"
              name="interval"
              defaultValue={15}
              type="number"
              placeholder="15"
            />
            <div className="flex justify-end gap-2">
              <Dialog.Close>
                <Button variant="soft">{t("common.close")}</Button>
              </Dialog.Close>
              <Button disabled={saving} type="submit">
                {t("common.add")}
              </Button>
            </div>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default LoadPage;
