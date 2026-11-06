import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { SettingCard, GapCollapse } from "@/components/admin/SettingCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useRouteQuery } from "@/lib/routeData";
import { metricDefinitionsQuery } from "@/routeQueries/settings";
import { Badge, Button, Callout, Flex, Text, TextField } from "@radix-ui/themes";
import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AutoHeight } from "@/components/motion";
import type { MetricDefinition, MetricRetentionChange } from "./types";
import {
  METRIC_PLACEHOLDER_ROWS,
  toNumber,
  metricDisplayName,
  metricDescription,
} from "./utils";
import { BatchRetentionDialog } from "./BatchRetentionDialog";

export function MetricRetentionTable({
  defaultRetentionDays,
  ready = true,
}: {
  defaultRetentionDays: number;
  ready?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { call } = useRPC2Call();
  // 指标定义已由 routePreload 与设置并行预取；仍等设置到达（ready）再读取，草稿默认值才用得上设置里的保留天数
  const metricsResult = useRouteQuery(ready ? metricDefinitionsQuery : null);
  const fetched = metricsResult.data;
  const [metrics, setMetrics] = React.useState<MetricDefinition[]>(fetched ?? []);
  const draftsFrom = (list: MetricDefinition[]) =>
    Object.fromEntries(
      list.map((metric) => [
        metric.name,
        String(toNumber(metric.retention_days, defaultRetentionDays)),
      ]),
    );
  const [drafts, setDrafts] = React.useState<Record<string, string>>(() =>
    fetched ? draftsFrom(fetched) : {},
  );
  // 每次请求成功（首次 / 刷新）用新结果重置列表和草稿（与原来 fetchMetrics 一致）；保存只改本地状态
  const [syncedFrom, setSyncedFrom] = React.useState(fetched);
  if (fetched !== syncedFrom) {
    setSyncedFrom(fetched);
    if (fetched) {
      setMetrics(fetched);
      setDrafts(draftsFrom(fetched));
    }
  }
  const loading = !ready || metricsResult.loading;
  const loadError = metricsResult.error
    ? metricsResult.error instanceof Error
      ? metricsResult.error.message
      : String(metricsResult.error)
    : null;
  // 每次请求失败提示一次（与原来非静默的 fetchMetrics 一致）
  React.useEffect(() => {
    const error = metricsResult.error;
    if (!error) return;
    const message = error instanceof Error ? error.message : String(error);
    toast.error(t("settings.metrics.fetch_metrics_failed") + ": " + message);
  }, [metricsResult.error, t]);
  const [saving, setSaving] = React.useState(false);
  const language = i18n.resolvedLanguage || i18n.language;

  const saveRetentionChanges = React.useCallback(
    async (changes: MetricRetentionChange[]) => {
      if (changes.length === 0) return true;
      setSaving(true);
      try {
        const results = await Promise.allSettled(
          changes.map((change) =>
            call<MetricRetentionChange, MetricDefinition>(
              "admin:updateMetricDefinition",
              change,
            ),
          ),
        );
        const successful = new Map<string, MetricDefinition>();
        const errors: string[] = [];
        results.forEach((result, index) => {
          const change = changes[index];
          if (result.status === "fulfilled") {
            successful.set(change.name, {
              ...result.value,
              retention_days: toNumber(
                result.value.retention_days,
                change.retention_days,
              ),
            });
          } else {
            errors.push(
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
            );
          }
        });

        if (successful.size > 0) {
          setMetrics((previous) =>
            previous.map((metric) => {
              const updated = successful.get(metric.name);
              return updated ? { ...metric, ...updated } : metric;
            }),
          );
          setDrafts((previous) => {
            const next = { ...previous };
            for (const [name, metric] of successful) {
              next[name] = String(metric.retention_days);
            }
            return next;
          });
        }

        if (errors.length > 0) {
          toast.error(
            `${t("settings.metrics.retention_save_failed")}: ${errors[0]}`,
          );
          return false;
        }
        toast.success(t("settings.metrics.retention_saved"));
        return true;
      } finally {
        setSaving(false);
      }
    },
    [call, t],
  );

  const handleSaveAll = async () => {
    const changes: MetricRetentionChange[] = [];
    const canonicalDrafts: Record<string, string> = {};
    for (const metric of metrics) {
      const value = drafts[metric.name] ?? String(metric.retention_days);
      const days = parseInt(value, 10);
      if (isNaN(days) || days < 0) {
        toast.error(t("settings.metrics.retention_invalid"));
        return;
      }
      canonicalDrafts[metric.name] = String(days);
      if (days !== metric.retention_days) {
        changes.push({ name: metric.name, retention_days: days });
      }
    }
    setDrafts(canonicalDrafts);
    await saveRetentionChanges(changes);
  };

  const applyBatch = async (names: string[], days: number) => {
    setDrafts((previous) => ({
      ...previous,
      ...Object.fromEntries(names.map((name) => [name, String(days)])),
    }));
    return saveRetentionChanges(
      names.map((name) => ({ name, retention_days: days })),
    );
  };

  const hasDraftChanges = metrics.some(
    (metric) =>
      (drafts[metric.name] ?? String(metric.retention_days)) !==
      String(metric.retention_days),
  );

  return (
    <SettingCard
      title={t("settings.metrics.retention_title")}
      description={t("settings.metrics.retention_table_description", {
        days: defaultRetentionDays,
      })}
      direction="column"
      className="km-setting-card"
    >
      {/* 工具栏 → 表格 → 保存按钮之间 block；GapCollapse 默认按 SPACE.block 收回 */}
      <Flex direction="column" gap="4" className="w-full pt-km-group">
        <Flex justify="between" align="center" gap="2" wrap="wrap">
          <BatchRetentionDialog
            metrics={metrics}
            language={language}
            defaultRetentionDays={defaultRetentionDays}
            saving={saving}
            disabled={loading || saving || metrics.length === 0}
            onApply={applyBatch}
          />
          <Button
            variant="ghost"
            size="1"
            disabled={loading || saving}
            onClick={() => void metricsResult.reload()}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {t("common.refresh")}
          </Button>
        </Flex>

        <GapCollapse show={Boolean(loadError)}>
          <Callout.Root color="red" variant="surface">
            <Callout.Icon>
              <AlertTriangle size={16} />
            </Callout.Icon>
            <Callout.Text>{loadError}</Callout.Text>
          </Callout.Root>
        </GapCollapse>

        {/* 占位行 -> 真实行：行数不同，表格高度用弹簧跟过去 */}
        <AutoHeight>
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">
                  {t("settings.metrics.metric_name")}
                </TableHead>
                <TableHead className="min-w-40">
                  {t("settings.metrics.metric_key")}
                </TableHead>
                <TableHead className="min-w-64">
                  {t("common.description")}
                </TableHead>
                <TableHead>{t("common.type")}</TableHead>
                <TableHead>{t("settings.metrics.metric_unit")}</TableHead>
                <TableHead>{t("settings.metrics.retention_days")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.length === 0 && loading ? (
                // 骨架行：与真实行同样的单元格结构，文字由 Skeletonize 画成等宽的条
                Array.from({ length: METRIC_PLACEHOLDER_ROWS }, (_, row) => (
                  <TableRow key={`placeholder-${row}`}>
                    {[14, 18, 30 - (row % 3) * 6, 6, 4].map((chars, cell) => (
                      <TableCell key={cell}>
                        <Skeletonize loading as="span">{skeletonText(chars)}</Skeletonize>
                      </TableCell>
                    ))}
                    <TableCell>
                      <TextField.Root disabled value="" readOnly style={{ width: "7rem" }} />
                    </TableCell>
                  </TableRow>
                ))
              ) : metrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t("settings.metrics.no_metrics")}
                  </TableCell>
                </TableRow>
              ) : (
                metrics.map((metric) => {
                  const description = metricDescription(metric, language, t);
                  return (
                    <TableRow key={metric.name}>
                      <TableCell className="min-w-44 whitespace-normal font-medium">
                        {metricDisplayName(metric, language, t)}
                      </TableCell>
                      <TableCell className="min-w-40">
                        <Text size="1" color="gray">
                          {metric.name}
                        </Text>
                      </TableCell>
                      <TableCell className="min-w-64 max-w-96 whitespace-normal">
                        {description ? (
                          <Text size="2" color="gray">
                            {description}
                          </Text>
                        ) : (
                          <Text size="2" color="gray">
                            {t("common.none")}
                          </Text>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="soft">{metric.type}</Badge>
                      </TableCell>
                      <TableCell>{metric.unit || t("common.none")}</TableCell>
                      <TableCell>
                        <TextField.Root
                          type="number"
                          min="0"
                          value={drafts[metric.name] ?? ""}
                          disabled={saving}
                          onChange={(event) =>
                            setDrafts((previous) => ({
                              ...previous,
                              [metric.name]: event.target.value,
                            }))
                          }
                          style={{ width: "7rem" }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        </AutoHeight>
        <Flex justify="end">
          <Button
            disabled={loading || saving || !hasDraftChanges}
            onClick={() => void handleSaveAll()}
          >
            <Save size={14} />
            {t("settings.metrics.save_changes")}
          </Button>
        </Flex>
      </Flex>
    </SettingCard>
  );
}
