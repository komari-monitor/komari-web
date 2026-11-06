import { Selector } from "@/components/Selector";
import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { ListChecks, Save } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { MetricDefinition } from "./types";
import { metricDisplayName } from "./utils";

/** 批量设置保留天数：选择指标 + 天数，保存成功后关闭 */
export function BatchRetentionDialog({
  metrics,
  language,
  defaultRetentionDays,
  saving,
  disabled,
  onApply,
}: {
  metrics: MetricDefinition[];
  language: string;
  defaultRetentionDays: number;
  saving: boolean;
  disabled: boolean;
  onApply: (names: string[], days: number) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [batchDialogOpen, setBatchDialogOpen] = React.useState(false);
  const [batchMetricNames, setBatchMetricNames] = React.useState<string[]>([]);
  const [batchRetentionDays, setBatchRetentionDays] = React.useState(
    String(defaultRetentionDays),
  );

  const handleBatchSave = async () => {
    if (batchMetricNames.length === 0) {
      toast.error(t("settings.metrics.batch_select_required"));
      return;
    }
    const days = parseInt(batchRetentionDays, 10);
    if (isNaN(days) || days < 0) {
      toast.error(t("settings.metrics.retention_invalid"));
      return;
    }

    const saved = await onApply(batchMetricNames, days);
    if (saved) setBatchDialogOpen(false);
  };

  return (
    <Dialog.Root open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
      <Dialog.Trigger>
        <Button
          variant="soft"
          size="1"
          disabled={disabled}
          onClick={() => {
            setBatchMetricNames([]);
            setBatchRetentionDays(String(defaultRetentionDays));
          }}
        >
          <ListChecks size={14} />
          {t("settings.metrics.batch_edit")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>{t("settings.metrics.batch_title")}</Dialog.Title>
        <Dialog.Description>
          {t("settings.metrics.batch_description")}
        </Dialog.Description>
        <Flex direction="column" gap="4" mt="4">
          <div className="max-h-[50vh] overflow-y-auto pr-1">
            <Selector
              value={batchMetricNames}
              onChange={setBatchMetricNames}
              items={metrics}
              getId={(metric) => metric.name}
              getLabel={(metric) => (
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">
                    {metricDisplayName(metric, language, t)}
                  </Text>
                  <Text size="1" color="gray">
                    {metric.name}
                  </Text>
                </Flex>
              )}
              filterItem={(metric, keyword) => {
                const normalized = keyword.trim().toLowerCase();
                return (
                  metric.name.toLowerCase().includes(normalized) ||
                  metricDisplayName(metric, language, t)
                    .toLowerCase()
                    .includes(normalized)
                );
              }}
              sortItems={(left, right) => left.name.localeCompare(right.name)}
              headerLabel={t("settings.metrics.metric_name")}
              searchPlaceholder={t("settings.metrics.batch_search_placeholder")}
            />
          </div>
          <label>
            <Text as="div" size="2" weight="medium" mb="2">
              {t("settings.metrics.retention_days")}
            </Text>
            <TextField.Root
              type="number"
              min="0"
              value={batchRetentionDays}
              onChange={(event) => setBatchRetentionDays(event.target.value)}
            />
          </label>
        </Flex>
        <Flex justify="end" gap="2" mt="5">
          <Button
            variant="soft"
            color="gray"
            disabled={saving}
            onClick={() => setBatchDialogOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            disabled={saving || batchMetricNames.length === 0}
            onClick={() => void handleBatchSave()}
          >
            <Save size={14} />
            {t("common.save")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
