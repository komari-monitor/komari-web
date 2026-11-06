import { useCallback, useEffect, useLayoutEffect, useState, useMemo } from "react";
import { compareNodesByStatus } from "@/utils/nodeOrder";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveData } from "../../contexts/LiveDataContext";
import { useTranslation } from "react-i18next";
import type { Record } from "../../types/LiveData";
import Flag from "../../components/Flag";
import { Card, Flex, Text } from "@radix-ui/themes";
import { useNodeList } from "@/contexts/NodeListContext";
import { liveDataToRecords } from "@/utils/RecordHelper";
import LoadChart from "./LoadChart";
import { DetailsGrid } from "@/components/DetailsGrid";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { AccountProvider } from "@/contexts/AccountContext";
import { AnimatePresence, motion } from "motion/react";
import { CONTROL_MOTION, MOTION_SPRING, SURFACE_MOTION } from "@/lib/motion";
import { useSharedHero, sharedHeroStyle } from "@/lib/sharedElement";
import { useViewTransitionActive } from "@/lib/viewTransitionState";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { api } from "@/lib/http";
import { useOrderSettled } from "@/hooks/useOrderSettled";

export default function InstancePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { onRefresh, live_data } = useLiveData();
  const { uuid } = useParams<{ uuid: string }>();
  /*
    recent 记住它属于哪台服务器：切换服务器时不清空旧曲线，
    旧曲线留在原地、由图表的骨架态淡出，新数据到达后再淡入——卡片高度不变，不会「闪一下」。
  */
  const [recentState, setRecentState] = useState<{ uuid: string | null; list: Record[] }>({
    uuid: null,
    list: [],
  });
  const recent = recentState.list;
  const recentLoading = !!uuid && recentState.uuid !== uuid;
  const [chartRealtimeActive, setChartRealtimeActive] = useState(true);
  const { nodeList, isLoading: nodeListLoading } = useNodeList();
  const length = 30 * 5;
  // #region 初始数据加载
  const node = nodeList?.find((n) => n.uuid === uuid);
  const { publicInfo, isLoading: publicInfoLoading } = usePublicInfo();
  // 侧栏顺序依赖实时状态和「离线节点位置」：首次定序前，选中高亮块随重排瞬时就位，不滑过去
  const orderSettled = useOrderSettled(live_data !== null && !publicInfoLoading);
  const isMobile = useIsMobile();
  // 详情页标题与列表卡片的标题共享同一个 view-transition-name
  const isSharedHero = useSharedHero(uuid ?? "");
  /*
    共享元素过渡里挂载时（从卡片/表格点进来），标题由浏览器从旧位置补间过来；
    此时页头不能再自己上浮，否则补间的终点还在移动，落位会「滑一下」。
    只在挂载时取一次，之后切换服务器不会重播。
  */
  const viewTransitionActive = useViewTransitionActive();
  const [enteredViaSharedElement] = useState(viewTransitionActive);
  // 共享元素的落点是页头标题：列表滚到下面时点进来，若保留旧滚动位置，标题会在视口外，
  // 补间就「飞出屏幕」。只在共享元素进入时回到顶部（在浏览器拍新快照之前的 layout 阶段完成）
  useLayoutEffect(() => {
    if (enteredViaSharedElement) window.scrollTo(0, 0);
  }, [enteredViaSharedElement]);
  // 节点列表未到：侧栏先放几行与真实条目同结构的占位，到达后同一个 Skeletonize 里淡入真实条目
  const serverListLoading = !nodeList && nodeListLoading;
  // 节点列表返回了但找不到这台机器（uuid 不存在）：不再挂骨架，标题显示 uuid
  const nodeLoading = !node && nodeListLoading;
  const showServerListInDetails =
    publicInfo?.theme_settings?.showServerListInDetails === true;
  const offlineServerPosition =
    publicInfo?.theme_settings?.offlineServerPosition;
  const onlineSet = useMemo(
    () => new Set(live_data?.data?.online ?? []),
    [live_data?.data?.online],
  );
  const chartRecords = useMemo(
    () => liveDataToRecords(uuid ?? "", recent),
    [uuid, recent],
  );
  const handleChartRealtimeChange = useCallback((active: boolean) => {
    setChartRealtimeActive(active);
  }, []);

  // 组织按分组的服务器列表
  const groupedNodes = useMemo(() => {
    if (!nodeList) return [];

    const sortNodes = (
      a: (typeof nodeList)[number],
      b: (typeof nodeList)[number],
    ) => compareNodesByStatus(a, b, onlineSet, offlineServerPosition);

    const groups = new Map<string | null, typeof nodeList>();

    nodeList.forEach((node) => {
      const groupKey = node.group && node.group.trim() ? node.group : null;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)?.push(node);
    });

    // 转换为数组，其中未分组的排在最后
    const result: Array<{ group: string | null; nodes: typeof nodeList }> = [];

    // 先添加有分组的（按分组名称排序）
    Array.from(groups.entries())
      .filter(([group]) => group !== null)
      .sort(([a], [b]) => (a ?? "").localeCompare(b ?? ""))
      .forEach(([group, nodes]) => {
        result.push({
          group,
          nodes: [...nodes].sort(sortNodes),
        });
      });

    // 再添加未分组的
    const ungrouped = groups.get(null);
    if (ungrouped) {
      result.push({
        group: null,
        nodes: [...ungrouped].sort(sortNodes),
      });
    }

    return result;
  }, [nodeList, onlineSet, offlineServerPosition]);

  useEffect(() => {
    if (!uuid) {
      setRecentState({ uuid: null, list: [] });
      return;
    }

    const controller = new AbortController();

    api
      .get<{ data?: Record[] } | null>(`/api/recent/${uuid}`, {
        signal: controller.signal,
        expectSuccess: false,
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setRecentState({ uuid, list: (data?.data ?? []).slice(-length) });
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Failed to fetch recent data:", err);
          // 失败也要结束加载态，否则骨架会一直挂着
          setRecentState({ uuid, list: [] });
        }
      });

    return () => controller.abort();
  }, [uuid, length]);
  // 动态追加数据
  useEffect(() => {
    const unsubscribe = onRefresh((resp) => {
      if (!uuid || !chartRealtimeActive) return;
      const data = resp.data.data[uuid];
      if (!data) return;

      setRecentState((state) => {
        // 历史还没拉到（或属于上一台服务器）时不追加，避免把新服务器的点接在旧曲线上
        if (state.uuid !== uuid) return state;
        const prev = state.list;
        const newRecord: Record = data;
        // 追加新数据，限制总长度为length（FIFO）
        // 检查是否已存在相同时间戳的记录
        const exists = prev.some(
          (item) => item.updated_at === newRecord.updated_at,
        );
        if (exists) {
          return state; // 如果已存在，不添加新记录
        }

        // 否则，追加新记录
        return { uuid, list: [...prev, newRecord].slice(-length) };
      });
    });

    // 清理订阅
    return unsubscribe;
  }, [chartRealtimeActive, length, onRefresh, uuid]);
  // #region 布局
  return (
    // 页面整体的淡入由 _layout 的路由过渡负责，这里不再叠一层（否则是两次淡入相乘）
    // 左右安全边距与 NavBar 下方的间距由 _layout 的 <main> 统一提供，这里不再加 padding（与首页左边缘对齐）
    <div className="km-page-instance flex flex-row gap-km-section">
      {/*
        侧栏是否显示取决于 /api/public 的主题设置，可能比页面晚到：
        从 0 宽弹簧展开，把主区域平滑推开，而不是突然出现把整页挤到右边。
        首次渲染就已知要显示时（initial={false}）不播放。
      */}
      <AnimatePresence initial={false}>
      {showServerListInDetails && !isMobile && (
        <motion.div
          key="server-list"
          className="km-instance-server-list shrink-0 self-start sticky top-4"
          // 只在展开/收起途中裁切；静止后恢复 visible，卡片阴影不被切掉
          initial={{ width: 0, opacity: 0, overflow: "hidden" }}
          animate={{ width: 300, opacity: 1, transitionEnd: { overflow: "visible" } }}
          exit={{ width: 0, opacity: 0, overflow: "hidden" }}
          transition={{ width: MOTION_SPRING.soft, opacity: SURFACE_MOTION.fade }}
        >
          <div className="w-[300px]">
          <Card
            className="km-instance-server-list-card w-full overflow-hidden shadow-lg"
            style={{ height: "calc(100vh - 2rem)" }}
          >
            <Flex direction="column" gap="0" className="h-full min-h-0">
              <div className="km-instance-server-list-header p-3 border-b border-accent-3">
                <Text size="2" weight="bold">
                  {t("common.serverList")}
                </Text>
              </div>
              {/* layoutScroll：列表可滚动，高亮块在项之间滑动时要扣掉滚动偏移 */}
              <motion.div
                layoutScroll
                className="km-instance-server-list-items flex-1 min-h-0 overflow-y-auto overscroll-contain"
              >
                <Skeletonize loading={serverListLoading}>
                {serverListLoading && (
                  <div aria-hidden="true">
                    <div className="km-instance-server-group px-3 py-1 text-xs font-semibold text-accent-8 bg-accent-2">
                      {skeletonText(4)}
                    </div>
                    {[9, 7, 10, 8, 9, 6].map((chars, index) => (
                      <div
                        key={index}
                        className="km-instance-server-item relative mx-1 my-0.5 px-2 py-0 text-sm rounded-md flex items-center gap-2"
                      >
                        <span className="relative z-10 flex items-center gap-2 min-w-0">
                          <Flag flag="" />
                          <span className="truncate">{skeletonText(chars)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {groupedNodes.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    {(group.group || group.group === null) && (
                      <div className="km-instance-server-group px-3 py-1 text-xs font-semibold text-accent-8 bg-accent-2 sticky top-0">
                        {group.group ?? t("common.ungrouped")}
                      </div>
                    )}
                    <div>
                      {group.nodes.map((node) => (
                        <motion.div
                          key={node.uuid}
                          role="link"
                          tabIndex={0}
                          onClick={() => navigate(`/instance/${node.uuid}`)}
                          className={`km-instance-server-item relative mx-1 my-0.5 px-2 py-0 cursor-pointer text-sm rounded-md flex items-center gap-2 ${
                            node.uuid === uuid
                              ? "text-accent-10 font-bold"
                              : "hover:bg-accent-3"
                          }`}
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.99 }}
                          transition={CONTROL_MOTION.transition}
                        >
                          {node.uuid === uuid && (
                            <motion.span
                              layoutId="km-instance-active-item"
                              aria-hidden
                              className="absolute inset-0 rounded-md"
                              style={{ backgroundColor: "var(--accent-4)" }}
                              transition={orderSettled ? MOTION_SPRING.snappy : { duration: 0 }}
                            />
                          )}
                          <motion.span
                            aria-hidden
                            className="absolute left-0 top-1 bottom-1 w-1 rounded-r"
                            style={{ backgroundColor: "var(--accent-8)" }}
                            initial={false}
                            animate={{
                              scaleY: node.uuid === uuid ? 1 : 0.001,
                              opacity: node.uuid === uuid ? 1 : 0,
                            }}
                            transition={MOTION_SPRING.snappy}
                          />
                          <span className="relative z-10 flex items-center gap-2 min-w-0">
                            <Flag flag={node.region} />
                            <span
                              className={`truncate ${
                                node.uuid === uuid ? "text-accent-10" : ""
                              }`}
                            >
                              {node.name}
                            </span>
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
                </Skeletonize>
              </motion.div>
            </Flex>
          </Card>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      {/*
        主列铺满剩余宽度（与首页同宽）：页头 → 图表区之间 section；
        图表区内部（时间范围 → 工具栏 → 图表网格）是 block，见 LoadChart。
      */}
      <div className="km-instance-main flex min-w-0 flex-1 flex-col h-full gap-km-section">
        {/*
          surface 层：页头只在进入时轻轻落位一次。
          不开 layout：页头里全是文字，数据到达后高度变化若走尺寸补间会把文字拉伸。
        */}
        <motion.div
          className="km-instance-header flex w-full flex-col gap-km-section"
          initial={enteredViaSharedElement ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SURFACE_MOTION.enter.transition}
        >
          {/* 旗帜自带 m-2：去掉它的左外边距，标题左边缘与下方信息卡、图表区对齐 */}
          <h1 className="km-instance-title flex items-center flex-wrap [&_.km-flag]:ml-0">
            <Skeletonize as="span" loading={nodeLoading} className="inline-flex">
              <Flag flag={node?.region ?? ""} />
            </Skeletonize>
            <Text
              size="3"
              weight="bold"
              wrap="nowrap"
              as="span"
              style={sharedHeroStyle(isSharedHero)}
            >
              {/* 节点列表没到时名称是一条与名字等宽的骨架，到达后原地淡入，不先闪 uuid */}
              <Skeletonize as="span" loading={nodeLoading}>
                {node?.name ?? (nodeLoading ? skeletonText(10) : uuid)}
              </Skeletonize>
            </Text>
            <Text
              size="1"
              ml="2"
              className="text-accent-6"
              wrap="nowrap"
            >
              {node?.uuid}
            </Text>
          </h1>
          <DetailsGrid
            box
            fullWidth
            align="center"
            uuid={uuid ?? ""}
            node={node}
            liveRecord={uuid ? live_data?.data.data[uuid] : undefined}
          />
        </motion.div>
        {/*
          图表区块随后到达（Follow-through：标题/详情先、图表后）。
          外层不带 key，切换服务器时图表就地更新数据，不会整块重挂。
        */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            y: { ...MOTION_SPRING.soft, delay: 0.06 },
            opacity: { ...SURFACE_MOTION.fade, delay: 0.06 },
          }}
        >
          <AccountProvider>
            <LoadChart
              data={chartRecords}
              realtimeLoading={recentLoading}
              onRealtimeActiveChange={handleChartRealtimeChange}
            />
          </AccountProvider>
        </motion.div>
      </div>
    </div>
  );
}
