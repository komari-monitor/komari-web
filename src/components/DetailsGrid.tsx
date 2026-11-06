import { useTranslation } from "react-i18next";
import { UpDownStack } from "./UpDownStack";
import {
  useNodeList,
  type NodeBasicInfo,
} from "@/contexts/NodeListContext";
import { useLiveData } from "@/contexts/LiveDataContext";
import { formatBytes, formatUptime } from "@/utils/unitHelper";
import { Flex, Text, Card } from "@radix-ui/themes";
import type { Record as LiveRecord } from "@/types/LiveData";
import { motion } from "motion/react";
import { MOTION_DURATION, MOTION_EASE, MOTION_SPRING } from "@/lib/motion";
import { Skeletonize, skeletonText } from "./ui/skeleton";

type DetailsGridProps = {
  uuid: string;
  /** 字段之间的间距档位（Tailwind gap 后缀），默认 km-block */
  gap?: string;
  box?: boolean;
  /** 铺满父容器宽度（详情页），默认最宽 900px */
  fullWidth?: boolean;
  align?: "start" | "center" | "end";
  node?: NodeBasicInfo;
  liveRecord?: LiveRecord;
};

/**
 * 详情网格：每个字段是一个独立的「小卡片」。
 * 进场时按顺序轻微上浮（content 层错峰，Follow-through），
 * 内容变化时由上层（实例页）负责容器过渡，这里不做布局抖动。
 */
const itemMotion = (index: number) => {
  // 位移与淡入共用同一段错峰延迟：否则位移在不可见时就已走完，只剩淡入，看不出先后层次
  const delay = Math.min(index * 0.025, 0.16);
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      y: { ...MOTION_SPRING.layout, delay },
      opacity: {
        duration: MOTION_DURATION.base,
        ease: MOTION_EASE.out,
        delay,
      },
    },
  };
};

