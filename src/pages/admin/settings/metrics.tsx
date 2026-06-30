import Loading from "@/components/loading";
import {
  SettingCard,
  SettingCardLabel,
  SettingCardShortTextInput,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import { updateSettingsWithToast, useSettings } from "@/lib/api";
import type { SettingsResponse } from "@/lib/api";
import { useRPC2Call } from "@/contexts/RPC2Context";
import {
  Badge,
  Button,
  Callout,
  Dialog,
  Flex,
  Text,
  TextField,
} from "@radix-ui/themes";
import { AlertTriangle, Database, Info, RefreshCw } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

// 迁移状态类型
type MigrationStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "failed";

interface MigrationStatusResponse {
  status: MigrationStatus;
  estimated_records: number;
  estimated_gpu_records: number;
  estimated_ping_records: number;
  tables?: Record<string, number>;
}

const DSN_PLACEHOLDER =
  "./data/metrics.db 或 user:password@tcp(host:3306)/metrics?charset=utf8mb4&parseTime=True";

function toNumber(value: unknown, fallback: number): number {
  const n =
    typeof value === "number"
      ? value
      : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export default function MetricsSettings() {
  const { t } = useTranslation();
  const { settings, loading, error, refetch } = useSettings();
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const saveMetricSettings = React.useCallback(
    async (changes: Partial<SettingsResponse>) => {
      try {
        await updateSettingsWithToast(changes, t);
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        throw e;
      }
    },
    [t]
  );

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  const enabled = Boolean(settings.metric_store_enabled);

  return (
    <Flex direction="column" gap="3">
      <SettingCardLabel>{t("settings.metrics.title")}</SettingCardLabel>

      <Callout.Root color="blue" variant="surface">
        <Callout.Icon>
          <Info size={16} />
        </Callout.Icon>
        <Callout.Text>{t("settings.metrics.intro")}</Callout.Text>
      </Callout.Root>

      {saveError && (
        <Callout.Root color="red" variant="surface">
          <Callout.Icon>
            <AlertTriangle size={16} />
          </Callout.Icon>
          <Callout.Text>{saveError}</Callout.Text>
        </Callout.Root>
      )}

      <SettingCardSwitch
        title={t("settings.metrics.enable_title")}
        description={t("settings.metrics.enable_description")}
        defaultChecked={enabled}
        onChange={async (checked) => {
          await saveMetricSettings({ metric_store_enabled: checked });
        }}
      />

      <SettingCardShortTextInput
        title={t("settings.metrics.dsn_title")}
        description={t("settings.metrics.dsn_description")}
        descriptionPlacement="footer"
        defaultValue={String(settings.metric_db_dsn || "")}
        placeholder={DSN_PLACEHOLDER}
        OnSave={async (value) => {
          await saveMetricSettings({ metric_db_dsn: value.trim() });
        }}
      />

      <SettingCardLabel>
        {t("settings.metrics.advanced_title")}
      </SettingCardLabel>

      <SettingCardShortTextInput
        title={t("settings.metrics.retention_title")}
        description={t("settings.metrics.retention_description")}
        descriptionPlacement="footer"
        type="number"
        defaultValue={String(toNumber(settings.metric_retention_days, 30))}
        placeholder="30"
        OnSave={async (value) => {
          const days = parseInt(value, 10);
          if (isNaN(days) || days <= 0) {
            toast.error(t("settings.metrics.retention_invalid"));
            return;
          }
          await saveMetricSettings({ metric_retention_days: days });
        }}
      />

      <SettingCardShortTextInput
        title={t("settings.metrics.table_prefix_title")}
        description={t("settings.metrics.table_prefix_description")}
        descriptionPlacement="footer"
        defaultValue={String(settings.metric_table_prefix || "metric_")}
        placeholder="metric_"
        OnSave={async (value) => {
          await saveMetricSettings({
            metric_table_prefix: value.trim() || "metric_",
          });
        }}
      />

      <SettingCardShortTextInput
        title={t("settings.metrics.max_open_conns_title")}
        description={t("settings.metrics.max_open_conns_description")}
        descriptionPlacement="footer"
        type="number"
        defaultValue={String(toNumber(settings.metric_max_open_conns, 25))}
        placeholder="25"
        OnSave={async (value) => {
          const n = parseInt(value, 10);
          if (isNaN(n) || n <= 0) {
            toast.error(t("settings.metrics.conns_invalid"));
            return;
          }
          await saveMetricSettings({ metric_max_open_conns: n });
        }}
      />

      <SettingCardShortTextInput
        title={t("settings.metrics.max_idle_conns_title")}
        description={t("settings.metrics.max_idle_conns_description")}
        descriptionPlacement="footer"
        type="number"
        defaultValue={String(toNumber(settings.metric_max_idle_conns, 5))}
        placeholder="5"
        OnSave={async (value) => {
          const n = parseInt(value, 10);
          if (isNaN(n) || n < 0) {
            toast.error(t("settings.metrics.conns_invalid"));
            return;
          }
          await saveMetricSettings({ metric_max_idle_conns: n });
        }}
      />

      <Callout.Root color="green" variant="surface">
        <Callout.Icon>
          <Info size={16} />
        </Callout.Icon>
        <Callout.Text>{t("settings.metrics.restart_hint")}</Callout.Text>
      </Callout.Root>


      <SettingCardLabel>
        {t("settings.metrics.migration_title")}
      </SettingCardLabel>
      <MigrationCard enabled={enabled} onConfigRefetch={refetch} />
    </Flex>
  );
}

function StatusBadge({ status }: { status: MigrationStatus }) {
  const { t } = useTranslation();
  const colorMap: Record<
    MigrationStatus,
    "gray" | "blue" | "green" | "red"
  > = {
    not_started: "gray",
    in_progress: "blue",
    completed: "green",
    failed: "red",
  };
  return (
    <Badge color={colorMap[status]} variant="soft">
      {t(`settings.metrics.status.${status}`)}
    </Badge>
  );
}

function MigrationCard({
  enabled,
  onConfigRefetch,
}: {
  enabled: boolean;
  onConfigRefetch: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { call } = useRPC2Call();

  const [statusData, setStatusData] =
    React.useState<MigrationStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [batchSize, setBatchSize] = React.useState("500");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");

  const fetchStatus = React.useCallback(
    async (silent = false) => {
      if (!enabled) return;
      if (!silent) setLoadingStatus(true);
      try {
        const data = await call<unknown, MigrationStatusResponse>(
          "admin:getMetricMigrationStatus",
          {}
        );
        setStatusData(data);
      } catch (e) {
        if (!silent) {
          toast.error(
            t("settings.metrics.fetch_status_failed") +
              ": " +
              (e instanceof Error ? e.message : String(e))
          );
        }
      } finally {
        if (!silent) setLoadingStatus(false);
      }
    },
    [call, enabled, t]
  );

  React.useEffect(() => {
    void fetchStatus(true);
  }, [fetchStatus]);

  // 迁移进行中时轮询刷新状态
  React.useEffect(() => {
    if (!enabled) return;
    if (statusData?.status !== "in_progress") return;
    const timer = window.setInterval(() => {
      void fetchStatus(true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [enabled, statusData?.status, fetchStatus]);

  if (!enabled) {
    return (
      <Callout.Root color="gray" variant="surface">
        <Callout.Icon>
          <Database size={16} />
        </Callout.Icon>
        <Callout.Text>{t("settings.metrics.migration_disabled")}</Callout.Text>
      </Callout.Root>
    );
  }

  const status: MigrationStatus = statusData?.status || "not_started";
  const canStart = status !== "in_progress" && !starting;
  const canDelete = status === "completed" && !deleting;

  const handleStart = async () => {
    const size = parseInt(batchSize, 10);
    if (isNaN(size) || size <= 0 || size > 5000) {
      toast.error(t("settings.metrics.batch_size_invalid"));
      return;
    }
    setStarting(true);
    try {
      await call("admin:startMetricMigration", { batch_size: size });
      toast.success(t("settings.metrics.migration_started"));
      // 立即刷新状态，并等待状态更新为 in_progress
      await fetchStatus(true);
    } catch (e) {
      toast.error(
        t("settings.metrics.migration_start_failed") +
          ": " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setStarting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await call("admin:deleteLegacyTables", {});
      toast.success(t("settings.metrics.delete_legacy_success"));
      setDeleteDialogOpen(false);
      setConfirmText("");
      await fetchStatus(true);
      await onConfigRefetch();
    } catch (e) {
      toast.error(
        t("settings.metrics.delete_legacy_failed") +
          ": " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingCard
      title={t("settings.metrics.migration_card_title")}
      description={t("settings.metrics.migration_card_description")}
      direction="column"
    >
      <Flex direction="column" gap="3" className="w-full pt-3">
        <Flex gap="2" align="center" wrap="wrap">
          <Text size="2" weight="medium">
            {t("settings.metrics.current_status")}:
          </Text>
          <StatusBadge status={status} />
          <Button
            variant="ghost"
            size="1"
            disabled={loadingStatus}
            onClick={() => void fetchStatus()}
          >
            <RefreshCw
              size={14}
              className={loadingStatus ? "animate-spin" : ""}
            />
            {t("common.refresh")}
          </Button>
        </Flex>

        {statusData && (
          <Flex gap="2" wrap="wrap">
            <Badge variant="soft" color="gray">
              {t("settings.metrics.estimated_records")}:{" "}
              {statusData.estimated_records}
            </Badge>
            <Badge variant="soft" color="gray">
              {t("settings.metrics.estimated_gpu_records")}:{" "}
              {statusData.estimated_gpu_records}
            </Badge>
            <Badge variant="soft" color="gray">
              {t("settings.metrics.estimated_ping_records")}:{" "}
              {statusData.estimated_ping_records}
            </Badge>
          </Flex>
        )}

        {status === "in_progress" && (
          <Callout.Root color="blue" variant="surface">
            <Callout.Icon>
              <RefreshCw size={16} className="animate-spin" />
            </Callout.Icon>
            <Callout.Text>
              {t("settings.metrics.migration_in_progress_hint")}
            </Callout.Text>
          </Callout.Root>
        )}

        {status === "failed" && (
          <Callout.Root color="red" variant="surface">
            <Callout.Icon>
              <AlertTriangle size={16} />
            </Callout.Icon>
            <Callout.Text>
              {t("settings.metrics.migration_failed_hint")}
            </Callout.Text>
          </Callout.Root>
        )}

        <Flex direction="column" gap="2" className="w-full">
          <label className="text-sm font-medium">
            {t("settings.metrics.batch_size")}
          </label>
          <Text size="1" color="gray">
            {t("settings.metrics.batch_size_description")}
          </Text>
          <Flex gap="2" align="center" wrap="wrap">
            <TextField.Root
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              placeholder="500"
              style={{ maxWidth: "160px" }}
              disabled={status === "in_progress"}
            />
            <Button disabled={!canStart} onClick={handleStart}>
              {starting
                ? t("settings.metrics.starting")
                : status === "completed"
                  ? t("settings.metrics.start_again")
                  : t("settings.metrics.start_migration")}
            </Button>
          </Flex>
        </Flex>

        <div className="border-t-1 my-1" />

        <Flex direction="column" gap="2" className="w-full">
          <label className="text-sm font-medium">
            {t("settings.metrics.delete_legacy_title")}
          </label>
          <Text size="1" color="gray">
            {t("settings.metrics.delete_legacy_description")}
          </Text>
          <div>
            <Dialog.Root
              open={deleteDialogOpen}
              onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) setConfirmText("");
              }}
            >
              <Dialog.Trigger>
                <Button color="red" variant="solid" disabled={!canDelete}>
                  {t("settings.metrics.delete_legacy_button")}
                </Button>
              </Dialog.Trigger>
              <Dialog.Content maxWidth="480px">
                <Dialog.Title>
                  {t("settings.metrics.delete_legacy_title")}
                </Dialog.Title>
                <Dialog.Description size="2">
                  {t("settings.metrics.delete_legacy_confirm")}
                </Dialog.Description>
                <Flex direction="column" gap="2" className="mt-4">
                  <Text size="2" color="gray">
                    {t("settings.metrics.delete_legacy_confirm_hint")}
                  </Text>
                  <TextField.Root
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                </Flex>
                <Flex gap="3" mt="4" justify="end">
                  <Dialog.Close>
                    <Button variant="soft" color="gray" disabled={deleting}>
                      {t("common.cancel")}
                    </Button>
                  </Dialog.Close>
                  <Button
                    color="red"
                    disabled={deleting || confirmText.trim() !== "DELETE"}
                    onClick={(e) => {
                      e.preventDefault();
                      void handleDelete();
                    }}
                  >
                    {deleting
                      ? t("settings.metrics.deleting")
                      : t("settings.metrics.delete_legacy_button")}
                  </Button>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          </div>
          {!canDelete && status !== "completed" && (
            <Text size="1" color="gray">
              {t("settings.metrics.delete_legacy_requires_completed")}
            </Text>
          )}
        </Flex>
      </Flex>
    </SettingCard>
  );
}
