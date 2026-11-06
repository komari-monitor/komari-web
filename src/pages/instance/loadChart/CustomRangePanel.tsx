import { Select, TextField } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { CalendarDays, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/motion";
import { STACK_COLLAPSE_TRANSITION, STACK_COLLAPSE_VARIANTS } from "./constants";
import { toDateTimeLocalValue } from "./timeRange";
import type { CustomTimeRange } from "./types";

type CustomRangePanelProps = {
  open: boolean;
  draft: CustomTimeRange;
  error: string | null;
  onDraftChange: (patch: Partial<CustomTimeRange>) => void;
  onSelectRecentRange: (days: number) => void;
  onApply: () => void;
};

/** 自定义时间范围：开始 / 结束时间、快捷选择、查询；无效范围时在下方展开错误提示 */
const CustomRangePanel = ({
  open,
  draft,
  error,
  onDraftChange,
  onSelectRecentRange,
  onApply,
}: CustomRangePanelProps) => {
  const { t } = useTranslation();
  const customInputMax = toDateTimeLocalValue(new Date());

  return (
    <Collapse
      open={open}
      variants={STACK_COLLAPSE_VARIANTS}
      transition={STACK_COLLAPSE_TRANSITION}
      className="w-full"
    >
      <div className="w-full">
        <div className="flex flex-col gap-km-block border-y border-accent-5 py-km-block sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex items-center gap-2 text-sm font-medium sm:self-center">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span>{t("chart.customRange")}</span>
          </div>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:min-w-56">
            <span>{t("chart.startTime")}</span>
            <TextField.Root
              type="datetime-local"
              value={draft.start}
              max={customInputMax}
              onChange={(event) => onDraftChange({ start: event.target.value })}
              aria-label={t("chart.startTime")}
            />
          </label>
          <span className="hidden pb-2 text-muted-foreground sm:block">-</span>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:min-w-56">
            <span>{t("chart.endTime")}</span>
            <TextField.Root
              type="datetime-local"
              value={draft.end}
              max={customInputMax}
              onChange={(event) => onDraftChange({ end: event.target.value })}
              aria-label={t("chart.endTime")}
            />
          </label>
          <Select.Root
            value=""
            onValueChange={(value) => onSelectRecentRange(Number(value))}
          >
            <Select.Trigger
              placeholder={t("chart.quickRange")}
              aria-label={t("chart.quickRange")}
            />
            <Select.Content>
              <Select.Item value="1">{t("chart.recentDay")}</Select.Item>
              <Select.Item value="7">{t("chart.recentWeek")}</Select.Item>
              <Select.Item value="15">
                {t("chart.recentDays", { count: 15 })}
              </Select.Item>
              <Select.Item value="30">
                {t("chart.recentDays", { count: 30 })}
              </Select.Item>
            </Select.Content>
          </Select.Root>
          <Button type="button" size="sm" onClick={onApply}>
            <Search className="size-4" />
            {t("chart.query")}
          </Button>
        </div>
        <Collapse open={!!error}>
          <div className="pt-2 text-sm text-red-500">{error}</div>
        </Collapse>
      </div>
    </Collapse>
  );
};

export default CustomRangePanel;
