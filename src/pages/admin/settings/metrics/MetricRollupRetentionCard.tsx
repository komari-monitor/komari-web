import { SettingCard } from "@/components/admin/SettingCard";
import type { SettingsResponse } from "@/lib/api";
import { Button, Flex, Text, TextField } from "@radix-ui/themes";
import { Save, Timer } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  DEFAULT_ROLLUP_RETENTION,
  ROLLUP_RETENTION_KEYS,
  toNumber,
  parseInteger,
} from "./utils";

export function MetricRollupRetentionCard({
  settings,
  onSave,
}: {
  settings: SettingsResponse;
  onSave: (changes: Partial<SettingsResponse>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState({
    minute: String(
      toNumber(
        settings[ROLLUP_RETENTION_KEYS.minute],
        DEFAULT_ROLLUP_RETENTION.minute,
      ),
    ),
    fiveMinute: String(
      toNumber(
        settings[ROLLUP_RETENTION_KEYS.fiveMinute],
        DEFAULT_ROLLUP_RETENTION.fiveMinute,
      ),
    ),
    hour: String(
      toNumber(
        settings[ROLLUP_RETENTION_KEYS.hour],
        DEFAULT_ROLLUP_RETENTION.hour,
      ),
    ),
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft({
      minute: String(
        toNumber(
          settings[ROLLUP_RETENTION_KEYS.minute],
          DEFAULT_ROLLUP_RETENTION.minute,
        ),
      ),
      fiveMinute: String(
        toNumber(
          settings[ROLLUP_RETENTION_KEYS.fiveMinute],
          DEFAULT_ROLLUP_RETENTION.fiveMinute,
        ),
      ),
      hour: String(
        toNumber(
          settings[ROLLUP_RETENTION_KEYS.hour],
          DEFAULT_ROLLUP_RETENTION.hour,
        ),
      ),
    });
  }, [settings]);

  const current = {
    minute: toNumber(
      settings[ROLLUP_RETENTION_KEYS.minute],
      DEFAULT_ROLLUP_RETENTION.minute,
    ),
    fiveMinute: toNumber(
      settings[ROLLUP_RETENTION_KEYS.fiveMinute],
      DEFAULT_ROLLUP_RETENTION.fiveMinute,
    ),
    hour: toNumber(
      settings[ROLLUP_RETENTION_KEYS.hour],
      DEFAULT_ROLLUP_RETENTION.hour,
    ),
  };

  const hasChanges =
    draft.minute !== String(current.minute) ||
    draft.fiveMinute !== String(current.fiveMinute) ||
    draft.hour !== String(current.hour);

  const updateDraft = (key: keyof typeof draft, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const handleSave = async () => {
    const minute = parseInteger(draft.minute);
    const fiveMinute = parseInteger(draft.fiveMinute);
    const hour = parseInteger(draft.hour);
    if (minute === undefined || fiveMinute === undefined || hour === undefined) {
      toast.error(t("settings.metrics.rollup_retention_invalid"));
      return;
    }
    if (minute > fiveMinute || fiveMinute > hour * 60) {
      toast.error(t("settings.metrics.rollup_retention_order_invalid"));
      return;
    }

    setSaving(true);
    try {
      await onSave({
        [ROLLUP_RETENTION_KEYS.minute]: minute,
        [ROLLUP_RETENTION_KEYS.fiveMinute]: fiveMinute,
        [ROLLUP_RETENTION_KEYS.hour]: hour,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingCard
      title={
        <Flex align="center" gap="2">
          <Timer size={16} />
          {t("settings.metrics.rollup_retention_title")}
        </Flex>
      }
      description={t("settings.metrics.rollup_retention_description")}
      direction="column"
      className="km-setting-card"
    >
      {/* 卡片内：标题 → 内容 group（与 SettingCard 输入卡一致），字段之间 / 字段与按钮之间 block */}
      <Flex direction="column" gap="4" className="w-full pt-km-group">
        <Flex gap="4" wrap="wrap">
          <RollupRetentionInput
            label={t("settings.metrics.rollup_minute_label")}
            unit={t("settings.metrics.minutes_unit")}
            value={draft.minute}
            disabled={saving}
            onChange={(value) => updateDraft("minute", value)}
          />
          <RollupRetentionInput
            label={t("settings.metrics.rollup_five_minute_label")}
            unit={t("settings.metrics.minutes_unit")}
            value={draft.fiveMinute}
            disabled={saving}
            onChange={(value) => updateDraft("fiveMinute", value)}
          />
          <RollupRetentionInput
            label={t("settings.metrics.rollup_hour_label")}
            unit={t("settings.metrics.hours_unit")}
            value={draft.hour}
            disabled={saving}
            onChange={(value) => updateDraft("hour", value)}
          />
        </Flex>
        <Flex justify="end">
          <Button disabled={saving || !hasChanges} onClick={() => void handleSave()}>
            <Save size={14} />
            {t("settings.metrics.rollup_retention_save")}
          </Button>
        </Flex>
      </Flex>
    </SettingCard>
  );
}

function RollupRetentionInput({
  label,
  unit,
  value,
  disabled,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Flex direction="column" gap="2" style={{ minWidth: "12rem" }}>
      <Text size="2" weight="medium">
        {label}
      </Text>
      <TextField.Root
        type="number"
        min="1"
        step="1"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <TextField.Slot side="right">{unit}</TextField.Slot>
      </TextField.Root>
    </Flex>
  );
}
