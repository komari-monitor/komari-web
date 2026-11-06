import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Box, Button, Flex, Heading, Tabs } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import {
  SettingCard,
  SettingCardsLoading,
  SettingCardLongTextInput,
  SettingCardSelect,
  SettingCardShortTextInput,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import SelectorDialog from "@/components/SelectorDialog";
import { Skeletonize } from "@/components/ui/skeleton";
import { useNodeList } from "@/contexts/NodeListContext";
import { useRPC2Call } from "@/contexts/RPC2Context";
import type { I18nText } from "@/utils/i18nText";
import { KmTabsList } from "./KmTabsList";

export interface ConfigFormItem {
  key?: string;
  name?: I18nText;
  help?: I18nText;
  type?: string;
  options?: string;
  default?: unknown;
  required?: boolean;
}

interface Group {
  title?: I18nText;
  items: ConfigFormItem[];
}

interface ConfigSelectionOption {
  id: string;
  name: string;
  weight?: number;
}

interface PingTaskResponse {
  id?: number;
  name?: string;
  weight?: number;
}

const MAX_SELECTED_NAMES_LENGTH = 50;

/**
 * 配置表单的骨架占位：真实配置还没到时，用这几项渲染同样的 SettingCard 结构，
 * 外层包 Skeletonize 就是「按内容长相」的骨架。只有一个分组，不会出现会消失的 Tab 栏。
 * 这些项只用于展示，调用方在加载中不要把它们的值写回状态。
 */
function parseSelectionValue(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const source = JSON.parse(value);
    if (!Array.isArray(source)) return [];
    return source
      .filter(
        (item): item is string | number =>
          typeof item === "string" || typeof item === "number",
      )
      .map(String);
  } catch {
    return [];
  }
}

function serializeSelectionValue(type: "nodes" | "pingtasks", ids: string[]) {
  if (type === "nodes") return JSON.stringify(ids);
  return JSON.stringify(ids.map(Number));
}

function truncateSelectedNames(value: string) {
  if (value.length <= MAX_SELECTED_NAMES_LENGTH) return value;
  return `${value.slice(0, MAX_SELECTED_NAMES_LENGTH - 3)}...`;
}

function ConfigSelectionField({
  title,
  description,
  value,
  onValueChange,
  options,
  buttonLabel,
  dialogTitle,
  listLabel,
  type,
}: {
  title?: string;
  description?: string;
  value: unknown;
  onValueChange: (value: string) => void;
  options: ConfigSelectionOption[];
  buttonLabel: string;
  dialogTitle: string;
  listLabel: string;
  type: "nodes" | "pingtasks";
}) {
  const selectedIds = parseSelectionValue(value);
  const names = new Map(options.map((option) => [option.id, option.name]));
  const selectedNames = truncateSelectedNames(
    selectedIds.map((id) => names.get(id) || id).join(","),
  );
  const fieldDescription =
    description || selectedNames ? (
      <>
        {description}
        {description && selectedNames ? <br /> : null}
        {selectedNames}
      </>
    ) : undefined;

  return (
    <SettingCard title={title} description={fieldDescription}>
      <SettingCard.Action>
        <SelectorDialog
          value={selectedIds}
          onChange={(ids) => onValueChange(serializeSelectionValue(type, ids))}
          items={options}
          getId={(option) => option.id}
          getLabel={(option) => option.name}
          sortItems={(left, right) => (left.weight ?? 0) - (right.weight ?? 0)}
          title={dialogTitle}
          headerLabel={listLabel}
          className="km-config-selector-dialog"
          trigger={<Button>{buttonLabel}</Button>}
        />
      </SettingCard.Action>
    </SettingCard>
  );
}

