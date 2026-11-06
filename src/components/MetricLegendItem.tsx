import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import PingMetricStatContent from "@/components/PingMetricStatContent";
import Tips from "@/components/ui/tips";
import { cn } from "@/lib/utils";
import type { PingMetricStat } from "@/types/metrics";

type MetricLegendItemProps = {
  label: string;
  color: string;
  hidden: boolean;
  onToggle: () => void;
  /** 延迟任务的统计：有值时名称后带一个详情提示 */
  stat?: PingMetricStat;
  className?: string;
  /** 图例条末尾的附加按钮（详情页的「删除指标」） */
  children?: ReactNode;
};

/**
 * 图表图例条：色块 + 名称（点击切换该曲线显示），延迟任务带统计详情。
 * 详情页图表与迷你延迟图共用。
 */
const MetricLegendItem = ({
  label,
  color,
  hidden,
  onToggle,
  stat,
  className,
  children,
}: MetricLegendItemProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center overflow-hidden rounded-md text-xs",
        className,
        hidden
          ? "bg-accent-2 text-muted-foreground"
          : "bg-accent-3 text-accent-12",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex min-w-0 items-center gap-1 px-2 py-1"
      >
        <span
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: hidden ? "var(--gray-8)" : color }}
        />
        <span className={cn("truncate", hidden && "line-through")}>
          {label}
        </span>
      </button>
      {stat && (
        <Tips
          mode="auto"
          side="top"
          className="shrink-0"
          ariaLabel={`${label} ${t("common.details")}`}
        >
          <PingMetricStatContent stat={stat} t={t} />
        </Tips>
      )}
      {children}
    </div>
  );
};

export default MetricLegendItem;
