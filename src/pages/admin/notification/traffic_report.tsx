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
  TrafficReportNotificationProvider,
  useTrafficReportNotification,
  type TrafficReportNotification,
} from "@/contexts/TrafficReportContext";
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
import Loading from "@/components/loading";

const ensureCadenceSelected = (
  values: { enable: boolean; daily: boolean; weekly: boolean; monthly: boolean },
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  if (values.enable && !values.daily && !values.weekly && !values.monthly) {
    throw new Error(t("notification.traffic_report.errors.select_cadence"));
  }
};

const getErrorMessage = (
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  return error instanceof Error ? error.message : t("common.error");
};

const parseJsonOrThrow = async (res: Response, fallbackMessage: string) => {
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || fallbackMessage);
  }
  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  const text = await res.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text);
};

const TrafficReportPage = () => {
  return (
    <TrafficReportNotificationProvider>
      <NodeDetailsProvider>
        <InnerLayout />
      </NodeDetailsProvider>
    </TrafficReportNotificationProvider>
  );
};

// 表单：编辑单条或批量修改
const TrafficReportEditForm = ({
  initialValues,
  onSubmit,
  loading,
  onCancel,
}: {
  initialValues: { enable: boolean; daily: boolean; weekly: boolean; monthly: boolean };
  onSubmit: (values: { enable: boolean; daily: boolean; weekly: boolean; monthly: boolean }) => void;
  loading?: boolean;
  onCancel?: () => void;
}) => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = React.useState(initialValues.enable);
  const [daily, setDaily] = React.useState(initialValues.daily);
  const [weekly, setWeekly] = React.useState(initialValues.weekly);
  const [monthly, setMonthly] = React.useState(initialValues.monthly);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ enable: enabled, daily, weekly, monthly });
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor="status">{t("common.status")}</label>
      <Switch
        id="status"
        name="status"
        checked={enabled}
        onCheckedChange={setEnabled}
      />

      <label className="font-medium mt-2">
        {t("notification.traffic_report.report_type")}
      </label>
      <Flex direction="column" gap="2">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="daily"
            checked={daily}
            onCheckedChange={(v) => setDaily(!!v)}
          />
          <span>{t("notification.traffic_report.daily")}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="weekly"
            checked={weekly}
            onCheckedChange={(v) => setWeekly(!!v)}
          />
          <span>{t("notification.traffic_report.weekly")}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="monthly"
            checked={monthly}
            onCheckedChange={(v) => setMonthly(!!v)}
          />
          <span>{t("notification.traffic_report.monthly")}</span>
        </label>
      </Flex>

      <Flex gap="2" justify="end" className="mt-4">
        {onCancel && (
          <Dialog.Close>
            <Button variant="soft" color="gray" type="button" onClick={onCancel}>
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

// 把三个 bool 转成展示文字
const reportTypeLabel = (
  n: TrafficReportNotification | undefined,
  t: (key: string) => string
): string => {
  if (!n) return "-";
  const parts: string[] = [];
  if (n.daily) parts.push(t("notification.traffic_report.daily"));
  if (n.weekly) parts.push(t("notification.traffic_report.weekly"));
  if (n.monthly) parts.push(t("notification.traffic_report.monthly"));
  return parts.length > 0
    ? parts.join(t("notification.traffic_report.separator"))
    : "-";
};

const InnerLayout = () => {
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const {
    loading: onLoading,
    error: onError,
    trafficReportNotification,
    refresh,
  } = useTrafficReportNotification();
  const { isLoading: onNodeLoading, error: onNodeError } = useNodeDetails();
  const { t } = useTranslation();
  const [batchLoading, setBatchLoading] = React.useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = React.useState(false);
  const [batchForm, setBatchForm] = React.useState({
    enable: true,
    daily: false,
    weekly: false,
    monthly: false,
  });

  const handleBatchEdit = (values: {
    enable: boolean;
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
  }) => {
    try {
      ensureCadenceSelected(values, t);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
      return;
    }

    setBatchLoading(true);
    const payload = selected.map((id) => ({
      client: id,
      ...values,
    }));
    fetch("/api/admin/notification/traffic-report/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) =>
        parseJsonOrThrow(
          res,
          t("notification.traffic_report.errors.update_failed")
        )
      )
      .then(() => {
        setBatchDialogOpen(false);
        toast.success(t("common.updated_successfully"));
        refresh();
      })
      .catch((error) => {
        console.error("Error updating traffic report notifications:", error);
        toast.error(getErrorMessage(error, t));
      })
      .finally(() => {
        setBatchLoading(false);
      });
  };

  if (onLoading || onNodeLoading) {
    return <Loading text={t("loading")} />;
  }
  if (onError || onNodeError) {
    return <div>{t("common.error")}: {onError?.message || onNodeError}</div>;
  }

  return (
    <div className="flex flex-col gap-4 md:p-4 p-1">
      <Flex justify="between" align="center" wrap="wrap">
        <label className="text-2xl font-semibold">
          {t("notification.traffic_report.full_title")}
        </label>
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
      </Flex>

      <TrafficReportTable
        search={search}
        selected={selected}
        onSelectionChange={setSelected}
      />

      <label className="text-sm text-muted-foreground">
        {t("common.selected", { count: selected.length })}
      </label>

      <Flex gap="2" align="center">
        <Dialog.Root open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
          <Dialog.Trigger>
            <Button
              variant="soft"
              onClick={() => {
                const first = trafficReportNotification.find(
                  (n) => n.client === selected[0]
                );
                setBatchForm({
                  enable: first?.enable ?? true,
                  daily: first?.daily ?? false,
                  weekly: first?.weekly ?? false,
                  monthly: first?.monthly ?? false,
                });
              }}
              disabled={batchLoading || selected.length === 0}
            >
              {t("notification.traffic_report.batch_edit")}
            </Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>{t("notification.traffic_report.batch_edit")}</Dialog.Title>
            <TrafficReportEditForm
              initialValues={batchForm}
              loading={batchLoading}
              onSubmit={handleBatchEdit}
              onCancel={() => setBatchDialogOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    </div>
  );
};

const TrafficReportTable = ({
  search,
  selected,
  onSelectionChange,
}: {
  search: string;
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
}) => {
  const { trafficReportNotification } = useTrafficReportNotification();
  const { nodeDetail } = useNodeDetails();
  const { t } = useTranslation();

  const filtered = [...nodeDetail]
    .sort((a, b) => a.weight - b.weight)
    .filter((node) => node.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-6">
              <Checkbox
                checked={
                  selected.length === filtered.length
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
            <TableHead>{t("notification.traffic_report.report_type")}</TableHead>
            <TableHead>{t("common.action")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((node) => {
            const n = trafficReportNotification.find(
              (item) => item.client === node.uuid
            );
            return (
              <TableRow key={node.uuid}>
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
                  <Badge color={n?.enable ? "green" : "red"}>
                    {n?.enable ? t("common.enabled") : t("common.disabled")}
                  </Badge>
                </TableCell>
                <TableCell>{reportTypeLabel(n, t)}</TableCell>
                <TableCell>
                  <ActionButtons
                    nodeUUID={node.uuid}
                    trafficReport={n}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

const ActionButtons = ({
  nodeUUID,
  trafficReport,
}: {
  nodeUUID: string;
  trafficReport: TrafficReportNotification | undefined;
}) => {
  const { t } = useTranslation();
  const { refresh } = useTrafficReportNotification();
  const [editOpen, setEditOpen] = React.useState(false);
  const [editSaving, setEditSaving] = React.useState(false);

  return (
    <Flex gap="2" align="center">
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Trigger>
          <IconButton variant="ghost">
            <Pencil size={16} />
          </IconButton>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>{t("common.edit")}</Dialog.Title>
          <TrafficReportEditForm
            initialValues={{
              enable: trafficReport?.enable ?? false,
              daily: trafficReport?.daily ?? false,
              weekly: trafficReport?.weekly ?? false,
              monthly: trafficReport?.monthly ?? false,
            }}
            loading={editSaving}
            onSubmit={(values) => {
              try {
                ensureCadenceSelected(values, t);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : t("common.error")
                );
                return;
              }

              setEditSaving(true);
              fetch("/api/admin/notification/traffic-report/edit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([
                  {
                    client: nodeUUID,
                    ...values,
                  },
                ]),
              })
                .then((res) =>
                  parseJsonOrThrow(
                    res,
                    t("notification.traffic_report.errors.save_failed")
                  )
                )
                .then(() => {
                  setEditOpen(false);
                  toast.success(t("common.updated_successfully"));
                  refresh();
                })
                .catch((error) => {
                  console.error("Error saving traffic report settings:", error);
                  toast.error(getErrorMessage(error, t));
                })
                .finally(() => {
                  setEditSaving(false);
                });
            }}
            onCancel={() => setEditOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
};

export default TrafficReportPage;
