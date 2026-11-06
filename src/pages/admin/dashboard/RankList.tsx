import type React from "react";
import { Flex, IconButton, Popover, Text } from "@radix-ui/themes";
import { ChartNoAxesCombined, List } from "lucide-react";
import { skeletonText } from "@/components/ui/skeleton";
import type { MetricTags } from "@/types/metrics";
import { MiniMetricChart } from "./MiniMetricChart";

/** 排行的占位行：名称 + 数值 / 峰值说明 / 进度条，与真实行同结构（静态元素，不参与 AnimatePresence） */
export const PlaceholderRankRow = ({ index }: { index: number }) => (
  <div className="flex flex-col gap-1">
    <Flex justify="between" align="center" gap="2">
      <Text size="2">{skeletonText(12 - (index % 3) * 2)}</Text>
      <Text size="2" weight="bold">{skeletonText(6)}</Text>
    </Flex>
    <Text size="1">{skeletonText(16)}</Text>
    <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--gray-4)" }} />
  </div>
);

/**
 * 排行的一行：「序号. 名称」+ 右侧数值区（数值、迷你图按钮等由 children 提供）。
 * CPU / 内存 / 流量 / 延迟排行的卡片行与「完整列表」弹层行共用。
 */
export const RankEntryRow = ({
  index,
  name,
  title,
  valueGap = "1",
  children,
}: {
  index: number;
  name: React.ReactNode;
  /** 名称被截断时的悬停提示 */
  title?: string;
  valueGap?: "1" | "2";
  children: React.ReactNode;
}) => (
  <Flex justify="between" align="center" gap="2">
    <Text size="2" className="truncate" title={title}>
      <Text size="2" color="gray">
        {index + 1}.
      </Text>{" "}
      {name}
    </Text>
    <Flex align="center" gap={valueGap} className="shrink-0">
      {children}
    </Flex>
  </Flex>
);

export const RankListPopover = ({
  title,
  ariaLabel,
  children,
}: {
  title: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) => (
  <Popover.Root>
    <Popover.Trigger>
      <IconButton size="1" variant="ghost" color="gray" aria-label={ariaLabel}>
        <List size={14} />
      </IconButton>
    </Popover.Trigger>
    <Popover.Content style={{ width: 340 }}>
      <Flex direction="column" gap="2">
        <Text size="2" weight="bold">
          {title}
        </Text>
        <div
          className="overflow-y-auto pr-1"
          style={{ maxHeight: 320 }}
        >
          {children}
        </div>
      </Flex>
    </Popover.Content>
  </Popover.Root>
);

export const MiniChartButton = ({
  uuid,
  metricKeys,
  tags,
  ariaLabel,
}: {
  uuid: string;
  metricKeys: string[];
  tags?: MetricTags;
  ariaLabel?: string;
}) => (
  <Popover.Root>
    <Popover.Trigger>
      <IconButton
        size="1"
        variant="ghost"
        color="gray"
        aria-label={ariaLabel}
      >
        <ChartNoAxesCombined size={14} />
      </IconButton>
    </Popover.Trigger>
    <Popover.Content style={{ width: 440 }}>
      <MiniMetricChart uuid={uuid} metricKeys={metricKeys} tags={tags} />
    </Popover.Content>
  </Popover.Root>
);
