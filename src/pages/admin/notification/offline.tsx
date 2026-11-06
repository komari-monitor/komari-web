import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NodeDetailsProvider,
  useNodeDetails,
} from "@/contexts/NodeDetailsContext";
import {
  OfflineNotificationProvider,
  useOfflineNotification,
  type OfflineNotification,
} from "@/contexts/NotificationContext";
import React from "react";
import { Pencil, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Dialog,
  Flex,
  IconButton,
  Switch,
  TextField,
} from "@radix-ui/themes";
import { toast } from "sonner";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import Tips from "@/components/ui/tips";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_TRANSITION } from "@/lib/motion";
import { AutoHeight, StatusFeedback } from "@/components/motion";
import PageHeader from "@/components/PageHeader";

type OfflineEditValues = {
  enable: boolean;
  cooldown: number;
  grace_period: number;
};

// 保留原生 fetch：失败提示需要 res.statusText，且 res.ok 为 false 时仍继续后续流程
const postOfflineEdit = (
  items: ({ client: string | undefined } & OfflineEditValues)[],
) =>
  fetch("/api/admin/notification/offline/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });

const OfflinePage = () => {
  return (
    <OfflineNotificationProvider>
      <NodeDetailsProvider>
        <InnerLayout />
      </NodeDetailsProvider>
    </OfflineNotificationProvider>
  );
};
const NotificationEditForm = ({
  initialValues,
  onSubmit,
  loading,
  onCancel,
}: {
  initialValues: OfflineEditValues;
  onSubmit: (values: OfflineEditValues) => void;
  loading?: boolean;
  onCancel?: () => void;
}) => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = React.useState(initialValues.enable);
  // const [cooldown, setCooldown] = React.useState(initialValues.cooldown);
  const [grace, setGrace] = React.useState(initialValues.grace_period);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ enable: enabled, cooldown: 3000, grace_period: grace });
      }}
      // 对话框表单：字段之间 block，label 与控件 group，底部按钮与内容 section
      className="km-notification-offline-form flex flex-col gap-km-block"
    >
      <div className="flex flex-col items-start gap-km-group">
        <label htmlFor="status">{t("common.status")}</label>
        <Switch
          id="status"
          name="status"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>
      {/* <label htmlFor="cooldown">{t("notification.offline.cooldown")}</label>
      <TextField.Root
        type="number"
        min={0}
        value={cooldown}
        onChange={e => setCooldown(Number(e.target.value))}
        id="cooldown"
        name="cooldown"
      /> */}
      <div className="flex flex-col gap-km-group">
        <label htmlFor="grace_period" className="flex items-center gap-2">
          {t("notification.offline.grace_period")}<Tips>{t("notification.offline.grace_period_tip")}</Tips>
        </label>
        <TextField.Root
          type="number"
          min={0}
          value={grace}
          onChange={(e) => setGrace(Number(e.target.value))}
          id="grace_period"
          name="grace_period"
        />
      </div>
      {/* 父栈 gap 是 block，再补 group 凑成 section */}
      <Flex gap="2" justify="end" className="mt-km-group">
        {onCancel && (
          <Dialog.Close>
            <Button
              variant="soft"
              color="gray"
              type="button"
              onClick={onCancel}
            >
              {t("common.cancel")}
            </Button>
          </Dialog.Close>
        )}
        <Button variant="solid" type="submit" disabled={loading}>
          {t("common.save")}
        </Button>
      </Flex>
    </form>
  );
};

