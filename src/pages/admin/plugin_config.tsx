import { useCallback, useEffect, useMemo, useState } from "react";
import { Blocks } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Text,
} from "@radix-ui/themes";
import PageHeader from "@/components/PageHeader";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_SPRING } from "@/lib/motion";
import { AutoHeight, PresenceBox } from "@/components/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import PluginIcon from "@/components/admin/PluginIcon";
import ConfigFormTabs from "@/components/admin/ConfigFormTabs";
import {
  buildConfigInitialValues,
  CONFIG_FORM_PLACEHOLDER_ITEMS,
} from "@/components/admin/configFormValues";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useRouteQuery } from "@/lib/routeData";
import {
  fetchPluginList,
  pluginConfigurationQuery,
  pluginsQuery,
} from "@/routeQueries/appearance";
import { resolveI18nText } from "@/utils/i18nText";
import { hasPluginConfiguration } from "@/utils/pluginInfo";
import type { I18nText } from "@/utils/i18nText";
import type { PluginInfo, PluginConfigItem } from "@/types/plugin";

const EMPTY_PLUGINS: PluginInfo[] = [];

/** 列表骨架：常见的可配置插件数量（只用于展示，不会被选中） */
const PLACEHOLDER_PLUGINS = Array.from(
  { length: 4 },
  (_, index) => ({ short: `__km_placeholder_${index}`, name: skeletonText(10 + (index % 3) * 3) }) as unknown as PluginInfo,
);

