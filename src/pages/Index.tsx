import {
  Callout,
  Card,
  Flex,
  Text,
  Popover,
  IconButton,
  Switch,
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useMemo, Suspense } from "react";
// 代码块与节点列表请求并行加载：模块求值时就开始拉，节点数据到时多半已经就绪
const loadNodeDisplay = () => import("../components/NodeDisplay");
const NodeDisplay = React.lazy(loadNodeDisplay);
void loadNodeDisplay();
import { formatBytes, formatSpeed } from "@/utils/unitHelper";
import { useLiveData } from "../contexts/LiveDataContext";
import { useNodeList } from "@/contexts/NodeListContext";
import Loading from "@/components/loading";
import { Settings } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { LiveData } from "@/types/LiveData";
import { AnimatePresence, motion } from "motion/react";
import {
  CONTENT_MOTION,
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
} from "@/lib/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import { AnimatedNumber, AutoHeight, Collapse } from "@/components/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";



const EMPTY_LIVE_DATA: LiveData = { online: [], data: {} };

const STATUS_CARD_VISIBILITY_DEFAULTS = {
  currentTime: true,
  currentOnline: true,
  regionOverview: true,
  trafficOverview: true,
  networkSpeed: true,
};

type StatusCardKey = keyof typeof STATUS_CARD_VISIBILITY_DEFAULTS;

/** 错误提示收起前的停留时间：轮询每次先清空 error 再请求，避免提示条每 5 秒开合一次 */
const ERROR_LINGER_MS = 1500;

