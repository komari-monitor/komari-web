import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { AutoHeight, Collapse } from "@/components/motion";
import { formatBytes } from "@/utils/unitHelper";
import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { DatabaseZap, RefreshCw } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { SettingCard } from "./SettingCard";
import { ApiError, requestJson, type RequestOptions } from "@/lib/http";
import { useRouteQuery } from "@/lib/routeData";
import { databaseOverviewQuery, type DatabaseOverviewRaw } from "@/routeQueries/settings";

const maintenanceActionSchema = z.enum([
  "vacuum",
  "optimize",
  "vacuum_full",
]);
const nullableSizeSchema = z.number().finite().nonnegative().nullable();
const databaseInfoSchema = z.object({
  driver: z.string().trim().min(1),
  location: z.enum(["local", "external"]),
  size: nullableSizeSchema,
  action: maintenanceActionSchema,
  error: z.string().optional(),
});
const databaseOverviewSchema = z.object({
  main: databaseInfoSchema,
  monitoring: databaseInfoSchema,
  local_total: nullableSizeSchema,
});
const maintenanceItemSchema = z.object({
  driver: z.string().trim().min(1),
  action: maintenanceActionSchema,
  before: nullableSizeSchema,
  after: nullableSizeSchema,
  success: z.boolean(),
  error: z.string().optional(),
  size_error: z.string().optional(),
});
const maintenanceResultSchema = z.object({
  all_succeeded: z.boolean(),
  main: maintenanceItemSchema,
  monitoring: maintenanceItemSchema,
});

