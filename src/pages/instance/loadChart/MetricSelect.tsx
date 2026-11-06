import { Select } from "@radix-ui/themes";
import type { MetricCatalogItem } from "./types";

type MetricSelectProps = {
  options: MetricCatalogItem[];
  onSelect: (metricKey: string) => void;
  placeholder: string;
  ariaLabel: string;
  triggerClassName?: string;
};

/** 选一个指标（新增图表 / 往图表里加指标）：选中后立即回调，自身不保留选中值 */
const MetricSelect = ({
  options,
  onSelect,
  placeholder,
  ariaLabel,
  triggerClassName,
}: MetricSelectProps) => (
  <Select.Root value="" onValueChange={onSelect}>
    <Select.Trigger
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={triggerClassName}
    />
    <Select.Content>
      {options.map((item) => (
        <Select.Item key={item.key} value={item.key}>
          {item.label}
        </Select.Item>
      ))}
    </Select.Content>
  </Select.Root>
);

export default MetricSelect;
