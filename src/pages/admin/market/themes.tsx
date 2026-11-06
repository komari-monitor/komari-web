import { skeletonText } from "@/components/ui/skeleton";
import { placeholderCard } from "@/components/ui/placeholderCard";
import { useAdminNavigation } from "@/contexts/AdminNavigationContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  IconButton,
  Text,
} from "@radix-ui/themes";
import {
  Download,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import {
  CONTENT_MOTION,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import { AutoHeight, StatusFeedback } from "@/components/motion";
import PageHeader from "@/components/PageHeader";
import { useRouteQuery } from "@/lib/routeData";
import {
  currentThemeQuery,
  fetchCurrentTheme,
  fetchThemeMarket,
  marketSourcesQuery,
  rememberActiveTheme,
  themeMarketQuery,
} from "@/routeQueries/appearance";
import {
  installFromMarket,
  marketRequest,
  toastError,
} from "./shared/api";
import type { MarketTheme } from "./themes/types";
import { isVersionNewer } from "./shared/version";
import { useMarketSources } from "./shared/useMarketSources";
import { useMarketPage } from "./shared/useMarketPage";
import { MarketHeaderActions, MarketSearch, MarketSourceErrors } from "./shared/MarketControls";
import MarketSourcesDialog, { MarketSourceDeleteDialog } from "./shared/MarketSourcesDialog";
import MarketConfirmDialog from "./shared/MarketConfirmDialog";

const EMPTY_THEMES: MarketTheme[] = [];
const EMPTY_INSTALLED = new Map<string, string>();

/** Radix Card 提升为 motion 组件：动画不额外增加 DOM 层级（content 层专用）。 */
const MotionThemeCard = motion.create(Card);

/** 卡片骨架：一屏常见的主题数量；只用于展示（Skeletonize 期间 inert） */
const PLACEHOLDER_THEMES: MarketTheme[] = Array.from({ length: 8 }, (_, index) => ({
  name: skeletonText(9 + (index % 3) * 3),
  short: `__km_placeholder_${index}`,
  description: skeletonText(40 - (index % 2) * 12),
  version: skeletonText(5),
  author: skeletonText(7),
  url: "",
  preview: "",
  download: "",
  sha256: "",
  installable: false,
  source_id: "__km_placeholder",
  source_name: "",
}));

export default function ThemeMarketPage() {
  const { t, i18n } = useTranslation();
  // 页面切换时目录、源、当前主题已由 routePreload 提前请求；等待预算内到达直接显示，否则骨架
  const catalogResult = useRouteQuery(themeMarketQuery);
  const sourcesResult = useRouteQuery(marketSourcesQuery("theme"));
  const settingsResult = useRouteQuery(currentThemeQuery);
  const themes = catalogResult.data?.themes ?? EMPTY_THEMES;
  const sourceStatuses = catalogResult.data?.sources ?? [];
  const installed = catalogResult.data?.installed ?? EMPTY_INSTALLED;
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<MarketTheme | null>(null);
  const [themeToUninstall, setThemeToUninstall] = useState<MarketTheme | null>(null);
  const [settingTheme, setSettingTheme] = useState<string | null>(null);
  const [deletingTheme, setDeletingTheme] = useState<string | null>(null);
  const setSettings = settingsResult.setData;
  // 与 useSettings().refetch 一致：失败时抛出（调用处 toast）
  const refetchSettings = useCallback(async () => {
    setSettings(await fetchCurrentTheme());
  }, [setSettings]);
  const { refresh: refreshPublicInfo } = usePublicInfo();
  const { refreshNavigation } = useAdminNavigation();
  const currentTheme = settingsResult.data?.theme;
  useEffect(() => rememberActiveTheme(currentTheme), [currentTheme]);
  const reducedMotion = useKmReducedMotion();
  const language = i18n.resolvedLanguage || i18n.language;
  const displayText = useCallback(
    (value: I18nText) => resolveI18nText(value, language) || "",
    [language],
  );

  // 安装、卸载、源变化后的刷新：直接请求（不挂起、不显示骨架），结果写回 catalogResult
  const setCatalog = catalogResult.setData;
  const loadCatalog = useCallback(async (force = false) => {
    setCatalog(await fetchThemeMarket(force));
  }, [setCatalog]);

  const sourcesState = useMarketSources("theme", sourcesResult, loadCatalog);
  const { loading: catalogLoading, refreshing, refresh } = useMarketPage(
    catalogResult,
    sourcesResult,
    loadCatalog,
    t("market.refresh_success", "Theme sources refreshed"),
  );
  // 当前主题决定「已启用」徽标与「设为主题」按钮：一起等它，避免先闪错的状态（失败时照常显示）
  const loading = catalogLoading || (settingsResult.data === undefined && !settingsResult.error);

  const filteredThemes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return themes;
    return themes.filter((theme) =>
      [displayText(theme.name), theme.short, displayText(theme.author), displayText(theme.description), theme.source_name]
        .join(" ")
        .toLocaleLowerCase()
        .includes(term),
    );
  }, [displayText, search, themes]);

  /** 卡片与详情弹窗共用的安装 / 更新 / 启用状态 */
  const themeState = (theme: MarketTheme) => {
    const installedVersion = installed.get(theme.short);
    return {
      key: `${theme.source_id}:${theme.short}`,
      installedVersion,
      isInstalled: Boolean(installedVersion),
      hasUpdate: Boolean(installedVersion && isVersionNewer(theme.version, installedVersion)),
      isActive: currentTheme === theme.short,
      isInstallable: theme.installable,
    };
  };

  const installTheme = async (theme: MarketTheme) => {
    const key = `${theme.source_id}:${theme.short}`;
    setInstalling(key);
    try {
      const payload = await installFromMarket("theme", theme.source_id, theme.short);
      toast.success(payload.message || t("market.install_success", "Theme installed"));
      await loadCatalog();
      if (currentTheme === theme.short) {
        await refreshPublicInfo();
        refreshNavigation();
      }
    } catch (error) {
      toastError(error);
    } finally {
      setInstalling(null);
    }
  };

  const setActiveTheme = async (theme: MarketTheme) => {
    setSettingTheme(theme.short);
    try {
      await marketRequest(`/api/admin/theme/set?theme=${encodeURIComponent(theme.short)}`);
      await refetchSettings();
      await refreshPublicInfo();
      refreshNavigation();
      toast.success(t("theme.set_success", "Theme activated"));
    } catch (error) {
      toastError(error);
    } finally {
      setSettingTheme(null);
    }
  };

  const uninstallTheme = async (theme: MarketTheme) => {
    setDeletingTheme(theme.short);
    try {
      const wasActive = currentTheme === theme.short;
      if (wasActive) {
        await marketRequest("/api/admin/theme/set?theme=default");
      }
      await marketRequest("/api/admin/theme/delete", { json: { short: theme.short } });
      await Promise.all([loadCatalog(), refetchSettings()]);
      if (wasActive) {
        await refreshPublicInfo();
        refreshNavigation();
      }
      setSelectedTheme(null);
      toast.success(t("market.uninstall_success", "Theme uninstalled"));
    } catch (error) {
      toastError(error);
    } finally {
      setDeletingTheme(null);
    }
  };

  // 页头、搜索直接渲染；目录未到时用占位主题渲染同样的卡片网格，每张卡片是一块色块
  const listThemes = loading ? PLACEHOLDER_THEMES : filteredThemes;

  return (
    // 外边距由后台内容区统一提供；页头 / 源错误 / 搜索+网格 之间 section
    <div className="km-page km-page-admin-market-themes">
      <PageHeader
        title={t("market.themes", "Theme Market")}
        description={t("market.description", "Find and install themes from the internet.")}
        actions={
          <MarketHeaderActions
            onManageSources={() => sourcesState.setSourcesOpen(true)}
            onRefresh={refresh}
            refreshing={refreshing}
            manageIconSize={16}
            refreshIconSize={17}
          />
        }
      />

      {/* feedback 层：源错误在刷新后出现/消失时高度展开/收起，下方网格不跳 */}
      <MarketSourceErrors statuses={sourceStatuses} />

      {/* 搜索与它过滤的网格是同一区块：block */}
      <Flex direction="column" gap="4">
      <MarketSearch
        value={search}
        onChange={setSearch}
        placeholder={t("market.search_placeholder", "Search themes, authors or sources")}
        size="3"
        className="km-market-themes-toolbar"
        iconSize={17}
      />

      {/* 占位卡片数 -> 真实主题数、搜索过滤：网格高度弹簧过渡（卡片 layout 只补位置） */}
      <AutoHeight>
      {listThemes.length === 0 ? (
        <Flex direction="column" align="center" justify="center" className="py-km-hero" gap="2">
          <ImageIcon size={42} className="text-gray-400" />
          <Text color="gray">{t("market.no_themes", "No themes found")}</Text>
        </Flex>
      ) : (
        <Grid columns={{ initial: "1", sm: "2", lg: "3", xl: "4" }} gap="4" className="km-market-themes-list">
          {/* content 层：过滤/搜索时卡片 layout 跟随，进出场淡入淡出 */}
          <AnimatePresence initial={false} mode="popLayout">
          {listThemes.map((theme, index) => {
            const { key, isInstalled, hasUpdate, isActive, isInstallable } = themeState(theme);
            // 占位卡片包成同尺寸的色块；真实卡片直接是列表子元素
            return placeholderCard(loading, key, (
              // content 层：卡片 layout 跟随过滤，hover 先行抬升，DOM 仍是单张 Card
              <MotionThemeCard
                key={key}
                // 只补间位置：卡片含预览图与文字，尺寸补间会拉伸
                layout="position"
                // .rt-Card 的全局 transition 含 transform：motion 每帧写 transform 时会被 CSS 再插值一次（拖尾）。
                    // 内联只保留颜色/阴影过渡，位移完全交给 motion 的弹簧。
                    style={{ transition: "box-shadow var(--km-dur-base) var(--km-ease-standard), background-color var(--km-dur-fast) var(--km-ease-standard)" }}
                className="km-market-theme-card h-full overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                initial={reducedMotion ? false : { ...CONTENT_MOTION.item.initial }}
                animate={CONTENT_MOTION.item.animate}
                // 占位卡片没有退场：数据到达的那一帧直接让位给真实卡片，网格不会短暂多出几排
                exit={loading ? undefined : { opacity: 0, scale: 0.97 }}
                transition={{
                  layout: MOTION_SPRING.layout,
                  opacity: MOTION_TRANSITION.fadeIn,
                  scale: MOTION_SPRING.layout,
                  y: MOTION_SPRING.layout,
                  delay: reducedMotion ? 0 : CONTENT_MOTION.stagger(index),
                }}
                whileHover={
                  reducedMotion || loading
                    ? undefined
                    : { ...CONTENT_MOTION.hover, transition: MOTION_SPRING.snappy }
                }
                onClick={() => setSelectedTheme(theme)}
              >
                <Box className="aspect-video bg-gray-3 overflow-hidden relative">
                  {/* 预览区骨架形状：只在骨架期间可见 */}
                  <span aria-hidden className="km-skeleton-shape absolute inset-0" style={{ backgroundColor: "currentColor" }} />
                  {theme.preview ? (
                    <img
                      src={theme.preview}
                      alt={displayText(theme.name)}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <Flex align="center" justify="center" className="h-full"><ImageIcon size={40} /></Flex>
                  )}
                  {isActive && <Badge className="absolute top-2 right-2" color="green" variant="solid">{t("theme.active", "Active")}</Badge>}
                </Box>
                <Flex direction="column" gap="2" p="4">
                  <Box>
                    <Flex justify="between" align="start" gap="2">
                      <Text weight="bold" size="3">{displayText(theme.name)}</Text>
                      <IconButton asChild size="1" variant="ghost" title={t("market.project_page", "Project page")} onClick={(event) => event.stopPropagation()}>
                        <a href={theme.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>
                      </IconButton>
                    </Flex>
                    <Text as="div" size="1" color="gray" mt="1">
                      {displayText(theme.author)} · v{theme.version}
                    </Text>
                  </Box>
                  <Text as="p" size="2" color="gray" className="min-h-10 line-clamp-2">
                    {displayText(theme.description)}
                  </Text>
                  <Flex justify="between" align="center" gap="2" wrap="wrap">
                    <Box>
                      {isInstalled && (
                        // feedback 层：安装/更新状态真的翻转时才翻一下
                        <StatusFeedback state={hasUpdate}>
                          <Badge color={hasUpdate ? "orange" : "green"} variant="soft">
                            {hasUpdate
                              ? t("market.update_available", "Update available")
                              : t("market.installed", "Installed")}
                          </Badge>
                        </StatusFeedback>
                      )}
                      {!isInstalled && !isInstallable && (
                        <Badge color="gray" variant="soft">{t("market.install_unavailable", "Package unavailable")}</Badge>
                      )}
                    </Box>
                    <Flex gap="1" wrap="wrap" justify="end" onClick={(event) => event.stopPropagation()}>
                      {!isInstalled && isInstallable && (
                        <Button size="1" onClick={() => installTheme(theme)} disabled={installing === key}>
                          {installing === key ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                          {t("market.install", "Install")}
                        </Button>
                      )}
                      {hasUpdate && isInstallable && (
                        <Button size="1" onClick={() => installTheme(theme)} disabled={installing === key}>
                          {installing === key ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          {t("common.update", "Update")}
                        </Button>
                      )}
                      {isInstalled && !isActive && (
                        <Button size="1" variant="soft" onClick={() => setActiveTheme(theme)} disabled={settingTheme === theme.short}>
                          <Settings2 size={14} />{t("theme.set_active", "Set theme")}
                        </Button>
                      )}
                      {isInstalled && (
                        <Button size="1" variant="soft" color="red" onClick={() => setThemeToUninstall(theme)} disabled={deletingTheme === theme.short}>
                          <Trash2 size={14} />{t("market.uninstall", "Uninstall")}
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                </Flex>
              </MotionThemeCard>
            ));
          })}
          </AnimatePresence>
        </Grid>
      )}
      </AutoHeight>
      </Flex>

      <Dialog.Root open={Boolean(selectedTheme)} onOpenChange={(open) => { if (!open) setSelectedTheme(null); }}>
        <Dialog.Content maxWidth="820px">
          <Dialog.Title>{selectedTheme ? displayText(selectedTheme.name) : ""}</Dialog.Title>
          <Dialog.Description className="sr-only">{selectedTheme ? displayText(selectedTheme.description) : ""}</Dialog.Description>
          {selectedTheme && (() => {
            const { key, installedVersion, isInstalled, hasUpdate, isActive, isInstallable } = themeState(selectedTheme);
            return (
              <>
                <Box className="aspect-video bg-gray-3 overflow-hidden">
                  {selectedTheme.preview ? (
                    <img src={selectedTheme.preview} alt={displayText(selectedTheme.name)} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                  ) : (
                    <Flex align="center" justify="center" className="h-full"><ImageIcon size={56} /></Flex>
                  )}
                </Box>
                <Flex direction="column" gap="2" mt="4">
                  <Text size="2" color="gray">{displayText(selectedTheme.description)}</Text>
                  <Flex gap="2" wrap="wrap">
                    <Badge variant="soft">{displayText(selectedTheme.author)}</Badge>
                    <Badge variant="soft">v{selectedTheme.version}</Badge>
                    {installedVersion && <Badge color="green" variant="soft">{t("market.installed_version", "Installed v{{version}}", { version: installedVersion })}</Badge>}
                    {!isInstalled && !isInstallable && <Badge color="gray" variant="soft">{t("market.install_unavailable", "Package unavailable")}</Badge>}
                  </Flex>
                  <Text size="2"><Text weight="bold">{t("market.source", "Source")}:</Text> {selectedTheme.source_name}</Text>
                  <a href={selectedTheme.url} target="_blank" rel="noreferrer" className="text-sm text-blue-9 inline-flex items-center gap-1 w-fit">
                    {t("market.project_page", "Project page")}<ExternalLink size={14} />
                  </a>
                </Flex>
                <Flex justify="end" gap="2" mt="5" wrap="wrap">
                  <Dialog.Close><Button variant="soft" color="gray">{t("common.close", "Close")}</Button></Dialog.Close>
                  {!isInstalled && isInstallable && (
                    <Button onClick={() => installTheme(selectedTheme)} disabled={installing === key}>
                      <Download size={15} />{t("market.install", "Install")}
                    </Button>
                  )}
                  {hasUpdate && isInstallable && (
                    <Button onClick={() => installTheme(selectedTheme)} disabled={installing === key}>
                      <RefreshCw size={15} />{t("common.update", "Update")}
                    </Button>
                  )}
                  {isInstalled && !isActive && (
                    <Button variant="soft" onClick={() => setActiveTheme(selectedTheme)} disabled={settingTheme === selectedTheme.short}>
                      <Settings2 size={15} />{t("theme.set_active", "Set theme")}
                    </Button>
                  )}
                  {isInstalled && (
                    <Button color="red" variant="soft" onClick={() => setThemeToUninstall(selectedTheme)} disabled={deletingTheme === selectedTheme.short}>
                      <Trash2 size={15} />{t("market.uninstall", "Uninstall")}
                    </Button>
                  )}
                </Flex>
              </>
            );
          })()}
        </Dialog.Content>
      </Dialog.Root>

      <MarketSourcesDialog state={sourcesState} />

      <MarketConfirmDialog
        open={Boolean(themeToUninstall)}
        onClose={() => setThemeToUninstall(null)}
        title={t("market.uninstall", "Uninstall")}
        description={t("market.uninstall_confirm", "Uninstall {{name}}?", { name: themeToUninstall ? displayText(themeToUninstall.name) : "" })}
        confirmText={t("market.uninstall", "Uninstall")}
        disabled={!themeToUninstall || deletingTheme === themeToUninstall.short}
        spinning={Boolean(deletingTheme)}
        onConfirm={async () => {
          if (!themeToUninstall) return;
          await uninstallTheme(themeToUninstall);
          setThemeToUninstall(null);
        }}
      />

      <MarketSourceDeleteDialog state={sourcesState} />
    </div>
  );
}
