import React from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import {
  Card,
  Flex,
  Text,
  Badge,
  Separator,
  IconButton,
} from "@radix-ui/themes";
import type { LiveData, Record } from "../types/LiveData";
import UsageBar from "./UsageBar";
import Flag from "./Flag";
import { useTranslation } from "react-i18next";
import Tips from "./ui/tips";

import { formatBytes, formatUptime } from "@/utils/unitHelper";
import { compareNodesByStatus, EMPTY_LIVE_RECORD } from "@/utils/nodeOrder";
import { settledLayoutTransition, useOrderSettled } from "@/hooks/useOrderSettled";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import { sharedHeroStyle, useSharedHero } from "@/lib/sharedElement";
import { StatusFeedback } from "@/components/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { useViewTransitionActive } from "@/lib/viewTransitionState";
import { preloadInstancePage } from "./preloadInstancePage";

interface NodeProps {
  basic: NodeBasicInfo;
  live: Record | undefined;
  online: boolean;
  isMobile: boolean;
  showIpTagsInCard: boolean;
  /** live 数据的第一次请求还没回来：数值、状态画成与文字等宽的骨架条（不是 0 或「离线」） */
  liveLoading?: boolean;
  /** 列表首次定序已完成：之前的重排瞬时完成（见 useOrderSettled） */
  orderSettled?: boolean;
  /** 列表中的序号：用于错峰进场（上限 140ms，避免长列表末尾等太久） */
  index?: number;
  /** React 19：memo 组件以 prop 形式接收 ref。AnimatePresence popLayout 需要它来测量退场卡片 */
  ref?: React.Ref<HTMLDivElement>;
}

