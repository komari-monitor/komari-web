import { Card, Select, Switch } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Activity, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import Tips from "@/components/ui/tips";
import { useAccount } from "@/contexts/AccountContext";
import { AGGREGATIONS } from "./constants";
import MetricSelect from "./MetricSelect";
import type { Aggregation, MetricCatalogItem } from "./types";

type ChartToolbarProps = {
  aggregation: Aggregation;
  onAggregationChange: (value: Aggregation) => void;
  ewmaEnabled: boolean;
  onEwmaChange: (enabled: boolean) => void;
  savingGlobalTemplate: boolean;
  onSaveGlobalTemplate: () => void;
  onReset: () => void;
  metricOptions: MetricCatalogItem[];
  onAddChart: (metricKey: string) => void;
};

/** 图表工具栏：采样算法、EWMA；右侧保存全局模板（登录后）、重置、新增图表 */
const ChartToolbar = ({
  aggregation,
  onAggregationChange,
  ewmaEnabled,
  onEwmaChange,
  savingGlobalTemplate,
  onSaveGlobalTemplate,
  onReset,
  metricOptions,
  onAddChart,
}: ChartToolbarProps) => {
  const { t } = useTranslation();
  const { account } = useAccount();

  return (
    <Card size="2" className="km-load-chart-controls w-full">
      {/* 左右两组之间、左组内的各控件之间 block；同一控件的标签与输入 group */}
      <div className="flex flex-wrap items-center justify-between gap-x-km-block gap-y-km-group">
        <div className="flex flex-wrap items-center gap-x-km-block gap-y-km-group">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Activity className="size-4 text-muted-foreground" />
            <span>{t("chart.dashboard", "Charts")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              <span>{t("chart.samplingAlgorithm", "Sampling algorithm")}</span>
              <Tips mode="popup" side="top">
                <span
                  className="block max-w-72"
                  dangerouslySetInnerHTML={{
                    __html: t("chart.samplingAlgorithmTips"),
                  }}
                />
              </Tips>
            </div>
            <Select.Root value={aggregation} onValueChange={(value) => onAggregationChange(value as Aggregation)}>
              <Select.Trigger aria-label={t("chart.samplingAlgorithm", "Sampling algorithm")} />
              <Select.Content>
                {AGGREGATIONS.map((item) => (
                  <Select.Item key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={ewmaEnabled} onCheckedChange={onEwmaChange} />
            <span>EWMA</span>
            <Tips mode="popup" side="top">
              <span dangerouslySetInnerHTML={{ __html: t("chart.cutPeak_tips") }} />
            </Tips>
          </label>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          {account?.logged_in && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSaveGlobalTemplate}
              disabled={savingGlobalTemplate}
            >
              <Save className="size-4" />
              {t("chart.saveGlobalTemplate")}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" />
            {t("common.reset", "Reset")}
          </Button>
          <MetricSelect
            options={metricOptions}
            onSelect={onAddChart}
            placeholder={t("chart.addChart", "Add chart")}
            ariaLabel={t("chart.addChart", "Add chart")}
          />
        </div>
      </div>
    </Card>
  );
};

export default ChartToolbar;