const InnerLayout = () => {
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const {
    loading: onLoading,
    error: onError,
    offlineNotification,
    refresh,
  } = useOfflineNotification();
  const { isLoading: onNodeLoading, error: onNodeError } = useNodeDetails();
  const { t } = useTranslation();
  const [batchLoading, setBatchLoading] = React.useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = React.useState(false);
  const [batchForm, setBatchForm] = React.useState({
    enable: true,
    cooldown: 1800,
    grace_period: 300,
  });

  // 批量修改
  const handleBatchEdit = (values: OfflineEditValues) => {
    setBatchLoading(true);
    const payload = selected.map((id) => ({
      client: id,
      enable: values.enable,
      cooldown: values.cooldown,
      grace_period: values.grace_period,
    }));
    postOfflineEdit(payload)
      .then((res) => {
        if (!res.ok) {
          toast.error(
            "Failed to update offline notifications: " + res.statusText
          );
        } else {
          toast.success(t("common.updated_successfully"));
        }
        return res.json();
      })
      .then(() => {
        setBatchLoading(false);
        setBatchDialogOpen(false);
        refresh();
      })
      .catch((error) => {
        console.error("Error updating offline notifications:", error);
        toast.error(t("common.error", { message: error.message }));
        setBatchLoading(false);
      });
  };

  const pageLoading = onLoading || onNodeLoading;
  if (onError || onNodeError) {
    return <div>Error: {onError?.message || onNodeError}</div>;
  }
  // 加载中页头照常渲染，表格用占位行画成色块；数据到达后原地淡入
  return (
    // 页面骨架：km-page（页头 → 区块 section）；页边距由后台内容区提供，根元素不再加 padding
    <div className="km-page km-page-admin-notification-offline">
      <PageHeader
        title={t("notification.offline.full_title", "离线通知设置")}
        actions={
          <TextField.Root
            type="text"
            className="max-w-64"
            placeholder={t("common.search")}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
          >
            <TextField.Slot>
              <Search size={16} />
            </TextField.Slot>
          </TextField.Root>
        }
      />
      {/* 表格区块：表格 → 底栏 block；底栏里选择计数与批量按钮一行、彼此 group；说明紧跟底栏（group） */}
      <div className="flex flex-col gap-km-block">
        <OfflineNotificationTable
          search={search}
          selected={selected}
          onSelectionChange={setSelected}
          loading={pageLoading}
        />
        <div className="flex flex-col gap-km-group">
          <Flex gap="2" align="center" wrap="wrap">
            <label className="text-sm text-muted-foreground">
              {t("common.selected", {
                count: selected.length,
              })}
            </label>
            <Dialog.Root open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
              <Dialog.Trigger>
                <Button
                  variant="soft"
                  onClick={() => {
                    // 默认取第一个选中项的配置作为初始值
                    const first = offlineNotification.find(
                      (n) => n.client === selected[0]
                    );
                    setBatchForm({
                      enable: first?.enable ?? true,
                      cooldown: first?.cooldown ?? 1800,
                      grace_period: first?.grace_period ?? 300,
                    });
                  }}
                  disabled={batchLoading || selected.length === 0}
                >
                  {t("common.batch_edit")}
                </Button>
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Title>{t("common.batch_edit")}</Dialog.Title>
                <NotificationEditForm
                  initialValues={batchForm}
                  loading={batchLoading}
                  onSubmit={handleBatchEdit}
                  onCancel={() => setBatchDialogOpen(false)}
                />
              </Dialog.Content>
            </Dialog.Root>
          </Flex>
          <label className="km-notification-offline-preview text-sm text-muted-foreground">
            <span
              dangerouslySetInnerHTML={{ __html: t("notification.offline.tips") }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

/** 骨架占位行数：常见的节点数量 */
const OFFLINE_PLACEHOLDER_ROWS = 6;

const OfflineNotificationTable = ({
  search,
  selected,
  onSelectionChange,
  loading = false,
}: {
  search: string;
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
  loading?: boolean;
}) => {
  const { offlineNotification } = useOfflineNotification();
  const { nodeDetail } = useNodeDetails();
  const { t } = useTranslation();
  // 加载中只渲染占位行：两个请求先后到达时，真实行不会和占位行同时出现（表格瞬间变高）
  const filtered = loading ? [] : [...nodeDetail]
    .sort((a, b) => a.weight - b.weight)
    .filter((node) => node.name.toLowerCase().includes(search.toLowerCase()));
  return (
    // 占位行数 -> 真实节点数：表格高度弹簧过渡
    <AutoHeight className="rounded-lg overflow-hidden">
      <Skeletonize loading={loading} className="km-setting-card-skeleton">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-6">
              <Checkbox
                checked={
                  // 没有任何行（加载中/搜索无结果）时不显示「全选」
                  filtered.length > 0 && selected.length === filtered.length
                    ? true
                    : selected.length > 0
                    ? "indeterminate"
                    : false
                }
                onCheckedChange={(checked) =>
                  onSelectionChange(checked ? filtered.map((n) => n.uuid) : [])
                }
              />
            </TableHead>
            <TableHead>{t("common.server")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            {/* <TableHead>{t("notification.offline.cooldown")}</TableHead> */}
            <TableHead>{t("notification.offline.grace_period")}</TableHead>
            <TableHead>{t("notification.offline.last_notified")}</TableHead>
            <TableHead>{t("common.action")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* 骨架行：与真实行同结构（勾选框、名称、状态徽标、宽限期、时间、操作），无退场，数据到达即替换 */}
          {loading
            ? Array.from({ length: OFFLINE_PLACEHOLDER_ROWS }, (_, row) => (
                <TableRow key={`placeholder-${row}`}>
                  <TableCell>
                    <Checkbox checked={false} disabled />
                  </TableCell>
                  <TableCell>{skeletonText(10 + (row % 3) * 3)}</TableCell>
                  <TableCell>
                    <Badge color="gray">{skeletonText(4)}</Badge>
                  </TableCell>
                  <TableCell>{skeletonText(5)}</TableCell>
                  <TableCell>{skeletonText(16)}</TableCell>
                  <TableCell>
                    <IconButton variant="ghost" disabled aria-hidden>
                      <Pencil size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            : null}
          {/* content 层：搜索过滤时行用 layout 弹簧跟随，进出场都过渡 */}
          <AnimatePresence initial={false}>
          {filtered.map((node, index) => (
            <motion.tr
              key={node.uuid}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                ...MOTION_TRANSITION.fadeIn,
                delay: Math.min(index * 0.012, 0.1),
              }}
              className="km-ui-table-row transition-colors border-b border-[var(--accent-2)] hover:bg-[var(--accent-2)]"
            >
              <TableCell>
                <Checkbox
                  checked={selected.includes(node.uuid)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSelectionChange([...selected, node.uuid]);
                    } else {
                      onSelectionChange(
                        selected.filter((id) => id !== node.uuid)
                      );
                    }
                  }}
                />
              </TableCell>
              <TableCell>{node.name}</TableCell>
              <TableCell>
                {/* feedback 层：启用/停用真的翻转时才翻一下 */}
                <StatusFeedback
                  state={Boolean(
                    offlineNotification.find((n) => n.client === node.uuid)
                      ?.enable
                  )}
                >
                  <Badge
                    color={
                      offlineNotification.find((n) => n.client === node.uuid)
                        ?.enable
                        ? "green"
                        : "red"
                    }
                  >
                    {offlineNotification.find((n) => n.client === node.uuid)
                      ?.enable
                      ? t("common.enabled")
                      : t("common.disabled")}
                  </Badge>
                </StatusFeedback>
              </TableCell>
              {/* <TableCell>
                {offlineNotification.find((n) => n.client === node.uuid)
                  ?.cooldown || 1800}{" "}
                {t("nodeCard.time_second")}
              </TableCell> */}
              <TableCell>
                {offlineNotification.find((n) => n.client === node.uuid)
                  ?.grace_period || 300}
                {t("nodeCard.time_second")}
              </TableCell>
              <TableCell>
                {(() => {
                  const lastNotified = offlineNotification.find(
                    (n) => n.client === node.uuid
                  )?.last_notified;
                  if (!lastNotified) return "-";
                  const date = new Date(lastNotified);
                  if (date.getFullYear() < 3)
                    return t("notification.offline.never_triggered");
                  return date.toLocaleString();
                })()}
              </TableCell>
              <TableCell>
                <ActionButtons
                  offlineNotifications={offlineNotification.find(
                    (n) => n.client === node.uuid
                  )}
                />
              </TableCell>
            </motion.tr>
          ))}
          </AnimatePresence>
        </TableBody>
      </Table>
      </Skeletonize>
    </AutoHeight>
  );
};

const ActionButtons = ({
  offlineNotifications,
}: {
  offlineNotifications: OfflineNotification | undefined;
}) => {
  const { t } = useTranslation();
  const { refresh } = useOfflineNotification();
  const [editOpen, setEditOpen] = React.useState(false);
  const [editSaving, setEditSaving] = React.useState(false);

  return (
    <Flex gap="2" align="center">
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Trigger>
          <IconButton
            variant="ghost"
            title={t("common.edit", "Edit")}
            aria-label={t("common.edit", "Edit")}
          >
            <Pencil size={16} />
          </IconButton>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>{t("common.edit")}</Dialog.Title>
          <NotificationEditForm
            initialValues={{
              enable: offlineNotifications?.enable ?? false,
              cooldown: offlineNotifications?.cooldown ?? 1800,
              grace_period: offlineNotifications?.grace_period ?? 300,
            }}
            loading={editSaving}
            onSubmit={(values) => {
              setEditSaving(true);
              postOfflineEdit([
                {
                  client: offlineNotifications?.client,
                  ...values,
                },
              ])
                .then((res) => {
                  if (!res.ok) {
                    toast.error(
                      "Failed to save offline notification settings: " +
                        res.statusText
                    );
                  }
                  toast.success(t("common.updated_successfully"));
                  return res.json();
                })
                .then(() => {
                  setEditOpen(false);
                  refresh();
                  setEditSaving(false);
                })
                .catch((error) => {
                  console.error(
                    "Error saving offline notification settings:",
                    error
                  );
                  toast.error(t("common.error", { message: error.message }));
                });
            }}
            onCancel={() => setEditOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
};

export default OfflinePage;