export const DetailsGrid = ({
  uuid,
  gap,
  box,
  fullWidth,
  align,
  node: nodeProp,
  liveRecord,
}: DetailsGridProps) => {
  const { t } = useTranslation();

  const nodeListContext = useNodeList(false);
  const { live_data, showCallout } = useLiveData();
  const node =
    nodeProp ?? nodeListContext?.nodeList?.find((n) => n.uuid === uuid);
  const currentRecord = liveRecord ?? live_data?.data.data[uuid ?? ""];

  const Container: any = box ? Card : "div";
  // 居中排布时右列的字段靠右对齐
  const stackAlign = align === "center" ? "end" : "start";
  /*
    骨架按内容的长相来：字段照常渲染，只把还没到的值换成与真实值等宽的占位，
    节点信息（静态）和实时数据（live）各自独立加载、各自淡入。
  */
  // 「加载中」只看数据源有没有返回过，不看这台机器有没有数据：
  // 离线节点永远没有实时记录、不存在的 uuid 永远没有节点信息，它们应显示 "-" / Unknown，而不是一直挂着骨架。
  const nodeLoading = !node && !!nodeListContext?.isLoading;
  const liveLoading = !currentRecord && live_data === null && showCallout;
  const nodeText = (value: string | undefined | null, chars: number) =>
    value ?? (nodeLoading ? skeletonText(chars) : "Unknown");
  const liveText = (value: () => string, chars: number) =>
    liveLoading ? skeletonText(chars) : value();

  return (
    // 卡片内边距与字段之间都是 block（Card size 2 = --space-4），与图表卡一致
    <Container
      {...(box ? { size: "2" } : {})}
      className={`km-details-grid DetailsGrid ${fullWidth ? "w-full" : "max-w-[900px]"}`}
    >
      <Skeletonize loading={nodeLoading}>
      <div
        className={`flex flex-wrap gap-${gap ?? "km-block"} basis-full justify-center ${
          align === "center" ? "justify-between" : ""
        }`}
      >
        <motion.div
          className="km-details-item md:w-128 flex-[0_0_calc(50%-var(--space-4)/2)]"
          {...itemMotion(0)}
        >
          <UpDownStack
            up="CPU"
            down={node ? `${node.cpu_name} (x${node.cpu_cores})` : skeletonText(22)}
          />
        </motion.div>
        <motion.label
          className={`km-details-item flex flex-wrap gap-2 gap-x-km-page flex-[0_0_calc(50%-var(--space-4)/2)] ${
            align === "center" ? "justify-end" : ""
          }`}
          {...itemMotion(1)}
        >
          <UpDownStack
            up={t("admin.nodeDetail.arch")}
            down={nodeText(node?.arch, 5)}
          />

          <UpDownStack
            up={t("nodeCard.virtualization")}
            align={stackAlign}
            down={nodeText(node?.virtualization, 4)}
          />
        </motion.label>
        <motion.div
          className="km-details-item flex-[0_0_calc(50%-var(--space-4)/2)]"
          {...itemMotion(2)}
        >
          <UpDownStack up="GPU" down={nodeText(node?.gpu_name, 8)} />
        </motion.div>
        <motion.div
          className={`km-details-item flex flex-col gap-0 flex-[0_0_calc(50%-var(--space-4)/2)] ${
            align === "center" ? "items-end text-right" : "items-start"
          }`}
          {...itemMotion(3)}
        >
          <label className="text-base font-bold">{t("nodeCard.os")}</label>
          <label className="text-sm text-muted-foreground -mt-1">
            {nodeText(node?.os, 12)}
          </label>
          <label className="text-xs text-muted-foreground opacity-75">
            {t("nodeCard.kernelVersion")}: {nodeText(node?.kernel_version, 6)}
          </label>
        </motion.div>

        <motion.div
          className="km-details-item md:w-64 w-full flex-[0_0_calc(50%-var(--space-4)/2)]"
          {...itemMotion(4)}
        >
          <Skeletonize loading={liveLoading}>
            <UpDownStack
              up={t("nodeCard.networkSpeed")}
              down={liveText(
                () => ` ↑ ${formatBytes(currentRecord?.network.up || 0)}/s ↓ ${formatBytes(currentRecord?.network.down || 0)}/s`,
                22,
              )}
            />
          </Skeletonize>
        </motion.div>
        <motion.div
          className="km-details-item flex-[0_0_calc(50%-var(--space-4)/2)]"
          {...itemMotion(5)}
        >
          <Skeletonize loading={liveLoading}>
            <UpDownStack
              up={t("nodeCard.totalTraffic")}
              align={stackAlign}
              down={liveText(
                () => `↑ ${formatBytes(currentRecord?.network.totalUp || 0)} ↓ ${formatBytes(currentRecord?.network.totalDown || 0)}`,
                20,
              )}
            />
          </Skeletonize>
        </motion.div>
        <motion.div
          className="km-details-item md:w-70 w-full flex-[0_0_calc(50%-var(--space-4)/2)]"
          {...itemMotion(6)}
        >
          <UpDownStack
            up={t("nodeCard.ram")}
            down={node ? formatBytes(node.mem_total || 0) : skeletonText(7)}
          />
        </motion.div>
        <motion.div
          className="km-details-item flex-[0_0_calc(50%-var(--space-4)/2)]"
          {...itemMotion(7)}
        >
          <UpDownStack
            up={t("nodeCard.swap")}
            align={stackAlign}
            down={node ? formatBytes(node.swap_total || 0) : skeletonText(7)}
          />
        </motion.div>
        <motion.div
          className="km-details-item md:w-64 w-full flex-[0_0_calc(50%-var(--space-4)/2)]"
          {...itemMotion(8)}
        >
          <UpDownStack
            up={t("nodeCard.disk")}
            down={node ? formatBytes(node.disk_total || 0) : skeletonText(7)}
          />
        </motion.div>
        <div className="flex-[0_0_calc(50%-var(--space-4)/2)]" />
        <motion.div
          className="km-details-item flex-[0_0_calc(50%-var(--space-4)/2)]"
          {...itemMotion(9)}
        >
          <Skeletonize loading={liveLoading}>
            <UpDownStack
              up={t("nodeCard.uptime")}
              down={liveText(
                () => (currentRecord?.uptime ? formatUptime(currentRecord.uptime, t) : "-"),
                10,
              )}
            />
          </Skeletonize>
        </motion.div>
        <motion.label
          className={`km-details-item flex flex-wrap gap-2 flex-[0_0_calc(50%-var(--space-4)/2)] ${
            align === "center" ? "justify-end" : ""
          }`}
          {...itemMotion(10)}
        >
          <Flex align={"center"} gap="2">
            <Text size="2" weight="bold" wrap="nowrap">
              {t("nodeCard.last_updated")}
            </Text>
            <Text size="2">
              {node?.updated_at
                ? new Date(
                    currentRecord?.updated_at || node.updated_at,
                  ).toLocaleString()
                : nodeLoading
                  ? skeletonText(18)
                  : "-"}
            </Text>
          </Flex>
        </motion.label>
      </div>
      </Skeletonize>
    </Container>
  );
};