const Index = () => {
  const [t] = useTranslation();
  const { live_data, showCallout } = useLiveData();
  const { nodeList, isLoading, error, refresh } = useNodeList();
  // 节点列表未到：卡片区用占位卡片的骨架；live 未到（且还没判定连接失败）：数值用小骨架
  const listLoading = isLoading && !nodeList;
  const liveLoading = live_data === null && showCallout;
  const statsLoading = listLoading || liveLoading;
  const [shownError, setShownError] = React.useState<string | null>(error);
  if (error && error !== shownError) setShownError(error);
  useEffect(() => {
    if (error || !shownError) return;
    const id = window.setTimeout(() => setShownError(null), ERROR_LINGER_MS);
    return () => window.clearTimeout(id);
  }, [error, shownError]);
  const liveData = live_data?.data ?? EMPTY_LIVE_DATA;
  const onlineSet = useMemo(
    () => new Set(liveData.online),
    [liveData.online],
  );
  const [statusCardsVisibility, setStatusCardsVisibility] = useLocalStorage<
    Record<StatusCardKey, boolean>
  >("statusCardsVisibility", STATUS_CARD_VISIBILITY_DEFAULTS);

  const summaryStats = useMemo(() => {
    const regions = new Set<string>();
    let totalUp = 0;
    let totalDown = 0;
    let speedUp = 0;
    let speedDown = 0;

    for (const node of nodeList ?? []) {
      if (!onlineSet.has(node.uuid)) continue;

      regions.add(node.region);
      const record = liveData.data[node.uuid];
      if (!record) continue;

      totalUp += record.network.totalUp || 0;
      totalDown += record.network.totalDown || 0;
      speedUp += record.network.up || 0;
      speedDown += record.network.down || 0;
    }

    return {
      regionCount: regions.size,
      trafficText: `↑ ${formatBytes(totalUp)} / ↓ ${formatBytes(totalDown)}`,
      speedText: `↑ ${formatSpeed(speedUp)} / ↓ ${formatSpeed(speedDown)}`,
    };
  }, [liveData.data, nodeList, onlineSet]);

  const statusCards = useMemo(
    () => [
      {
        key: "currentTime" as const,
        title: t("current_time"),
        value: <CurrentTimeValue />,
        visible: statusCardsVisibility.currentTime,
      },
      {
        key: "currentOnline" as const,
        title: t("current_online"),
        value: (
          <Skeletonize as="span" loading={statsLoading} className="km-tabular-nums">
            {/* duration 单位是秒（之前写成 350 = 350 秒，数字几乎不动） */}
            {statsLoading ? (
              skeletonText(5)
            ) : (
              <>
                <AnimatedNumber value={onlineSet.size} duration={MOTION_DURATION.slower} /> /{" "}
                {nodeList?.length ?? 0}
              </>
            )}
          </Skeletonize>
        ),
        visible: statusCardsVisibility.currentOnline,
      },
      {
        key: "regionOverview" as const,
        title: t("region_overview"),
        value: (
          <Skeletonize as="span" loading={statsLoading} className="km-tabular-nums">
            {statsLoading ? (
              skeletonText(2)
            ) : (
              <AnimatedNumber value={summaryStats.regionCount} duration={MOTION_DURATION.slower} />
            )}
          </Skeletonize>
        ),
        visible: statusCardsVisibility.regionOverview,
      },
      {
        key: "trafficOverview" as const,
        title: t("traffic_overview"),
        value: (
          <Skeletonize as="span" loading={statsLoading}>
            {statsLoading ? skeletonText(16) : summaryStats.trafficText}
          </Skeletonize>
        ),
        visible: statusCardsVisibility.trafficOverview,
      },
      {
        key: "networkSpeed" as const,
        title: t("network_speed"),
        value: (
          <Skeletonize as="span" loading={statsLoading}>
            {statsLoading ? skeletonText(18) : summaryStats.speedText}
          </Skeletonize>
        ),
        visible: statusCardsVisibility.networkSpeed,
      },
    ],
    [nodeList?.length, onlineSet.size, statsLoading, statusCardsVisibility, summaryStats, t],
  );

  const visibleStatusCards = useMemo(
    () => statusCards.filter((card) => card.visible),
    [statusCards],
  );

  const updateStatusCardVisibility = useCallback(
    (key: StatusCardKey, checked: boolean) => {
      setStatusCardsVisibility((current) => ({
        ...current,
        [key]: checked,
      }));
    },
    [setStatusCardsVisibility],
  );

  useEffect(() => {
    let interval: number | undefined;
    const stopPolling = () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };
    const startPolling = () => {
      if (interval === undefined && !document.hidden) {
        interval = window.setInterval(refresh, 5000);
      }
    };
    const handleVisibilityChange = () => {
      stopPolling();
      if (!document.hidden) {
        refresh();
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startPolling();
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  /*
    不再整页 early return：统计卡片与节点区照常渲染真实布局，缺数据的部分用 Skeletonize 画成骨架，
    数据到达时在同一批 DOM 上淡入，不重挂载、不跳高度。
  */
  return (
    <>
      <Callouts />
      {/*
        首页区块之间统一 section：提示条各自带 mb（收起时随高度一起收走），后面的区块用 mt。
        左右边距由 _layout 的 main 提供，区块自身不再加 mx。
      */}
      <Card className="km-page-index km-summary-card summary-card md:text-base text-sm relative">
        {/* z-index：设置按钮必须浮在状态卡片之上，否则会被卡片内容拦截点击 */}
        <div className="km-summary-card-settings absolute top-2 right-2 z-10">
          <Popover.Root>
            <Popover.Trigger>
              <IconButton
                variant="ghost"
                size="1"
                title={t("status_settings", "Status Settings")}
                aria-label={t("status_settings", "Status Settings")}
              >
                <Settings size={16} />
              </IconButton>
            </Popover.Trigger>
            <Popover.Content width="300px">
              <Flex direction="column" gap="4">
                <Text size="2" weight="bold">
                  {t("status_settings")}
                </Text>
                <Flex direction="column" gap="2">
                  {statusCards.map((card) => (
                    <StatusSettingSwitch
                      key={card.key}
                      label={card.title}
                      checked={card.visible}
                      onCheckedChange={(checked) =>
                        updateStatusCardVisibility(card.key, checked)
                      }
                    />
                  ))}
                </Flex>
              </Flex>
            </Popover.Content>
          </Popover.Root>
        </div>

        {/*
          网格容器不开 layout（无可见背景，尺寸补间只会让子卡片被缩放矫正）；
          relative 作为 popLayout 退场卡片的定位参照。
        */}
        {/* 显隐某张状态卡导致行数变化时，卡片外框高度弹簧过渡（只在动画期间裁切） */}
        <AutoHeight threshold={4}>
        <div
          className="km-summary-card-grid relative z-0 grid gap-x-km-block gap-y-km-group"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(230px, 1fr))`,
            gridAutoRows: "min-content",
          }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {visibleStatusCards.map((card, index) => (
              <TopCard
                key={card.key}
                title={card.title}
                value={card.value}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>
        </AutoHeight>
      </Card>
      {/* 拉取节点失败：提示条展开在列表上方（停留一会儿再收起，轮询重试不会让它反复开合） */}
      <Collapse open={!!shownError} aria-hidden={!shownError}>
        <Callout.Root color="red" mt="5" className="km-callout km-callout-nodes-error">
          <Callout.Text>Error: {shownError ?? error}</Callout.Text>
        </Callout.Root>
      </Collapse>
      {/* 代码块未到时的占位与节点区骨架同形（卡片网格），且不触发整页 reveal */}
      <Suspense
        fallback={
          // 加载卡片铺满宽度，与节点区同一位置（上方 section）
          <div className="mt-km-section">
            <Loading reveal={false} />
          </div>
        }
      >
        <NodeDisplay
          nodes={nodeList ?? []}
          liveData={liveData}
          loading={listLoading}
          liveLoading={liveLoading}
        />
      </Suspense>
    </>
  );
};

//#region Callouts
/**
 * 单条提示条（surface 层）：常驻挂载，用 animate 在展开/收起两个姿态间切换。
 * 连接状态来回抖动时，高度弹簧会带着当前速度掉头，而不是卸载重挂再从 0 播一遍。
 * 收起时 inert，避免不可见的提示仍可被聚焦/朗读。
 */
const CalloutBanner = ({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) => (
  <Collapse
    open={show}
    aria-hidden={!show}
    {...({ inert: !show } as object)}
  >
    {children}
  </Collapse>
);

const Callouts = () => {
  const [t] = useTranslation();
  const { showCallout } = useLiveData();
  const ishttps = window.location.protocol === "https:";
  return (
    // 容器不开 layout：子项自己做高度弹簧，再叠一层尺寸补间会把提示文字拉伸
    <div className="km-callouts flex flex-col">
      <CalloutBanner show={!ishttps}>
        <Callout.Root
          mb="5"
          color="red"
          className="km-callout km-callout-https"
        >
          <Callout.Icon>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M10.03 3.659c.856-1.548 3.081-1.548 3.937 0l7.746 14.001c.83 1.5-.255 3.34-1.969 3.34H4.254c-1.715 0-2.8-1.84-1.97-3.34zM12.997 17A.999.999 0 1 0 11 17a.999.999 0 0 0 1.997 0m-.259-7.853a.75.75 0 0 0-1.493.103l.004 4.501l.007.102a.75.75 0 0 0 1.493-.103l-.004-4.502z"
              />
            </svg>
          </Callout.Icon>
          <Callout.Text>
            <Text size="2" weight="medium">
              {t("warn_https")}
            </Text>
          </Callout.Text>
        </Callout.Root>
      </CalloutBanner>
      <CalloutBanner show={!showCallout}>
        <Callout.Root
          mb="5"
          id="callout"
          color="tomato"
          className="km-callout km-callout-websocket"
        >
          <Callout.Icon>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M21.707 3.707a1 1 0 0 0-1.414-1.414L18.496 4.09a4.25 4.25 0 0 0-5.251.604l-1.068 1.069a1.75 1.75 0 0 0 0 2.474l3.585 3.586a1.75 1.75 0 0 0 2.475 0l1.068-1.068a4.25 4.25 0 0 0 .605-5.25zm-11 8a1 1 0 0 0-1.414-1.414l-1.47 1.47l-.293-.293a.75.75 0 0 0-1.06 0l-1.775 1.775a4.25 4.25 0 0 0-.605 5.25l-1.797 1.798a1 1 0 1 0 1.414 1.414l1.798-1.797a4.25 4.25 0 0 0 5.25-.605l1.775-1.775a.75.75 0 0 0 0-1.06l-.293-.293l1.47-1.47a1 1 0 0 0-1.414-1.414l-1.47 1.47l-1.586-1.586z"
              />
            </svg>
          </Callout.Icon>
          <Callout.Text>
            <Text size="2" weight="medium">
              {t("warn_websocket")}
            </Text>
          </Callout.Text>
        </Callout.Root>
      </CalloutBanner>
    </div>
  );
};
// #endregion Callouts
export default Index;

type TopCardProps = {
  title: string;
  value: React.ReactNode;
  description?: string;
  /** 用于错峰进场（Follow-through：先到的主卡，后到的副卡） */
  index?: number;
  /** React 19：memo 组件以 prop 接收 ref，AnimatePresence popLayout 靠它测量退场卡片 */
  ref?: React.Ref<HTMLDivElement>;
};

const TopCard: React.FC<TopCardProps> = React.memo(
  ({ title, value, description, index = 0, ref }) => {
    const reduced = useKmReducedMotion();
    // 错峰只取挂载时的序号；之后其它卡片显隐导致序号变化，不会改动已入场卡片的过渡
    const [delay] = React.useState(() =>
      reduced ? 0 : Math.min(index * 0.045, 0.18),
    );
    return (
      <motion.div
        ref={ref}
        // content 层：显隐某张状态卡时，其余卡片只补间位置（文字不被拉伸）
        layout="position"
        className="km-top-card min-w-52 md:max-w-72 w-full"
        // global.css 给 .km-top-card 配了 transform 的 CSS 过渡，会和 motion 每帧写入的
        // transform 互相拖拽；这里只保留颜色/阴影过渡
        style={{ transitionProperty: "color, background-color, border-color, box-shadow" }}
        initial={reduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={
          reduced
            ? { opacity: 0, transition: CONTENT_MOTION.exitTransition }
            : { opacity: 0, scale: 0.96, transition: CONTENT_MOTION.exitTransition }
        }
        transition={{
          layout: MOTION_SPRING.layout,
          y: { ...MOTION_SPRING.layout, delay },
          opacity: {
            duration: MOTION_DURATION.base,
            ease: MOTION_EASE.out,
            delay,
          },
        }}
      >
        <Flex direction="column" gap="1">
          <label className="text-muted-foreground text-sm">{title}</label>
          <label className="font-medium text-md">{value}</label>
          {description && (
            <Text size="2" color="gray">
              {description}
            </Text>
          )}
        </Flex>
      </motion.div>
    );
  },
);

const CurrentTimeValue = React.memo(() => {
  const [currentTime, setCurrentTime] = React.useState(() =>
    new Date().toLocaleTimeString(),
  );

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <>{currentTime}</>;
});

type StatusSettingSwitchProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const StatusSettingSwitch: React.FC<StatusSettingSwitchProps> = React.memo(
  ({ label, checked, onCheckedChange }) => {
    return (
      <Flex justify="between" align="center">
        <Text size="2">{label}</Text>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </Flex>
    );
  },
);