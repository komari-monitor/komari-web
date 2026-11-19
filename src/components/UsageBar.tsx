import { Box, Flex, Text } from "@radix-ui/themes";
import React from "react";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";

interface UsageBarProps {
  value: number; // Utilization percentage (0–100)
  label: string; // Label for the bar (e.g., "CPU", "Memory", "Disk")
  compact?: boolean; // Whether to show in compact mode (for tables)
  max?: number; // Maximum value for the bar (e.g., total RAM, total disk space)
  /** live 数据还没到：百分比画成与文字等宽的条，进度条停在 0，到达后平滑过渡到真实值 */
  loading?: boolean;
}

/** 使用率颜色阈值：与全局语义色保持一致 */
const usageColor = (val: number) => {
  if (val >= 80) return "red";
  if (val >= 60) return "orange";
  return "green";
};

const UsageBar = React.memo(
  ({ value, label, compact = false, max = 100, loading = false }: UsageBarProps) => {
    // Ensure value is between 0 and 100
    const clampedValue = loading ? 0 : Math.min(Math.max(value, 0), max);
    const ratio = Math.min(Math.max(clampedValue / 100, 0), 1);
    const barColor = usageColor(clampedValue);

    // 进度条采用纯 CSS transform 过渡（合成器线程执行，不占用主线程 rAF 与常驻 will-change 显存）
    const bar = (
      <div
        className="km-usage-bar-fill"
        style={{
          height: "100%",
          width: "100%",
          borderRadius: "inherit",
          transformOrigin: "left center",
          transform: `scaleX(${ratio})`,
          backgroundColor: `var(--${barColor}-9)`,
        }}
      />
    );

    if (compact) {
      return (
        <Box className="km-usage-bar" style={{ width: "100%" }}>
          <Box
            className="km-usage-bar-track"
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "var(--gray-5)",
              borderRadius: "3px",
              overflow: "hidden",
              marginBottom: "2px",
            }}
          >
            {bar}
          </Box>
          <Skeletonize as="span" loading={loading} className="block">
            <label color="gray" className="text-sm km-tabular-nums">
              {loading ? skeletonText(5) : `${clampedValue.toFixed(1)}%`}
            </label>
          </Skeletonize>
        </Box>
      );
    }

    return (
      <Flex
        direction="column"
        gap="1"
        className="km-usage-bar"
        style={{ width: "100%" }}
      >
        <Flex justify="between" align="center">
          <Text size="2" color="gray">
            {label}
          </Text>
          <Skeletonize as="span" loading={loading}>
            <Text size="2" weight="medium" className="km-tabular-nums">
              {loading ? skeletonText(5) : `${clampedValue.toFixed(1)}%`}
            </Text>
          </Skeletonize>
        </Flex>
        <Box
          className="km-usage-bar-track"
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: "var(--gray-5)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          {bar}
        </Box>
      </Flex>
    );
  },
);

export default UsageBar;