// 插件配置：左侧插件列表，右侧具体插件的配置项（与主题配置一致）。
export default function PluginConfigPage() {
  const { call } = useRPC2Call();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "";

  const [searchParams] = useSearchParams();
  // 页面切换时插件列表（以及 ?short= 指定插件的配置）已由 routePreload 提前请求
  const pluginsResult = useRouteQuery(pluginsQuery);
  const plugins = pluginsResult.data ?? EMPTY_PLUGINS;
  const setPlugins = pluginsResult.setData;
  const loading = pluginsResult.data === undefined && !pluginsResult.error;
  useEffect(() => {
    const e = pluginsResult.error;
    if (e) toast.error(e instanceof Error ? e.message : String(e));
  }, [pluginsResult.error]);
  /**
   * 当前选择：从插件管理页跳转过来时（?short=xxx）初始就选中它，配置与列表并行请求。
   * attempt 每次点选递增：再次点同一个插件也会重新读取配置（与原来一致）。
   */
  const [selection, setSelection] = useState<{ short: string; attempt: number } | null>(() => {
    const short = searchParams.get("short");
    return short ? { short, attempt: 0 } : null;
  });
  const [saving, setSaving] = useState(false);

  const displayText = useCallback(
    (value: I18nText | undefined) => resolveI18nText(value, language) || "",
    [language],
  );

  // 无可展示配置项（忽略 title 分组项）的插件不显示在列表中。
  const configurablePlugins = useMemo(
    () => plugins.filter(hasPluginConfiguration),
    [plugins],
  );

  // 保存后重载失败时刷新列表（直接请求，不显示骨架）
  const loadList = useCallback(async () => {
    try {
      const nextPlugins = await fetchPluginList();
      setPlugins(nextPlugins);
      return nextPlugins;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [setPlugins]);

  // 选中的插件取自最新列表（启停状态随列表刷新）；URL 指定的插件不在可配置列表里时视为未选
  const selected = loading
    ? null
    : configurablePlugins.find((plugin) => plugin.short === selection?.short) ?? null;

  const configQuery = useMemo(
    () => (selection ? pluginConfigurationQuery(selection.short, selection.attempt) : null),
    [selection],
  );
  const configResult = useRouteQuery(configQuery);
  // 换插件期间不沿用上一个插件的配置
  const configResponse = configResult.loading || configResult.error ? null : configResult.data;
  const configuration = configResponse ? configResponse.configuration || {} : null;
  const error = configResult.error
    ? configResult.error instanceof Error
      ? configResult.error.message
      : String(configResult.error)
    : null;

  // 表单值：配置到达时按「已保存的值优先，其次 default」初始化，之后由用户编辑
  const initialValues = useMemo(() => {
    if (!configResponse) return {};
    const data = configResponse.configuration?.data;
    const items: PluginConfigItem[] = Array.isArray(data) ? data : [];
    return buildConfigInitialValues(items, configResponse.data);
  }, [configResponse]);
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [valuesFor, setValuesFor] = useState(initialValues);
  if (valuesFor !== initialValues) {
    setValuesFor(initialValues);
    setValues(initialValues);
  }

  const selectPlugin = (plugin: PluginInfo) => {
    setSelection((current) => ({ short: plugin.short, attempt: (current?.attempt ?? 0) + 1 }));
  };

  const handleValueChange = (key: string, value: any) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const saveAll = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await call("admin:setPluginConfiguration", {
        short: selected.short,
        data: values,
      });
      toast.success(
        selected.enabled
          ? t(
              "plugin.config_saved_and_reloaded",
              "Configuration saved and plugin reloaded",
            )
          : t("plugin.config_saved", "Configuration saved"),
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const reloadFailed =
        selected.enabled && errorMessage.includes("plugin configuration saved but reload failed");
      toast.error(
        `${reloadFailed
          ? t(
              "plugin.config_saved_reload_failed",
              "Configuration saved, but plugin reload failed",
            )
          : t("plugin.config_save_failed", "Failed to save configuration")}: ${
          errorMessage
        }`,
      );
      if (reloadFailed) {
        // 选中项由列表派生，刷新列表即可拿到最新的启停状态
        await loadList();
      }
    } finally {
      setSaving(false);
    }
  };

  // 不再整页 early return：列表与表单用占位数据渲染同样的结构，Skeletonize 画骨架

  const items: PluginConfigItem[] = Array.isArray(configuration?.data)
    ? configuration.data
    : [];
  const configurationLoading = !!selected && configuration === null && !error;
  // 右侧表单色块：首屏（列表未到且 URL 指定了插件，或已选插件的配置还在请求）
  const formLoading = configurationLoading || (loading && Boolean(selection));
  const hasItems = items.some((item) => item.type !== "title");
  const hasEditableItems = items.some(
    (item) => item.type !== "title" && item.type !== "textbox",
  );

  const renderItem = (plugin: PluginInfo, placeholder: boolean) => {
    const isActive = !placeholder && selected?.short === plugin.short;
    return (
      <motion.button
        key={plugin.short}
        type="button"
        // 只补间位置（行内有文字，尺寸补间会拉伸文字；高度变化直接生效）
        layout="position"
        onClick={() => selectPlugin(plugin)}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        whileTap={{ scaleY: 0.97 }}
        transition={{ layout: MOTION_SPRING.layout }}
        className="group relative flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-accent-3"
        style={{
          color: isActive ? "var(--accent-10)" : "inherit",
        }}
      >
        {isActive && (
          <motion.span
            layoutId="km-plugin-config-active"
            aria-hidden
            className="absolute inset-0 rounded-md"
            style={{ backgroundColor: "var(--accent-4)" }}
            transition={MOTION_SPRING.snappy}
          />
        )}
        <motion.span
          aria-hidden
          initial={false}
          animate={{ scaleY: isActive ? 1 : 0.001, opacity: isActive ? 1 : 0 }}
          transition={MOTION_SPRING.snappy}
          className="absolute left-0 top-1 bottom-1 w-1 origin-center rounded-r"
          style={{ backgroundColor: "var(--accent-8)" }}
        />
        {/*
          图标槽固定 20×20 且是 flex 容器：里面不形成行盒。
          SVG 地址的图标先渲染 <img>（块级），内联 SVG 读到后换成 inline-flex 的 <span>；
          普通 span 包着它时 span 会按文字基线排版（行高 + 下沉），槽高 20 -> 27px、整行高 38 -> 43px，
          图标比文字高约 3.7px，这就是「抖一下、之后不居中」。flex 槽里无论 img / svg / span 都垂直居中。
        */}
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          {placeholder ? (
            <Blocks size={16} className="h-5 w-5 shrink-0" style={{ opacity: 0.7 }} />
          ) : (
            <PluginIcon plugin={plugin} size={16} className="h-5 w-5 shrink-0" opacity={isActive ? 1 : 0.7} />
          )}
        </span>
        <Text
          size="2"
          weight={isActive ? "bold" : "medium"}
          className="relative min-w-0 truncate"
        >
          {displayText(plugin.name) || plugin.short}
        </Text>
      </motion.button>
    );
  };

  return (
    // 页面骨架：页头固定，下方「插件列表 + 配置表单」两列各自滚动；外边距由后台内容区统一提供
    <div className="km-page km-page-admin-plugin-config h-full min-h-0 overflow-hidden">
      <PageHeader
        className="shrink-0"
        icon={<Blocks size={20} />}
        title={t("plugin.config", "Configuration")}
        actions={
            <Button
              onClick={saveAll}
              disabled={saving || !selected || !!error || !hasEditableItems}
              style={{
                visibility: selected && !error && hasEditableItems ? "visible" : "hidden",
              }}
            >
              {saving
                ? selected?.enabled
                  ? t("plugin.saving_and_reloading", "Saving and reloading...")
                  : t("plugin.saving", "Saving...")
                : selected?.enabled
                  ? t("plugin.save_and_reload", "Save and reload")
                  : t("common.save")}
            </Button>
        }
      />
      <Flex
        direction={{ initial: "column", md: "row" }}
        gap="4"
        className="min-h-0 flex-1 overflow-hidden"
      >
        <Box className="max-h-48 w-full shrink-0 overflow-y-auto overscroll-contain md:max-h-full md:w-64">
          {/* 占位项数 -> 真实插件数：列表卡片高度弹簧过渡 */}
          <AutoHeight>
          <Skeletonize loading={loading}>
          <Card>
            <Flex direction="column" gap="1">
              {!loading && configurablePlugins.length === 0 && (
                <Text size="2" color="gray">
                  {plugins.length === 0
                    ? t("plugin.no_plugins", "No plugins installed yet")
                    : t("plugin.config_no_configurable_plugins", "No plugins with configuration items")}
                </Text>
              )}
              {/*
                content 层：选中态的高亮块在项之间滑动（共享元素），进出场也有过渡。
                占位项放在 AnimatePresence 外面：它们没有退场，数据到达的那一帧直接卸载；
                放在里面时 AnimatePresence 会把它们多留一帧，列表短暂变成「占位 + 真实」两倍高再塌回去（抖一下）。
              */}
              {loading
                ? PLACEHOLDER_PLUGINS.map((plugin) => renderItem(plugin, true))
                : null}
              <AnimatePresence initial={false}>
                {loading ? null : configurablePlugins.map((plugin) => renderItem(plugin, false))}
              </AnimatePresence>
            </Flex>
          </Card>
          </Skeletonize>
          </AutoHeight>
        </Box>
        {/* overlay 层：切换插件时右侧配置区淡入上浮（同一块舞台，只换内容） */}
        <AnimatePresence mode="wait" initial={false}>
        <PresenceBox key={selected?.short ?? "km-plugin-config-empty"} className="min-w-0 flex-1 overflow-hidden">
        {/*
          配置表单页：外层 flex 撑满（h-full），表单内部的独立滚动区才不塌。
          配置请求中用占位字段渲染同样的 SettingCard 结构，每张卡各自显示色块（不整块转圈）。
        */}
        <div className="flex h-full min-h-0 flex-col">
        <ConfigFormTabs
          loading={formLoading}
          items={formLoading ? CONFIG_FORM_PLACEHOLDER_ITEMS : items}
          values={formLoading ? {} : values}
          onValueChange={handleValueChange}
          resolveText={displayText}
          className="min-w-0 flex-1 overflow-hidden"
          header={
            formLoading ? (
              <Text weight="bold">
                {selected ? (
                  displayText(selected.name) || selected.short
                ) : (
                  <Skeletonize as="span" loading>{skeletonText(10)}</Skeletonize>
                )}
              </Text>
            ) : (
              selected && !error && hasItems && (
                <Text weight="bold">
                  {displayText(selected.name) || selected.short}
                </Text>
              )
            )
          }
          notice={
            formLoading ? undefined : !selected ? (
              // 没有可配置插件时左栏已说明，右侧不再重复提示。
              configurablePlugins.length > 0 ? (
                <Box className="mb-km-block">
                  <Callout.Root size="1">
                    <Callout.Text size="2">{t("plugin.config_select_plugin", "Select a plugin on the left to configure")}</Callout.Text>
                  </Callout.Root>
                </Box>
              ) : undefined
            ) : error || !hasItems ? (
              <Box className="mb-km-block">
                {error ? (
                  <Callout.Root color="red" size="1">
                    <Callout.Text size="2">{error}</Callout.Text>
                  </Callout.Root>
                ) : (
                  <Callout.Root size="1">
                    <Callout.Text size="2">{t("plugin.config_no_items", "This plugin has no configuration items")}</Callout.Text>
                  </Callout.Root>
                )}
              </Box>
            ) : undefined
          }
        />
        </div>
        </PresenceBox>
        </AnimatePresence>
      </Flex>
    </div>
  );
}