const Node = React.memo(
  ({ basic, live, online, isMobile, showIpTagsInCard, liveLoading = false, orderSettled = true, index = 0, ref }: NodeProps) => {
  const [t] = useTranslation();
  /*
    进场参数只在挂载时取一次（Staging）：
    - 错峰延迟用挂载时的序号；之后排序变化不会让 animate 的 delay 跟着变。
    - 若挂载发生在共享元素过渡里（详情页 -> 首页回程），卡片直接就位，
      让浏览器把标题补间回来，而不是卡片自己再淡入上浮一次。
  */
  const viewTransitionActive = useViewTransitionActive();
  const [enter] = React.useState(() => ({
    delay: Math.min(index * 0.02, 0.14),
    skip: viewTransitionActive,
  }));
  /*
    进场用 motion value 手动驱动（放在内层）：重排时 React 用 insertBefore 移动卡片节点，
    子树的 ref 会重新挂一遍，motion 把这当作再次挂载、退回 initial 重播进场（卡片下沉 12px 又浮上来）。
    没有 initial 就不会重播。视觉参数与原来一致：错峰延迟、y 12 -> 0、scale 0.98 -> 1、淡入。
  */
  const reduced = useKmReducedMotion();
  const enterOpacity = useMotionValue(enter.skip ? 1 : 0);
  const enterY = useMotionValue(enter.skip || reduced ? 0 : 12);
  const enterScale = useMotionValue(enter.skip || reduced ? 1 : 0.98);
  React.useEffect(() => {
    if (enter.skip) return;
    const controls = [
      animate(enterOpacity, 1, { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard, delay: enter.delay }),
      animate(enterY, 0, { ...MOTION_SPRING.layout, delay: enter.delay }),
      animate(enterScale, 1, { ...MOTION_SPRING.layout, delay: enter.delay }),
    ];
    return () => controls.forEach((control) => control.stop());
  }, [enter, enterOpacity, enterY, enterScale]);
  const { navigate: navigateWithTransition } = useViewTransitionNavigate();
  // 只有被点击的那张卡片会获得共享元素名（浏览器要求名字在文档内唯一）
  const isSharedHero = useSharedHero(basic.uuid);
  const liveData = live || EMPTY_LIVE_RECORD;
  const osImage = React.useMemo(() => getOSImage(basic.os), [basic.os]);
  const osName = React.useMemo(() => getOSName(basic.os), [basic.os]);

  const memoryUsagePercent = basic.mem_total
    ? (liveData.ram.used / basic.mem_total) * 100
    : 0;
  const diskUsagePercent = basic.disk_total
    ? (liveData.disk.used / basic.disk_total) * 100
    : 0;

  const uploadSpeed = formatBytes(liveData.network.up);
  const downloadSpeed = formatBytes(liveData.network.down);
  const totalUpload = formatBytes(liveData.network.totalUp);
  const totalDownload = formatBytes(liveData.network.totalDown);
  // 小骨架：只包住数值本身，标签和布局照常渲染；live 到达时同一批 DOM 上条淡出、数字淡入。
  // 加载中渲染等宽空白（skeletonText），骨架浮现前的 150ms 里也不会露出「0 B」之类的假数值
  const sk = (node: React.ReactNode, chars = 8) => (
    <Skeletonize as="span" loading={liveLoading}>
      {liveLoading ? skeletonText(chars) : node}
    </Skeletonize>
  );
  //const totalTraffic = formatBytes(liveData.network.totalUp + liveData.network.totalDown);
  return (
    <motion.div
      ref={ref}
      /*
        content 层：layout="position" 只补间位置（重排/筛选时邻居顺势补位），
        不补间尺寸——卡片高度随数据变化时不会把文字拉伸。
      */
      layout="position"
      exit={{
        opacity: 0,
        scale: 0.97,
        transition: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.in },
      }}
      transition={{
        // 首次定序（实时状态到达后离线节点移到末尾）瞬时完成，不让卡片横穿网格
        layout: settledLayoutTransition(orderSettled),
        y: MOTION_SPRING.layout,
        scale: MOTION_SPRING.layout,
        opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
      }}
      // Anticipation：悬停先抬起一点（只在真正的鼠标悬停时，触屏点一下不会卡在抬起状态）
      whileHover={{ y: -2, transition: MOTION_SPRING.snappy }}
      onPointerEnter={preloadInstancePage}
      onFocusCapture={preloadInstancePage}
      style={{ width: "100%", margin: "0 auto" }}
      className="km-node-card-motion"
    >
      <motion.div style={{ width: "100%", height: "100%", opacity: enterOpacity, y: enterY, scale: enterScale }}>
      <Card
        style={{ width: "100%", height: "100%", margin: "0 auto" }}
        id={basic.uuid}
        className="km-node-card node-card hover:cursor-pointer hover:shadow-lg hover:bg-accent-2"
      >
          <Flex direction="column" gap="2">
          <Flex justify="between" align="center">
            <Flex justify="start" align="center" style={{ flex: 1, minWidth: 0 }} className="km-node-region">
              <Flag flag={basic.region} />
              <Link
                to={`/instance/${basic.uuid}`}
                style={{ flex: 1, minWidth: 0 }}
                onClick={(event) => {
                  // 共享元素跳转：卡片里的节点名会「飞」到详情页标题的位置
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  navigateWithTransition(`/instance/${basic.uuid}`, {
                    sharedHero: basic.uuid,
                  });
                }}
              >
                <Flex direction="column" style={{ minWidth: 0 }}>
                  <Text
                    className="km-node-name"
                    weight="bold"
                    size={isMobile ? "2" : "4"}
                    truncate
                    as="span"
                    style={{
                      maxWidth: "100%",
                      // 共享元素的快照按盒子尺寸缩放：被 flex 拉满整行时盒子比文字宽很多，
                      // 补间里文字会先缩成一小团。跳转那一刻让盒子贴合文字，与详情页标题同形
                      ...(isSharedHero
                        ? { width: "fit-content", alignSelf: "flex-start" }
                        : null),
                      ...sharedHeroStyle(isSharedHero),
                    }}
                  >
                    {basic.name}
                  </Text>
                  <Text
                    color="gray"
                    hidden={!isMobile}
                    style={{
                      marginTop: "-3px",
                      fontSize: "0.728rem",
                    }}
                    className="text-sm"
                  >
                    {sk(formatUptime(liveData.uptime, t), 8)}
                  </Text>
                  <PriceTags
                    hidden={isMobile}
                    price={basic.price}
                    billing_cycle={basic.billing_cycle}
                    expired_at={basic.expired_at}
                    currency={basic.currency}
                    tags={basic.tags}
                    ip4={showIpTagsInCard ? basic.ipv4 : undefined}
                    ip6={showIpTagsInCard ? basic.ipv6 : undefined}
                  />
                </Flex>
              </Link>
            </Flex>
            <Flex gap="2" align="center" style={{ flex: "none" }} className="km-node-chart">
              {/* feedback 层：节点消息出现/消失时弹一下，不硬切 */}
              <AnimatePresence initial={false}>
                {live?.message && (
                  <motion.span
                    key="message"
                    className="inline-flex"
                    initial={{ opacity: 0, scale: 0.86 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.86, transition: MOTION_TRANSITION.fadeOut }}
                    transition={MOTION_SPRING.pop}
                  >
                    <Tips color="#CE282E">{live.message}</Tips>
                  </motion.span>
                )}
              </AnimatePresence>
              <MiniPingChartFloat
                uuid={basic.uuid}
                hours={24}
                trigger={
                  <IconButton
                    variant="ghost"
                    size="1"
                    title={t("nodeCard.chart", "Chart")}
                    aria-label={t("nodeCard.chart", "Chart")}
                  >
                    <TrendingUp size="14" />
                  </IconButton>
                }
              />
              {/* live 未到时不先显示「离线」再翻成「在线」：灰色徽标 + 骨架文字，到达后弹出真实状态 */}
              <StatusFeedback state={liveLoading ? "loading" : online}>
                <Badge
                  color={liveLoading ? "gray" : online ? "green" : "red"}
                  variant="soft"
                  className="km-node-status"
                >
                  {liveLoading ? (
                    <Skeletonize as="span" loading>
                      {t("nodeCard.online")}
                    </Skeletonize>
                  ) : online ? (
                    t("nodeCard.online")
                  ) : (
                    t("nodeCard.offline")
                  )}
                </Badge>
              </StatusFeedback>
            </Flex>
          </Flex>

          <Separator size="4" />

          <Flex direction="column" gap="2">
            <Flex justify="between" hidden={isMobile}>
              <Text size="2" color="gray">
                OS
              </Text>
              <Flex align="center">
                <img
                  src={osImage}
                  alt={basic.os}
                  className="w-5 h-5 mr-2"
                />
                <Text size="2">
                  {osName} / {basic.arch}
                </Text>
              </Flex>
            </Flex>
            {/*
              每个指标的「名称行 + 进度条 + (x / y) 附注」是一组（inline），指标之间与卡片其它行一致（group）。
              窄屏三个指标横排，彼此之间 block。
            */}
            <Flex className="md:flex-col flex-row md:gap-km-group gap-km-block">
              {/* CPU Usage */}
              <UsageBar label={t("admin.nodeDetail.cpu")} value={liveData.cpu.usage} loading={liveLoading} />

              {/* Memory Usage */}
              <Flex direction="column" gap="1" className="w-full">
                <UsageBar label={t("nodeCard.ram")} value={memoryUsagePercent} loading={liveLoading} />
                <Text className="md:block hidden" size="1" color="gray">
                  ({sk(formatBytes(liveData.ram.used), 4)} / {formatBytes(basic.mem_total)}
                  )
                </Text>
              </Flex>

              {/* Disk Usage */}
              <Flex direction="column" gap="1" className="w-full">
                <UsageBar label={t("nodeCard.disk")} value={diskUsagePercent} loading={liveLoading} />
                <Text size="1" className="md:block hidden" color="gray">
                  ({sk(formatBytes(liveData.disk.used), 4)} /{" "}
                  {formatBytes(basic.disk_total)})
                </Text>
              </Flex>
            </Flex>
            {basic.traffic_limit > 0 ? (
              <Flex justify="between" hidden={isMobile} direction="column" gap="1">
                <UsageBar
                  label={t("nodeCard.totalTraffic")}
                  value={getTrafficPercentage(
                    liveData.network.totalUp,
                    liveData.network.totalDown,
                    basic.traffic_limit,
                    basic.traffic_limit_type ?? "sum",
                  )}
                  max={Infinity}
                  loading={liveLoading}
                />
                <Flex wrap="nowrap" justify="between">
                  <Text size="1" className="md:block hidden" color="gray">
                    {sk(<>↑ {totalUpload} ↓ {totalDownload}</>, 14)}
                  </Text>
                  <Text size="1" className="md:block hidden" color="gray">
                    {basic.traffic_limit_type &&
                      basic.traffic_limit_type.charAt(0).toUpperCase() +
                        basic.traffic_limit_type.slice(1)}
                    ({formatBytes(basic.traffic_limit)})
                  </Text>
                </Flex>
              </Flex>
            ) : (
              <Flex justify="between" hidden={isMobile}>
                <Text size="2" color="gray">
                  {t("nodeCard.totalTraffic")}
                </Text>
                <Text size="2">
                  {sk(<>↑ {totalUpload} ↓ {totalDownload}</>, 14)}
                </Text>
              </Flex>
            )}

            <Flex justify="between" hidden={isMobile}>
              <Text size="2" color="gray" className="flex items-center">
                {t("nodeCard.networkSpeed")}
              </Text>
              <Text size="2">
                {sk(<>↑ {uploadSpeed}/s ↓ {downloadSpeed}/s</>, 14)}
              </Text>
            </Flex>

            <Flex justify="between" gap="2" hidden={!isMobile}>
              <Text size="2">{t("nodeCard.networkSpeed")}</Text>
              <Text size="2">
                {sk(<>↑ {uploadSpeed}/s ↓ {downloadSpeed}/s</>, 14)}
              </Text>
            </Flex>
            <Flex justify="between" gap="2" hidden={!isMobile}>
              <Text size="2">{t("nodeCard.totalTraffic")}</Text>
              <Flex direction="column">
                <Text size="2">
                  {sk(<>↑ {totalUpload} ↓ {totalDownload}</>, 14)}
                </Text>
              </Flex>
            </Flex>
            {basic.traffic_limit > 0 && isMobile && (
              <UsageBar
                label={`${basic.traffic_limit_type && basic.traffic_limit_type.charAt(0).toUpperCase() + basic.traffic_limit_type.slice(1)}(${formatBytes(basic.traffic_limit)})`}
                max={Infinity}
                value={getTrafficPercentage(
                  liveData.network.totalUp,
                  liveData.network.totalDown,
                  basic.traffic_limit,
                  basic.traffic_limit_type ?? "sum",
                )}
                loading={liveLoading}
              />
            )}
            <Flex justify="between" hidden={isMobile}>
              <Text size="2" color="gray">
                {t("nodeCard.uptime")}
              </Text>
              {liveLoading ? (
                <Text size="2">{sk(null, 10)}</Text>
              ) : online ? (
                <Text size="2">{formatUptime(liveData.uptime, t)}</Text>
              ) : (
                <Text size="2" color="gray">
                  -
                </Text>
              )}
            </Flex>
          </Flex>
            <PriceTags
              hidden={!isMobile}
              price={basic.price}
              billing_cycle={basic.billing_cycle}
              expired_at={basic.expired_at}
              currency={basic.currency}
              tags={basic.tags || ""}
            />
          </Flex>
      </Card>
      </motion.div>
    </motion.div>
  );
});