interface ConfigFormTabsProps {
  items: ConfigFormItem[];
  values: Record<string, any>;
  onValueChange: (key: string, value: any) => void;
  resolveText: (value?: I18nText) => string | undefined;
  /** titlearea 内容（区块标题等），固定不动；页面级标题请放在外层 PageHeader */
  header?: ReactNode;
  /** scrollview 顶部提示（错误/空状态等） */
  notice?: ReactNode;
  /** scrollview 左侧栏（移动端在上方），随 scrollview 一起滚动 */
  sidebar?: ReactNode;
  /** scrollview 底部内容（如底部保存按钮） */
  footer?: ReactNode;
  className?: string;
  formClassName?: string;
  /** Keep the form in a bounded container with its own scroll area. */
  fillHeight?: boolean;
  /**
   * 配置还在读取：每张设置卡各自显示同尺寸色块，分组标题变成文字大小的色块（不整页转圈）。
   * 不传时不包 SettingCardsLoading，DOM 与原来一致（例如插件配置弹窗）。
   */
  loading?: boolean;
}

const SPY_LINE_OFFSET = 16;

/**
 * main > titlearea + scrollview > configarea 结构：
 * - titlearea 固定不滚动，含 header 和分类 Tab（横向可滚动）
 * - scrollview 是独立滚动窗口，内部渲染 notice/sidebar/分组配置项/footer
 * - 滚动时自动高亮当前分组对应的 Tab
 */
