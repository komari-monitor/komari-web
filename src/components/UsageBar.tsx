import { Box, Flex, Text } from "@radix-ui/themes";
import React from "react";
import { motion } from "motion/react";
import { MOTION_SPRING } from "@/lib/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";

interface UsageBarProps {
  value: number; // Utilization percentage (0–100)
  label: string; // Label for the bar (e.g., "CPU", "Memory", "Disk")
  compact?: boolean; // Whether to show in compact mode (for tables)
  max?: number; // Maximum value for the bar (e.g., total RAM, total disk space)
  /** live 数据还没到：百分比画成与文字等宽的条，进度条停在 0，到达后从 0 弹簧到真实值 */
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

    // 进度条用弹簧缩放：连续刷新时数值变化会「追」着走，而不是每帧硬跳
    const bar = (
      <motion.div
        className="km-usage-bar-fill"
        initial={false}
        animate={{ scaleX: ratio }}
        transition={{ scaleX: { ...MOTION_SPRING.soft, restDelta: 0.0005 } }}
        style={{
          height: "100%",
          width: "100%",
          borderRadius: "inherit",
          transformOrigin: "left center",
          willChange: "transform",
          // global.css 的 .km-usage-bar-track > div 给 transform 配了 CSS 过渡，会和弹簧
          // 每帧写入的 scaleX 叠成「二次缓动」，追不上数值；transform 只交给弹簧，颜色仍走 CSS 过渡
          transition: "background-color var(--km-dur-base) var(--km-ease-standard)",
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