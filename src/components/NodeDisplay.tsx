import React, { useState, useMemo, useRef, useEffect, Suspense } from "react";
import {
  Flex,
  Text,
  IconButton,
  TextField,
  SegmentedControl,
} from "@radix-ui/themes";
import { Search, Grid3X3, Table2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "../types/LiveData";
import { NodeGrid, createPlaceholderNodes } from "./Node";
const loadNodeTable = () => import("./NodeTable");
const NodeTable = React.lazy(loadNodeTable);
import { isRegionMatch } from "@/utils/regionHelper";
import { AnimatePresence, motion } from "motion/react";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { AutoHeight } from "@/components/motion";
import Loading from "@/components/loading";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import "./NodeDisplay.css";

/** 节点列表还没到时渲染的占位卡片/行数（真实组件 + Skeletonize） */
const PLACEHOLDER_COUNT = 6;
const PLACEHOLDER_NODES = createPlaceholderNodes(PLACEHOLDER_COUNT);
const PLACEHOLDER_ONLINE: ReadonlySet<string> = new Set();
const EMPTY_LIVE: LiveData = { online: [], data: {} };
/** 筛选/视图/加载状态切换后，外层高度跟随弹簧的时间窗（覆盖卡片退场 + 弹簧落定） */
const HEIGHT_FOLLOW_MS = 900;

export type ViewMode = "grid" | "table";

/** 视图模式定义：icon + 值 + 无障碍标签 */
const VIEW_MODES = [
  { value: "grid" as const, icon: Grid3X3, label: "Grid view" },
  { value: "table" as const, icon: Table2, label: "Table view" },
];

interface NodeDisplayProps {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  /** 节点列表还没到：用占位卡片/行渲染真实组件的骨架 */
  loading?: boolean;
  /** live 数据第一次请求还没回来：卡片里的数值用小骨架 */
  liveLoading?: boolean;
}

const NodeDisplay: React.FC<NodeDisplayProps> = ({
  nodes,
  liveData,
  loading = false,
  liveLoading = false,
}) => {
  const [t] = useTranslation();
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    "nodeViewMode",
    "grid",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useLocalStorage<string>(
    "nodeSelectedGroup",
    "all",
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const onlineSet = useMemo(() => new Set(liveData?.online ?? []), [liveData]);

  // 获取所有的分组
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    nodes.forEach((node) => {
      if (node.group && node.group.trim()) {
        groupSet.add(node.group);
      }
    });
    return Array.from(groupSet).sort();
  }, [nodes]);

  // 判断是否显示分组选择器
  const showGroupSelector = groups.length >= 1;

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 按 "/" 键聚焦搜索框
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // 按 Escape 键清空搜索
      if (e.key === "Escape" && searchTerm) {
        setSearchTerm("");
        searchRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchTerm]);

  // 过滤节点
  const filteredNodes = useMemo(() => {
    let result = nodes;

    // 先按分组过滤
    if (selectedGroup !== "all") {
      result = result.filter((node) => node.group === selectedGroup);
    }

    // 再按搜索条件过滤
    if (!searchTerm.trim()) return result;

    const term = searchTerm.toLowerCase().trim();
    return result.filter((node) => {
      // 基本信息搜索
      const basicMatch =
        node.name.toLowerCase().includes(term) ||
        node.os.toLowerCase().includes(term) ||
        node.arch.toLowerCase().includes(term);

      // 地区搜索（支持emoji和地区名称）
      const regionMatch = isRegionMatch(node.region, term);

      // 价格搜索（如果输入数字）
      const priceMatch =
        !isNaN(Number(term)) && node.price.toString().includes(term);

      // 状态搜索
      const isOnline = onlineSet.has(node.uuid);
      const statusMatch =
        ((term === "online" || term === "在线") && isOnline) ||
        ((term === "offline" || term === "离线") && !isOnline);

      return basicMatch || regionMatch || priceMatch || statusMatch;
    });
  }, [nodes, searchTerm, onlineSet, selectedGroup]);

  /*
    舞台高度：只在「换了显示内容」（加载完成、视图切换、筛选、空态）之后的一小段时间里
    让 AutoHeight 跟随，其余时间（表格行展开自带高度弹簧、live 刷新）不干预，
    避免两条高度弹簧互相追赶。在渲染期派生，保证 ResizeObserver 回调时开关已经打开。
  */
  const heightKey = `${loading}|${viewMode}|${selectedGroup}|${searchTerm.trim()}|${filteredNodes.length === 0}`;
  const [heightFollow, setHeightFollow] = useState({ key: heightKey, on: false });
  if (heightFollow.key !== heightKey) {
    setHeightFollow({ key: heightKey, on: true });
  }
  useEffect(() => {
    if (!heightFollow.on) return;
    const id = window.setTimeout(
      () => setHeightFollow((current) => ({ ...current, on: false })),
      HEIGHT_FOLLOW_MS,
    );
    return () => window.clearTimeout(id);
  }, [heightFollow]);

  const stageKey = loading
    ? `skeleton-${viewMode}`
    : filteredNodes.length === 0
      ? searchTerm.trim()
        ? "empty-search"
        : "empty"
      : viewMode;
  const tableFallback = (
    <div>
      <Loading reveal={false} />
    </div>
  );

  return (
    /*
      与上方概览卡之间 section；工具栏（搜索/视图/分组）内部 group；
      工具栏 → 统计行 block；统计行是网格的说明，贴近网格（group）。左右边距由 main 提供。
    */
    <div className="km-node-display w-full mt-km-section">
      {/* 控制栏 */}
      <Flex
        direction={{ initial: "column", sm: "row" }}
        justify="between"
        align={{ initial: "stretch", sm: "center" }}
        gap="2"
        className="control-bar rounded-lg"
      >
        {/* 搜索框 */}
        <Flex
          align="center"
          gap="2"
          className="flex-1 max-w-md relative"
          wrap="nowrap"
        >
          <TextField.Root
            ref={searchRef}
            placeholder={t("search.placeholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-box flex-1 pr-8 min-w-32"
          >
            <TextField.Slot>
              <Search size={16} />
            </TextField.Slot>
          </TextField.Root>
          {/*
            control 层：清除按钮常驻，用 animate 在「有/无」两个姿态之间弹簧切换。
            快速输入又删光时，缩放会从当前速度顺势反向，不会重新挂载闪一下。
          */}
          <motion.div
            initial={false}
            animate={
              searchTerm
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.6 }
            }
            transition={MOTION_SPRING.snappy}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ pointerEvents: searchTerm ? "auto" : "none" }}
            aria-hidden={!searchTerm}
          >
            <IconButton
              tabIndex={searchTerm ? 0 : -1}
              variant="ghost"
              size="1"
              className="h-6 w-6 search-clear-button"
              onClick={() => {
                setSearchTerm("");
                searchRef.current?.focus();
              }}
              title={t("common.clear_search", "Clear search")}
              aria-label={t("common.clear_search", "Clear search")}
            >
              <X size={12} />
            </IconButton>
          </motion.div>
        </Flex>

        {/* 视图模式切换 */}
        <Flex align="center" gap="2">
          <label className="whitespace-nowrap text-md text-muted-foreground">
            {t("view.mode")}
          </label>
          {/*
            分段控件式的视图切换：选中块是**同一个**元素在两个按钮之间滑动
            （共享元素 / layoutId）。用 grid 让指示器与按钮处在同一坐标系，
            这样它从旧位置滑到新位置时是真正的位移补间，而不是淡出再淡入。
          */}
          {/*
            视图切换用 SegmentedControl：它自带「同一个指示块在两个选项之间滑动」的
            共享元素过渡（transform 补间），与下方分组选择器的手感完全一致；
            时长已在 global.css 里统一接到 --km-dur-base / --km-ease-emphasized。
          */}
          <SegmentedControl.Root
            value={viewMode}
            // 预取表格的代码块：真正切过去时多半已经加载好，不用再等骨架
            onPointerEnter={() => void loadNodeTable()}
            onFocus={() => void loadNodeTable()}
            onValueChange={(value) => setViewMode(value as ViewMode)}
            size="1"
            className="km-view-switch"
          >
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <SegmentedControl.Item
                  key={mode.value}
                  value={mode.value}
                  aria-label={mode.label}
                  className="km-view-switch-button"
                >
                  <span className="flex items-center justify-center">
                    <Icon size={16} />
                  </span>
                </SegmentedControl.Item>
              );
            })}
          </SegmentedControl.Root>
        </Flex>
      </Flex>
      {/* 分组选择器 */}
      <AnimatePresence initial={false}>
        {showGroupSelector && (
          <motion.div
            key="group-selector"
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{
              height: MOTION_SPRING.soft,
              opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
              y: MOTION_SPRING.soft,
            }}
            className="overflow-hidden"
          >
            <Flex
              align="center"
              gap="2"
              // pt 放在会收起的容器里面：分组行消失时这段间距随高度一起收走
              className="km-node-group pt-km-group overflow-x-auto"
            >
              <label className="whitespace-nowrap text-md text-muted-foreground">
                {t("common.group")}
              </label>
              <SegmentedControl.Root
                value={selectedGroup}
                onValueChange={setSelectedGroup}
                size="1"
              >
                <SegmentedControl.Item value="all">
                  {t("common.all")}
                </SegmentedControl.Item>
                {groups.map((group) => (
                  <SegmentedControl.Item
                    key={group}
                    value={group}
                    className="km-node-group-name"
                  >
                    {group}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
      {/* 搜索结果统计：数字变化时用等宽过渡，避免文字长度跳动 */}
      <Flex justify="between" align="center" className="km-node-summary mt-km-block mb-km-group">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={searchTerm.trim() ? "search" : selectedGroup}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{
              opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
              y: MOTION_SPRING.snappy,
            }}
            className="min-w-0"
          >
            {/* 节点列表 / live 数据未到：统计文字画成等宽的条，不先显示「共 0 台」 */}
            <Skeletonize as="span" loading={loading || liveLoading}>
            {loading || liveLoading ? (
              <Text size="2" color="gray">{skeletonText(18)}</Text>
            ) : searchTerm.trim() ? (
              <Text size="2" color="gray">
                {t("search.results", {
                  count: filteredNodes.length,
                  total:
                    selectedGroup === "all"
                      ? nodes.length
                      : nodes.filter((n) => n.group === selectedGroup).length,
                })}
              </Text>
            ) : (
              <Text size="2" color="gray">
                {selectedGroup === "all"
                  ? t("nodeCard.totalNodes", {
                      total: nodes.length,
                      online: liveData?.online?.length || 0,
                    })
                  : t("nodeCard.groupNodes", {
                      group: selectedGroup,
                      total: filteredNodes.length,
                      online: filteredNodes.filter((n) =>
                        onlineSet.has(n.uuid),
                      ).length,
                    })}
              </Text>
            )}
            </Skeletonize>
          </motion.div>
        </AnimatePresence>
      </Flex>

      {/* 节点显示区域：网格/表格和筛选结果切换都用同一套过渡 */}
      <AutoHeight disabled={!heightFollow.on} threshold={4}>
      <div className="km-node-display-stage relative">
        {/*
          网格/表格切换用同步替换 + 快速淡入，不用 mode="wait"：
          wait 会先播完旧视图的退出再挂新视图，中间有一段空档；
          这里的两个视图高度差别很大，空档期页面会明显塌一下。
        */}
        <AnimatePresence mode="popLayout" initial={false}>
          {loading ? (
            /*
              节点列表未到：用真实的卡片/表格行渲染占位节点，外面 Skeletonize——骨架就是卡片本身的形状。
              占位与真实节点不是同一批数据，所以整块交叉淡化：骨架块（保持骨架态）淡出，真实卡片错峰入场。
            */
            <motion.div
              key={stageKey}
              className="w-full"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: MOTION_TRANSITION.fadeOut }}
            >
              {/* 网格不再自带内边距，色卡与卡片本身对齐，不需要 --km-sk-inset */}
              <Skeletonize loading label>
                {viewMode === "grid" ? (
                  <NodeGrid
                    nodes={PLACEHOLDER_NODES}
                    liveData={EMPTY_LIVE}
                    onlineSet={PLACEHOLDER_ONLINE}
                    liveLoading
                  />
                ) : (
                  <Suspense fallback={tableFallback}>
                    <NodeTable
                      nodes={PLACEHOLDER_NODES}
                      liveData={EMPTY_LIVE}
                      onlineSet={PLACEHOLDER_ONLINE}
                      liveLoading
                    />
                  </Suspense>
                )}
              </Skeletonize>
            </motion.div>
          ) : filteredNodes.length === 0 ? (
            <motion.div
              key={stageKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                duration: MOTION_DURATION.base,
                ease: MOTION_EASE.standard,
              }}
            >
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap="2"
                className="py-km-hero"
              >
                <Text size="4" color="gray">
                  {searchTerm.trim()
                    ? t("search.no_results")
                    : t("nodes.empty")}
                </Text>
                {searchTerm.trim() && (
                  <Text size="2" color="gray">
                    {t("search.try_different")}
                  </Text>
                )}
              </Flex>
            </motion.div>
          ) : (
            /*
              surface 层：两个视图是不同的东西（不是同一块的两种状态），所以用 key 交替。
              只做淡入 + 小位移，不做 scale——整块文字缩放 0.99 会发虚。
              表格/网格内部有各自的入场与补位（卡片错峰、行位置补间）。
            */
            <motion.div
              key={stageKey}
              className="w-full"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{
                opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
                y: MOTION_SPRING.soft,
              }}
            >
              {viewMode === "grid" ? (
                <NodeGrid
                  nodes={filteredNodes}
                  liveData={liveData}
                  onlineSet={onlineSet}
                  liveLoading={liveLoading}
                />
              ) : (
                <Suspense fallback={tableFallback}>
                  <NodeTable
                    nodes={filteredNodes}
                    liveData={liveData}
                    onlineSet={onlineSet}
                    liveLoading={liveLoading}
                  />
                </Suspense>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </AutoHeight>
    </div>
  );
};

export default NodeDisplay;