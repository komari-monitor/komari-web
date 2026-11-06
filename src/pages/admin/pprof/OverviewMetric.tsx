import type React from "react";
import { Text } from "@radix-ui/themes";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/motion";

/** 指标值：真实数据到达后才挂载 AnimatedNumber（不会从 0 滚到真实值），之前是等宽占位 */
export function MetricValue({
  value,
  format,
  placeholder,
}: {
  value: number;
  format?: (value: number) => string;
  placeholder: boolean;
}) {
  return placeholder ? <>{skeletonText(7)}</> : <AnimatedNumber value={value} format={format} />;
}

/** 一项运行指标：标签直接渲染，加载中只有数值是色块 */
export function OverviewMetric({
  label,
  value,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  loading: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-[var(--gray-a5)] py-3 last:border-b-0">
      <Text as="div" size="1" color="gray">
        {label}
      </Text>
      <Text as="div" size="3" weight="medium" className="break-words">
        <Skeletonize as="span" loading={loading}>
          {value}
        </Skeletonize>
      </Text>
    </div>
  );
}
