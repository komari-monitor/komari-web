import {
  SettingCardLabel,
  SettingCardShortTextInput,
  SettingCardsLoading,
  GapCollapse,
} from "@/components/admin/SettingCard";
import { DatabaseMaintenanceCard } from "@/components/admin/DatabaseMaintenanceCard";
import { updateSettingsWithToast, type SettingsResponse } from "@/lib/api";
import { Callout, Flex, Text } from "@radix-ui/themes";
import { AlertTriangle } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StaggeredItem, StaggeredList } from "@/components/motion";
import { useRouteQuery } from "@/lib/routeData";
import {
  DEFAULT_SETTINGS,
  invalidateSettingsQueries,
  settingsErrorText,
  settingsQuery,
} from "@/routeQueries/settings";
import { SAFE_RAW_RETENTION_DAYS, DSN_PLACEHOLDER, toNumber } from "./metrics/utils";
import { MetricRollupRetentionCard } from "./metrics/MetricRollupRetentionCard";
import { MetricRetentionTable } from "./metrics/MetricRetentionTable";
import { MigrationCard } from "./metrics/MigrationCard";

export default function MetricsSettings() {
  const { t } = useTranslation();
  // 页面切换时设置、指标定义、迁移状态都已由 routePreload 提前请求；等待预算内到达直接显示，否则设置卡显示色块
  const settingsResult = useRouteQuery(settingsQuery);
  const settings = settingsResult.data ?? DEFAULT_SETTINGS;
  const loading = settingsResult.loading;
  const setSettings = settingsResult.setData;
  // 与原来 useSettings 一致：保存失败也会把错误写进页面的 error（整页换成错误文字）
  const [updateError, setUpdateError] = React.useState<string | null>(null);
  const error = settingsErrorText(settingsResult.error) ?? updateError;
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const saveMetricSettings = React.useCallback(
    async (changes: Partial<SettingsResponse>) => {
      // 原来 updateMultipleSettings 提交的是合并后的完整设置
      const updatedSettings = { ...settings, ...changes };
      // updateSettingsWithToast 的成功/失败 toast 与原来这里的文案相同；
      // 需要重启（跳转迁移引导）时它不提示成功，借此判断是否重启
      let saved = false;
      try {
        await updateSettingsWithToast(updatedSettings, (key) => {
          if (key === "settings.settings_saved") saved = true;
          return t(key);
        });
      } catch (e) {
        setUpdateError(e instanceof Error ? e.message : "Failed to update settings");
        setSaveError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        invalidateSettingsQueries();
      }
      if (!saved) return;
      setSettings(updatedSettings);
      setSaveError(null);
    },
    [settings, setSettings, t],
  );

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    // 加载中渲染真实卡片（默认值），每张设置卡画成同尺寸的色块；数据到达后原地淡入
    // 与 settings/_layout 内层同为 block 档；GapCollapse 默认收回的也是 SPACE.block
    <Flex direction="column" gap="4" className="km-page-admin-settings-metrics">
    <SettingCardsLoading loading={loading}>
      <SettingCardLabel>{t("settings.metrics.title")}</SettingCardLabel>
      <DatabaseMaintenanceCard />

      {/*<Callout.Root color="blue" variant="surface">
        <Callout.Icon>
          <Info size={16} />
        </Callout.Icon>
        <Callout.Text>{t("settings.metrics.intro")}</Callout.Text>
      </Callout.Root>*/}

      {/* feedback 性格：保存失败才出现的提示，高度展开推开下方卡片，不硬切 */}
      <GapCollapse show={Boolean(saveError)}>
          <Callout.Root color="red" variant="surface">
            <Callout.Icon>
              <AlertTriangle size={16} />
            </Callout.Icon>
            <Callout.Text>{saveError}</Callout.Text>
          </Callout.Root>
      </GapCollapse>

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

      <MetricRollupRetentionCard
        settings={settings}
        onSave={saveMetricSettings}
      />

      <MetricRetentionTable
        // 设置到达前不请求：保留天数默认值来自设置，提前请求会在设置到达后再请求一次
        ready={!loading}
        defaultRetentionDays={toNumber(
          settings.metric_retention_days,
          SAFE_RAW_RETENTION_DAYS,
        )}
      />

      {/*
        content 性格：「高级」这一组只有 3 张卡、首屏即可见，
        用带固定上限的错峰进场，避免长表单末尾排队出现。
      */}
      <StaggeredList className="flex w-full flex-col gap-km-block">
      <StaggeredItem>
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
      </StaggeredItem>

      <StaggeredItem>
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
      </StaggeredItem>

      <StaggeredItem>
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
      </StaggeredItem>
      </StaggeredList>

      {/*<Callout.Root color="green" variant="surface">
        <Callout.Icon>
          <Info size={16} />
        </Callout.Icon>
        <Callout.Text>{t("settings.metrics.restart_hint")}</Callout.Text>
      </Callout.Root>*/}

      <SettingCardLabel>
        {t("settings.metrics.migration_title")}
      </SettingCardLabel>
      <MigrationCard />

    </SettingCardsLoading>
    </Flex>
  );
}