type DatabaseInfo = z.infer<typeof databaseInfoSchema>;
type DatabaseOverview = z.infer<typeof databaseOverviewSchema>;
type DatabaseMaintenanceResult = z.infer<typeof maintenanceResultSchema>;
type TranslationFunction = ReturnType<typeof useTranslation>["t"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 响应体必须是 { status: "success", data }；否则优先用服务器 message，再退回 fallbackMessage。
async function requestAdminData(
  input: string,
  fallbackMessage: string,
  init?: RequestOptions,
): Promise<unknown> {
  let payload: unknown;
  let ok = true;
  try {
    payload = await requestJson(input, init);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    payload = error.body;
    ok = false;
  }

  return unwrapAdminData({ ok, payload }, fallbackMessage);
}

function unwrapAdminData({ ok, payload }: DatabaseOverviewRaw, fallbackMessage: string): unknown {
  if (ok && isRecord(payload) && payload.status === "success" && "data" in payload) {
    return payload.data;
  }
  throw new Error(
    isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : fallbackMessage,
  );
}

function driverLabel(driver: string): string {
  switch (driver.toLowerCase()) {
    case "sqlite":
      return "SQLite";
    case "mysql":
    case "mariadb":
      return "MySQL / MariaDB";
    case "postgres":
    case "postgresql":
      return "PostgreSQL";
    default:
      return driver;
  }
}

/** 首次加载时的占位：与真实概览同结构，由 Skeletonize 画成等宽的条 */
const PLACEHOLDER_INFO: DatabaseInfo = {
  driver: skeletonText(6),
  location: "local",
  size: null,
  action: "vacuum",
};
const PLACEHOLDER_OVERVIEW: DatabaseOverview = {
  main: PLACEHOLDER_INFO,
  monitoring: PLACEHOLDER_INFO,
  local_total: 0,
};

function DatabaseSummaryRow({
  label,
  info,
  placeholder = false,
}: {
  label: string;
  info: DatabaseInfo;
  placeholder?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 border-b border-[var(--gray-a5)] py-3">
      <div className="min-w-0">
        <Text as="div" size="2" weight="medium">
          {label}
        </Text>
        <Text as="div" size="1" color="gray">
          {placeholder
            ? skeletonText(14)
            : `${driverLabel(info.driver)} / ${t(`settings.database.locations.${info.location}`)}`}
        </Text>
        {info.error ? (
          <Text as="div" size="1" color="red" className="break-words">
            {info.error}
          </Text>
        ) : null}
      </div>
      <Text size="2" weight="medium" className="whitespace-nowrap">
        {placeholder
          ? skeletonText(7)
          : info.size === null
            ? t("common.unknown")
            : formatBytes(info.size)}
      </Text>
    </div>
  );
}

function LocalDatabaseTotalRow({ size, placeholder = false }: { size: number; placeholder?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 py-3">
      <div className="min-w-0">
        <Text as="div" size="2" weight="medium">
          {t("settings.database.local_total")}
        </Text>
        <Text as="div" size="1" color="gray">
          {t("settings.database.local_total_description")}
        </Text>
      </div>
      <Text size="2" weight="bold" className="whitespace-nowrap">
        {placeholder ? skeletonText(7) : formatBytes(size)}
      </Text>
    </div>
  );
}

function MaintenanceActionRow({
  label,
  info,
}: {
  label: string;
  info: DatabaseInfo;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-1 border-b border-[var(--gray-a5)] py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
      <div className="min-w-0">
        <Text as="div" size="2" weight="medium">
          {label}
        </Text>
        <Text as="div" size="1" color="gray">
          {driverLabel(info.driver)} / {t(`settings.database.locations.${info.location}`)}
        </Text>
      </div>
      <Text
        as="div"
        size="2"
        weight="medium"
        className="break-words sm:text-right"
      >
        {t(`settings.database.actions.${info.action}`)}
      </Text>
    </div>
  );
}

function maintenanceFailureDescription(
  result: DatabaseMaintenanceResult,
  t: TranslationFunction,
): string | undefined {
  const failures = (
    [
      [t("settings.database.main"), result.main],
      [t("settings.database.monitoring"), result.monitoring],
    ] as const
  )
    .filter(([, item]) => !item.success)
    .map(
      ([label, item]) =>
        `${label}: ${
          item.error || item.size_error || t("settings.database.operation_failed")
        }`,
    );

  return failures.length > 0 ? failures.join("; ") : undefined;
}

export function DatabaseMaintenanceCard() {
  const { t } = useTranslation();
  const [overviewState, setOverview] = React.useState<DatabaseOverview | null>(null);
  const [loadingState, setLoading] = React.useState(true);
  const [loadErrorState, setLoadError] = React.useState<string | null>(null);
  let overview = overviewState;
  let loading = loadingState;
  let loadError = loadErrorState;
  const [maintaining, setMaintaining] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // 首次读取来自页面切换时的预取（routeQueries/settings.ts），数据先到就不闪骨架；
  // 维护完成后的刷新仍走 fetchOverview，之后以本地状态为准。
  const initial = useRouteQuery(databaseOverviewQuery);
  const [refetched, setRefetched] = React.useState(false);

  /** 把原始响应解析成概览或错误文字（与原来的校验、文案一致） */
  const resolveOverview = React.useCallback(
    (raw: DatabaseOverviewRaw | undefined, error: unknown): { overview: DatabaseOverview | null; error: string | null } => {
      const fallbackMessage = t("settings.database.load_error");
      try {
        if (error !== undefined) throw error;
        const data = unwrapAdminData(raw!, fallbackMessage);
        const parsed = databaseOverviewSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error(t("settings.database.invalid_response"));
        }
        return { overview: parsed.data, error: null };
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return {
          overview: null,
          error: message === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${message}`,
        };
      }
    },
    [t],
  );

  const fetchOverview = React.useCallback(async () => {
    setRefetched(true);
    setLoading(true);
    setLoadError(null);
    let raw: DatabaseOverviewRaw | undefined;
    let error: unknown;
    try {
      raw = await databaseOverviewQuery.fetch();
    } catch (cause) {
      error = cause;
    }
    const result = resolveOverview(raw, error);
    setOverview(result.overview);
    setLoadError(result.error);
    setLoading(false);
  }, [resolveOverview]);

  const handleMaintenance = async () => {
    if (!overview || maintaining) return;

    setConfirmOpen(false);
    setMaintaining(true);
    try {
      const data = await requestAdminData(
        "/api/admin/database/vacuum",
        t("settings.database.maintenance_error"),
        { method: "POST" },
      );
      const parsed = maintenanceResultSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(t("settings.database.invalid_response"));
      }

      const result = parsed.data;
      const allItemsSucceeded = result.main.success && result.monitoring.success;
      if (result.all_succeeded && allItemsSucceeded) {
        toast.success(t("settings.database.maintenance_success"));
      } else {
        toast.warning(t("settings.database.maintenance_partial_failure"), {
          description: maintenanceFailureDescription(result, t),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("settings.database.maintenance_error"), {
        description: message,
      });
    } finally {
      await fetchOverview();
      setMaintaining(false);
    }
  };

  if (!refetched) {
    // 还没手动刷新过：直接从预取结果派生，不经过 effect（避免多画一帧骨架）
    const result = initial.loading ? null : resolveOverview(initial.data, initial.error ?? undefined);
    overview = result?.overview ?? null;
    loadError = result?.error ?? null;
    loading = initial.loading;
  }

  const actionDisabled = loading || maintaining;
  // 首次加载（还没有概览）：用占位概览渲染同结构，外层 Skeletonize 画骨架
  const placeholder = !overview && loading;
  const shown = overview ?? (placeholder ? PLACEHOLDER_OVERVIEW : null);

  return (
    <SettingCard
      title={t("settings.database.maintenance_title")}
      description={t("settings.database.maintenance_description")}
      className="km-admin-db-maintenance-card"
    >
      {/* 骨架 -> 概览 / 概览 -> 错误：内容行数变化时卡片高度弹簧过渡 */}
      <AutoHeight className="w-full">
      <Flex direction="column" className="w-full pt-km-group" gap="0">
        <Skeletonize loading={placeholder}>
        {shown ? (
          <>
            <DatabaseSummaryRow
              label={t("settings.database.main")}
              info={shown.main}
              placeholder={placeholder}
            />
            <DatabaseSummaryRow
              label={t("settings.database.monitoring")}
              info={shown.monitoring}
              placeholder={placeholder}
            />
            {shown.local_total !== null ? (
              <LocalDatabaseTotalRow size={shown.local_total} placeholder={placeholder} />
            ) : null}
          </>
        ) : null}
        </Skeletonize>

        <Collapse open={Boolean(loadError)}>
          <Text as="div" size="2" color="red" className="break-words py-3">
            {loadError}
          </Text>
        </Collapse>

        <Flex justify="end" className="pt-km-block">
          {/* 同一个 Skeletonize 包住按钮位：占位按钮 -> 真实按钮时文字原地淡入，不换外壳 */}
          <Skeletonize loading={placeholder} as="span">
          {!overview && loadError ? (
            <Button
              variant="soft"
              disabled={loading}
              onClick={() => void fetchOverview()}
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : undefined}
              />
              {t("common.retry")}
            </Button>
          ) : placeholder ? (
            // 按钮位置占好：数据到达时按钮原地出现，卡片不变高
            <Button variant="solid" color="orange" disabled>
              <DatabaseZap size={16} />
              {t("settings.database.maintenance_button")}
            </Button>
          ) : overview ? (
            <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
              <Dialog.Trigger>
                <Button
                  variant="solid"
                  color="orange"
                  disabled={actionDisabled}
                >
                  <DatabaseZap size={16} />
                  {maintaining
                    ? t("settings.database.maintaining")
                    : t("settings.database.maintenance_button")}
                </Button>
              </Dialog.Trigger>
              <Dialog.Content maxWidth="520px">
                <Dialog.Title>
                  {t("settings.database.confirm_title")}
                </Dialog.Title>
                <Dialog.Description size="2">
                  {t("settings.database.confirm_description")}
                </Dialog.Description>

                <Flex direction="column" mt="4">
                  <MaintenanceActionRow
                    label={t("settings.database.main")}
                    info={overview.main}
                  />
                  <MaintenanceActionRow
                    label={t("settings.database.monitoring")}
                    info={overview.monitoring}
                  />
                </Flex>

                <Flex gap="2" mt="5" justify="end">
                  <Dialog.Close>
                    <Button variant="soft" color="gray">
                      {t("common.cancel")}
                    </Button>
                  </Dialog.Close>
                  <Button
                    variant="solid"
                    color="orange"
                    onClick={() => void handleMaintenance()}
                  >
                    <DatabaseZap size={16} />
                    {t("settings.database.maintenance_button")}
                  </Button>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          ) : null}
          </Skeletonize>
        </Flex>
      </Flex>
      </AutoHeight>
    </SettingCard>
  );
}
