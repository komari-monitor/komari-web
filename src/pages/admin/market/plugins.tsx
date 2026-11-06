import { useCallback, useMemo, useRef, useState } from "react";
import {
  Callout,
  Flex,
  Grid,
  Tabs,
} from "@radix-ui/themes";
import {
  Blocks,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import PluginConfigDialog from "@/components/admin/PluginConfigDialog";
import PluginPermissionDialog from "@/components/admin/PluginPermissionDialog";
import { useAdminNavigation } from "@/contexts/AdminNavigationContext";
import { toast } from "sonner";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import { AutoHeight, SlideSwap } from "@/components/motion";
import { normalizePluginCategory, pluginCategories } from "@/utils/pluginCategory";
import { placeholderCard } from "@/components/ui/placeholderCard";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";
import type { PluginInfo } from "@/types/plugin";
import { KmTabsList } from "@/components/admin/KmTabsList";
import PageHeader from "@/components/PageHeader";
import { useRouteQuery } from "@/lib/routeData";
import { fetchPluginMarket, marketSourcesQuery, pluginMarketQuery } from "@/routeQueries/appearance";
import { installFromMarket, toastError } from "./shared/api";
import { useMarketSources } from "./shared/useMarketSources";
import { useMarketPage } from "./shared/useMarketPage";
import { MarketHeaderActions, MarketSearch, MarketSourceErrors } from "./shared/MarketControls";
import MarketSourcesDialog, { MarketSourceDeleteDialog } from "./shared/MarketSourcesDialog";
import MarketConfirmDialog from "./shared/MarketConfirmDialog";
import MarketPluginCard from "./plugins/MarketPluginCard";
import { PLACEHOLDER_PLUGINS, type MarketPlugin } from "./plugins/types";

const EMPTY_PLUGINS: MarketPlugin[] = [];
const EMPTY_INSTALLED: PluginInfo[] = [];

// 插件市场：源管理与主题市场一致（增/改/删/启停 + 目录刷新）。
export default function PluginMarketPage() {
  const { call } = useRPC2Call();
  const { t, i18n } = useTranslation();
  const { refreshNavigation } = useAdminNavigation();
  const [configPlugin, setConfigPlugin] = useState<PluginInfo | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PluginInfo | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(() => new Set());
  const togglingRef = useRef(new Set<string>());
  const language = i18n.resolvedLanguage || i18n.language || "";
  const displayText = useCallback(
    (value: I18nText | undefined) => resolveI18nText(value, language) || "",
    [language],
  );

  // 页面切换时目录（含已安装插件、面板版本）与源已由 routePreload 提前请求；等待预算内到达直接显示，否则骨架
  const catalogResult = useRouteQuery(pluginMarketQuery);
  const sourcesResult = useRouteQuery(marketSourcesQuery("plugin"));
  const plugins = catalogResult.data?.plugins ?? EMPTY_PLUGINS;
  const currentVersion = catalogResult.data?.currentVersion ?? "";
  const sourceStatuses = catalogResult.data?.sources ?? [];
  const installedList = catalogResult.data?.installed ?? EMPTY_INSTALLED;
  const installed = useMemo(
    () => new Map(installedList.map((plugin) => [plugin.short, plugin.version])),
    [installedList],
  );
  const installedInfo = useMemo(
    () => new Map(installedList.map((plugin) => [plugin.short, plugin])),
    [installedList],
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [slideDirection, setSlideDirection] = useState(1);
  const reduceMotion = useKmReducedMotion();
  const changeCategoryFilter = (value: string) => {
    const order: readonly string[] = ["all", ...pluginCategories];
    setSlideDirection(order.indexOf(value) > order.indexOf(categoryFilter) ? 1 : -1);
    setCategoryFilter(value);
  };
  const [installing, setInstalling] = useState<string | null>(null);
  const [pluginToUninstall, setPluginToUninstall] =
    useState<MarketPlugin | null>(null);
  const [deletingPlugin, setDeletingPlugin] = useState<string | null>(null);

  // 安装、卸载、启停、源变化后的刷新：直接请求（不挂起、不显示骨架），结果写回 catalogResult
  const setCatalog = catalogResult.setData;
  const loadCatalog = useCallback(
    async (force = false) => {
      setCatalog(await fetchPluginMarket(force));
    },
    [setCatalog],
  );

  const sourcesState = useMarketSources("plugin", sourcesResult, loadCatalog);
  const { loading, refreshing, refresh } = useMarketPage(
    catalogResult,
    sourcesResult,
    loadCatalog,
    t("plugin.market_refresh_success", "Plugin sources refreshed"),
  );

  const filteredPlugins = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return plugins.filter((plugin) =>
      (categoryFilter === "all" || normalizePluginCategory(plugin.category) === categoryFilter) &&
      (!term || [
        displayText(plugin.name),
        plugin.short,
        displayText(plugin.author),
        displayText(plugin.description),
        plugin.source_name,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(term)),
    );
  }, [categoryFilter, displayText, search, plugins]);

  const installPlugin = async (plugin: MarketPlugin) => {
    const key = `${plugin.source_id}:${plugin.short}`;
    setInstalling(key);
    try {
      const payload = await installFromMarket("plugin", plugin.source_id, plugin.short);
      toast.success(
        payload.message ||
          t("plugin.market_install_success", "Plugin installed"),
      );
      await loadCatalog();
    } catch (error) {
      toastError(error);
    } finally {
      setInstalling(null);
    }
  };

  const uninstallPlugin = async (plugin: MarketPlugin) => {
    setDeletingPlugin(plugin.short);
    try {
      await call("admin:deletePlugin", { short: plugin.short });
      refreshNavigation();
      toast.success(t("plugin.market_uninstall_success", "Plugin uninstalled"));
      await loadCatalog();
    } catch (error) {
      toastError(error);
    } finally {
      setDeletingPlugin(null);
    }
  };

  const togglePlugin = async (plugin: PluginInfo, approved = false) => {
    if (togglingRef.current.has(plugin.short)) return;
    togglingRef.current.add(plugin.short);
    setToggling(new Set(togglingRef.current));
    const enabled = approved || !plugin.enabled;
    try {
      const result = await call<{ short: string; enabled: boolean; approved?: boolean }, { requires_approval?: boolean }>(
        "admin:setPluginEnabled", { short: plugin.short, enabled, ...(approved ? { approved: true } : {}) },
      );
      if (enabled && result?.requires_approval) {
        setPendingApproval(plugin);
        return;
      }
      setPendingApproval((current) => current?.short === plugin.short ? null : current);
      toast.success(enabled ? t("plugin.enable_success", "Plugin enabled") : t("plugin.disable_success", "Plugin disabled"));
    } catch (error) {
      toastError(error);
    } finally {
      refreshNavigation();
      try {
        await loadCatalog();
      } finally {
        togglingRef.current.delete(plugin.short);
        setToggling(new Set(togglingRef.current));
      }
    }
  };
  const approveAndEnable = () => {
    if (pendingApproval) void togglePlugin(pendingApproval, true);
  };

  // 页头、提示、搜索直接渲染；目录未到时用占位插件渲染同样的卡片网格，每张卡片是一块色块
  const listPlugins = loading ? PLACEHOLDER_PLUGINS : filteredPlugins;

  return (
    // 外边距由后台内容区统一提供；页头 / 风险提示 / 源错误 / 搜索+分类+网格 之间 section
    <div className="km-page km-page-admin-market-plugins">
      <PageHeader
        icon={<Blocks size={20} />}
        title={t("plugin.market", "Plugin Market")}
        actions={
          <MarketHeaderActions
            onManageSources={() => sourcesState.setSourcesOpen(true)}
            onRefresh={refresh}
            refreshing={refreshing}
            manageIconSize={14}
            refreshIconSize={16}
          />
        }
      />

      <Callout.Root color="amber" size="1">
        <Callout.Icon>
          <ShieldAlert size={16} />
        </Callout.Icon>
        <Callout.Text>{t("plugin.market_warning")}</Callout.Text>
      </Callout.Root>

      {/* feedback 层：源错误在刷新后出现/消失时高度展开/收起，下方网格不跳 */}
      <MarketSourceErrors statuses={sourceStatuses} />

      {/* 搜索、分类 Tab 与它们过滤的网格是同一区块：block */}
      <Flex direction="column" gap="4" className="min-w-0">
      <MarketSearch
        value={search}
        onChange={setSearch}
        placeholder={t("plugin.market_search", "Search plugins...")}
        className="km-market-plugins-toolbar"
        iconSize={14}
      />

      <Tabs.Root value={categoryFilter} onValueChange={changeCategoryFilter}>
        {/* control 性格：选中下划线在标签间弹簧滑动（共享指示器，可被打断） */}
        <KmTabsList aria-label={t("plugin.market_category")} className="overflow-x-auto">
          <Tabs.Trigger value="all" className="shrink-0">{t("common.all", "All")}</Tabs.Trigger>
          {pluginCategories.map((category) => (
            <Tabs.Trigger key={category} value={category} className="shrink-0">
              {t(`plugin.categories.${category}`)}
            </Tabs.Trigger>
          ))}
        </KmTabsList>
      </Tabs.Root>

      {/* 占位卡片数 -> 真实插件数、切换分类：网格高度弹簧过渡 */}
      <AutoHeight className="overflow-x-clip">
        <SlideSwap swapKey={categoryFilter} direction={slideDirection} reduceMotion={reduceMotion}>
            {listPlugins.length === 0 ? (
              <Callout.Root>
                <Callout.Text>
                  {plugins.length === 0
                    ? t("plugin.market_no_plugins", "No plugins in the market")
                    : t("common.no_data", "No data")}
                </Callout.Text>
              </Callout.Root>
            ) : (
              <Grid
                columns={{ initial: "1", sm: "2", lg: "3" }}
                gap="4"
                className="km-market-plugins-list"
              >
                {listPlugins.map((plugin, index) => placeholderCard(loading, `${plugin.source_id}:${plugin.short}`, (
                  <MarketPluginCard
                    key={`${plugin.source_id}:${plugin.short}`}
                    plugin={plugin}
                    index={index}
                    installed={installed}
                    installedInfo={installedInfo}
                    currentVersion={currentVersion}
                    toggling={toggling}
                    deletingPlugin={deletingPlugin}
                    installing={installing}
                    reduceMotion={reduceMotion}
                    displayText={displayText}
                    togglePlugin={togglePlugin}
                    installPlugin={installPlugin}
                    setConfigPlugin={setConfigPlugin}
                    setPluginToUninstall={setPluginToUninstall}
                  />
                )))}
              </Grid>
            )}
        </SlideSwap>
      </AutoHeight>
      </Flex>

      {configPlugin && (
        <PluginConfigDialog
          key={configPlugin.short}
          plugin={configPlugin}
          onClose={() => setConfigPlugin(null)}
          onSaved={() => { refreshNavigation(); void loadCatalog(); }}
        />
      )}
      <PluginPermissionDialog
        plugin={pendingApproval}
        onOpenChange={(open) => {
          if (!open && !toggling.has(pendingApproval?.short || "")) setPendingApproval(null);
        }}
        busy={toggling.has(pendingApproval?.short || "")}
        onCancel={() => setPendingApproval(null)}
        onApprove={approveAndEnable}
      />


      {/* 源管理弹窗：与主题市场一致 */}
      <MarketSourcesDialog state={sourcesState} />

      {/* 卸载确认 */}
      <MarketConfirmDialog
        open={Boolean(pluginToUninstall)}
        onClose={() => setPluginToUninstall(null)}
        title={t("market.uninstall", "Uninstall")}
        description={t("market.uninstall_confirm", "Uninstall {{name}}?", {
          name: pluginToUninstall
            ? displayText(pluginToUninstall.name) || pluginToUninstall.short
            : "",
        })}
        confirmText={t("market.uninstall", "Uninstall")}
        disabled={
          !pluginToUninstall || deletingPlugin === pluginToUninstall.short
        }
        spinning={Boolean(deletingPlugin)}
        onConfirm={async () => {
          if (!pluginToUninstall) return;
          await uninstallPlugin(pluginToUninstall);
          setPluginToUninstall(null);
        }}
      />

      {/* 删除源确认 */}
      <MarketSourceDeleteDialog state={sourcesState} />
    </div>
  );
}