export default Node;

type NodeGridProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  onlineSet: ReadonlySet<string>;
  /** live 数据第一次请求还没回来 */
  liveLoading?: boolean;
};

/**
 * 节点列表还没到时的占位节点：用真实的卡片/表格行组件渲染，外面包 Skeletonize，
 * 骨架的形状就是卡片本身。名字等可变文本用 skeletonText 控制条的长度。
 */
export const createPlaceholderNodes = (count: number): NodeBasicInfo[] =>
  Array.from({ length: count }, (_, index) => ({
    uuid: `km-placeholder-${index}`,
    name: skeletonText(9 + ((index * 5) % 7)),
    cpu_name: "",
    virtualization: "",
    arch: "amd64",
    cpu_cores: 0,
    os: "Linux",
    kernel_version: "",
    gpu_name: "",
    region: "",
    mem_total: 8 * 1024 ** 3,
    swap_total: 0,
    disk_total: 64 * 1024 ** 3,
    version: "",
    weight: index,
    price: 0,
    tags: "",
    billing_cycle: 30,
    currency: "",
    group: "",
    traffic_limit: 0,
    traffic_limit_type: undefined,
    expired_at: "",
    created_at: "",
    updated_at: "",
  }));

import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import PriceTags from "./PriceTags";
import { TrendingUp } from "lucide-react";
import MiniPingChartFloat from "./MiniPingChartFloat";
import { getOSImage, getOSName } from "@/utils";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
export const NodeGrid = ({ nodes, liveData, onlineSet, liveLoading = false }: NodeGridProps) => {
  const { publicInfo, isLoading: publicInfoLoading } = usePublicInfo();
  // 顺序依赖实时状态和「离线节点位置」设置：两者都到了才算定序完成
  const orderSettled = useOrderSettled(!liveLoading && !publicInfoLoading);
  const isMobile = useIsMobile();
  const showIpTagsInCard = Boolean(
    publicInfo?.theme_settings?.showIpTagsInCard,
  );
  const offlineServerPosition =
    publicInfo?.theme_settings?.offlineServerPosition; // "First/Keep/Last"

  // 排序节点：先按权重排序，权重大的靠前，再根据用户设置排序
  const sortedNodes = React.useMemo(
    () => [...nodes].sort((a, b) => compareNodesByStatus(a, b, onlineSet, offlineServerPosition)),
    [nodes, offlineServerPosition, onlineSet],
  );

  return (
    /*
      网格容器本身不开 layout：它没有可见背景，尺寸补间只会给子卡片带来缩放矫正。
      position: relative 让 popLayout 退场的卡片以网格为定位参照，原地淡出。
    */
    <div
      // 同类卡片之间 block；左右边距由 _layout 的 main 提供，网格自身不加 padding
      className="km-node-list gap-km-block"
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/*
        卡片进场用「错峰」：第 1 张先落位，后面的依次跟上（Follow-through）。
        错峰上限 140ms，卡片再多也不会让最后一张等太久（Timing）。
        分组/搜索筛选时：离开的卡片 popLayout 原地淡出，剩下的卡片 layout 补位。
        用 initial 而非 initial={false}：首次渲染与网格/表格切换都要有落位感。
      */}
      <AnimatePresence initial mode="popLayout">
        {sortedNodes.map((node, index) => {
          const isOnline = onlineSet.has(node.uuid);
          const nodeData = liveData.data[node.uuid];

          return (
            <Node
              key={node.uuid}
              basic={node}
              live={nodeData}
              online={isOnline}
              isMobile={isMobile}
              showIpTagsInCard={showIpTagsInCard}
              liveLoading={liveLoading}
              orderSettled={orderSettled}
              index={index}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};

function getTrafficPercentage(
  totalUp: number,
  totalDown: number,
  limit: number,
  type: "max" | "min" | "sum" | "up" | "down",
) {
  if (limit === 0) return 0;
  switch (type) {
    case "max":
      return (Math.max(totalUp, totalDown) / limit) * 100;
    case "min":
      return (Math.min(totalUp, totalDown) / limit) * 100;
    case "sum":
      return ((totalUp + totalDown) / limit) * 100;
    case "up":
      return (totalUp / limit) * 100;
    case "down":
      return (totalDown / limit) * 100;
    default:
      return 0;
  }
}