const ConfigFormTabs = ({
  items,
  values,
  onValueChange,
  resolveText,
  header,
  notice,
  sidebar,
  footer,
  className,
  formClassName,
  fillHeight = true,
  loading,
}: ConfigFormTabsProps) => {
  const { t } = useTranslation();
  const { nodeList } = useNodeList();
  const { call } = useRPC2Call();
  const [activeTab, setActiveTab] = useState(0);
  const [pingTasks, setPingTasks] = useState<PingTaskResponse[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastTabRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressSpyRef = useRef(false);

  /*
    占位字段与真实字段的 key 不同：数据到达时真实设置卡是新挂载的，没经历加载状态，会直接「啪」地出现。
    让它们先以加载中挂载一次，下一次提交再结束，Skeletonize 就会走揭开流程（内容淡入）。
  */
  const [prevLoading, setPrevLoading] = useState(loading);
  const [revealing, setRevealing] = useState(false);
  if (prevLoading !== loading) {
    setPrevLoading(loading);
    setRevealing(prevLoading === true && loading === false);
  }
  useEffect(() => {
    if (revealing) setRevealing(false);
  }, [revealing]);
  const cardsLoading = Boolean(loading) || revealing;

  const groups = useMemo(() => {
    const result: Group[] = [];
    let current: Group | null = null;
    let pendingTextboxes: ConfigFormItem[] = [];
    for (const item of items) {
      if (item.type === "title") {
        current = { title: item.name, items: pendingTextboxes };
        pendingTextboxes = [];
        result.push(current);
      } else if (item.type === "textbox" && !current) {
        pendingTextboxes.push(item);
      } else if (item.key || item.type === "textbox") {
        if (!current) {
          current = { title: undefined, items: pendingTextboxes };
          pendingTextboxes = [];
          result.push(current);
        }
        current.items.push(item);
      }
    }
    if (pendingTextboxes.length > 0) {
      if (result.length > 0) {
        result[0].items.unshift(...pendingTextboxes);
      } else {
        result.push({ title: undefined, items: pendingTextboxes });
      }
    }
    return result;
  }, [items]);

  const nodeOptions = useMemo<ConfigSelectionOption[]>(
    () =>
      (nodeList ?? []).map((node) => ({
        id: node.uuid,
        name: node.name,
        weight: node.weight,
      })),
    [nodeList],
  );
  const pingTaskOptions = useMemo<ConfigSelectionOption[]>(
    () =>
      pingTasks
        .filter((task) => task.id !== undefined)
        .map((task) => ({
          id: String(task.id),
          name: task.name || String(task.id),
          weight: task.weight,
        })),
    [pingTasks],
  );
  const hasPingTaskFields = items.some((item) => item.type === "pingtasks");

  useEffect(() => {
    if (!hasPingTaskFields) {
      setPingTasks([]);
      return;
    }
    void call<any, PingTaskResponse[]>("admin:getAllPingTasks")
      .then((result) => setPingTasks(Array.isArray(result) ? result : []))
      .catch(() => setPingTasks([]));
  }, [call, hasPingTaskFields]);

  useEffect(() => {
    setActiveTab(0);
    lastTabRef.current = 0;
  }, [groups]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (scrollEndTimerRef.current !== null)
        clearTimeout(scrollEndTimerRef.current);
    },
    [],
  );

  const currentTab = Math.min(activeTab, Math.max(groups.length - 1, 0));
  const hasTabs = groups.length > 1;
  // 标题区为空（无 header 且只有一个分组）时不保留下间距，内容区顶部直接与相邻列/页头对齐
  const showTitleGap = Boolean(header) || hasTabs;

  const updateActiveFromScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || groups.length === 0) return;
    const line = container.getBoundingClientRect().top + SPY_LINE_OFFSET;
    const sections = sectionRefs.current;
    let current = 0;
    for (let i = 0; i < sections.length; i++) {
      const el = sections[i];
      if (el && el.getBoundingClientRect().top <= line) current = i;
    }
    if (
      container.scrollTop + container.clientHeight >=
      container.scrollHeight - 2
    ) {
      current = sections.length - 1;
    }
    if (current !== lastTabRef.current) {
      lastTabRef.current = current;
      setActiveTab(current);
    }
  }, [groups.length]);

  const resumeSpy = useCallback(() => {
    suppressSpyRef.current = false;
    updateActiveFromScroll();
  }, [updateActiveFromScroll]);

  const clearScrollEndTimer = () => {
    if (scrollEndTimerRef.current !== null) {
      clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = null;
    }
  };

  const handleScroll = useCallback(() => {
    if (suppressSpyRef.current) {
      clearScrollEndTimer();
      scrollEndTimerRef.current = setTimeout(resumeSpy, 120);
      return;
    }
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateActiveFromScroll();
    });
  }, [resumeSpy, updateActiveFromScroll]);

  const handleTabChange = (value: string) => {
    const index = Number(value);
    if (Number.isNaN(index)) return;
    suppressSpyRef.current = true;
    setActiveTab(index);
    lastTabRef.current = index;
    const el = sectionRefs.current[index];
    const container = scrollRef.current;
    if (el) {
      if (fillHeight && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        container.scrollTo({
          top: container.scrollTop + (elRect.top - containerRect.top),
          behavior: "smooth",
        });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    clearScrollEndTimer();
    scrollEndTimerRef.current = setTimeout(resumeSpy, 400);
  };

  const renderField = (item: ConfigFormItem, index: number) => {
    const title = resolveText(item.name);
    const description = resolveText(item.help);
    if (item.type === "textbox") {
      return (
        <Box
          key={`textbox-${index}`}
          className="km-config-textbox"
          dangerouslySetInnerHTML={{ __html: title || "" }}
        />
      );
    }

    const key = item.key!;
    const value = values[key];
    switch (item.type) {
      case "nodes":
        return (
          <Box key={key} id={key}>
            <ConfigSelectionField
              title={title}
              description={description}
              value={value}
              onValueChange={(nextValue) => onValueChange(key, nextValue)}
              options={nodeOptions}
              buttonLabel={t("common.select_nodes")}
              dialogTitle={title || t("common.select_nodes")}
              listLabel={t("common.server")}
              type="nodes"
            />
          </Box>
        );
      case "pingtasks":
        return (
          <Box key={key} id={key}>
            <ConfigSelectionField
              title={title}
              description={description}
              value={value}
              onValueChange={(nextValue) => onValueChange(key, nextValue)}
              options={pingTaskOptions}
              buttonLabel={t("common.select_ping_tasks")}
              dialogTitle={title || t("common.select_ping_tasks")}
              listLabel={t("common.name")}
              type="pingtasks"
            />
          </Box>
        );
      case "switch":
        return (
          <Box key={key} id={key}>
            <SettingCardSwitch
              title={title}
              description={description}
              defaultChecked={!!value}
              onChange={(checked) => onValueChange(key, checked)}
            />
          </Box>
        );
      case "select": {
        const options = (item.options || "")
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
          .map((o) => ({ value: o }));
        return (
          <Box key={key} id={key}>
            <SettingCardSelect
              title={title}
              description={description}
              value={value}
              options={options}
              OnSave={(v) => onValueChange(key, v)}
              label={value !== undefined ? String(value) : t("common.select")}
            />
          </Box>
        );
      }
      case "number":
        return (
          <Box key={key} id={key}>
            <SettingCardShortTextInput
              title={title}
              description={description}
              type="number"
              showSaveButton={false}
              value={value !== undefined ? String(value) : ""}
              onChange={(e) =>
                onValueChange(
                  key,
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          </Box>
        );
      case "richtext":
        return (
          <Box key={key} id={key}>
            <SettingCardLongTextInput
              title={title}
              description={description}
              defaultValue={value !== undefined ? String(value) : ""}
              showSaveButton={false}
              onChange={(e) => onValueChange(key, e.target.value)}
            />
          </Box>
        );
      case "string":
      default:
        return (
          <Box key={key} id={key}>
            <SettingCardShortTextInput
              title={title}
              description={description}
              value={value !== undefined ? String(value) : ""}
              required={item.required}
              showSaveButton={false}
              onChange={(e) => onValueChange(key, e.target.value)}
            />
          </Box>
        );
    }
  };

  const renderSections = () =>
    loading === undefined ? (
      renderGroups()
    ) : (
      <SettingCardsLoading loading={cardsLoading}>{renderGroups()}</SettingCardsLoading>
    );

  const renderGroups = () =>
    groups.map((group, index) => (
      <Box
        key={index}
        ref={(el) => {
          sectionRefs.current[index] = el;
        }}
      >
        {/* 分组标题贴近自己的字段（group），分组之间由外层栈拉开（section） */}
        {group.title && (
          <Heading size="3" mb="2">
            {loading === undefined ? (
              resolveText(group.title) || t("common.title")
            ) : (
              <Skeletonize as="span" loading={loading}>
                {resolveText(group.title) || t("common.title")}
              </Skeletonize>
            )}
          </Heading>
        )}
        <Flex direction="column" gap="4">
          {group.items.map(renderField)}
        </Flex>
      </Box>
    ));

  return (
    <Flex
      direction="column"
      className={
        fillHeight ? `h-full min-h-0 ${className}` : className
      }
    >
      {/* titlearea：固定顶部，不随滚动移动 */}
      {/* 标题区与它服务的 Tab/表单之间是块内关系：block */}
      <Box className={showTitleGap ? "shrink-0 mb-km-block" : "shrink-0"}>
        <Flex direction="column" gap="4">
          {header}
          {hasTabs && (
            <Tabs.Root
              value={String(currentTab)}
              onValueChange={handleTabChange}
            >
              {/* control 性格：选中下划线在标签间弹簧滑动（共享指示器，可被打断） */}
              <KmTabsList className="km-config-form-tabs-list overflow-x-auto">
                {groups.map((group, index) => (
                  <Tabs.Trigger
                    key={index}
                    value={String(index)}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {group.title
                      ? resolveText(group.title) || t("common.title")
                      : t("settings.general.title")}
                  </Tabs.Trigger>
                ))}
              </KmTabsList>
            </Tabs.Root>
          )}
        </Flex>
      </Box>

      {/* scrollview：独立滚动窗口，内容（configarea）在其中滚动 */}
      <Box
        ref={scrollRef}
        onScroll={fillHeight ? handleScroll : undefined}
        className={
          fillHeight
            ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
            : undefined
        }
      >
        {notice}
        {sidebar ? (
          <Flex
            direction={{ initial: "column", md: "row" }}
            gap="4"
            align="start"
          >
            <Box className="w-full shrink-0 md:w-64">{sidebar}</Box>
            <Flex
              direction="column"
              gap="5"
              className={`min-w-0 flex-1 ${formClassName}`}
            >
              {renderSections()}
            </Flex>
          </Flex>
        ) : (
          <Flex direction="column" gap="5" className={formClassName}>
            {renderSections()}
          </Flex>
        )}
        {footer}
      </Box>
    </Flex>
  );
};

export default ConfigFormTabs;
