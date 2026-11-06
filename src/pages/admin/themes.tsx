import { useTranslation } from "react-i18next";
import {
  Text,
  Button,
  Grid,
  Flex,
} from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CONTENT_MOTION,
  CONTROL_MOTION,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { Skeletonize } from "@/components/ui/skeleton";
import {
  Upload,
  Settings,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAdminNavigation } from "@/contexts/AdminNavigationContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useRouteQuery } from "@/lib/routeData";
import {
  currentThemeQuery,
  fetchCurrentTheme,
  installedThemesQuery,
  rememberActiveTheme,
} from "@/routeQueries/appearance";
import UploadDialog from "@/components/UploadDialog";
import { useZipUpload } from "@/components/useZipUpload";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";
import PageHeader from "@/components/PageHeader";
import { PLACEHOLDER_THEMES, type Theme, type ThemeImportPreview } from "./themes/types";
import {
  deleteInstalledTheme,
  fetchInstalledThemes,
  importThemeFromUrl,
  setThemeActive,
  updateThemeFromSource,
} from "./themes/api";
import { useActiveThemeHasConfig } from "./themes/useActiveThemeHasConfig";
import ThemeCard from "./themes/ThemeCard";
import ThemePreviewDialog from "./themes/ThemePreviewDialog";
import ThemeDeleteDialog from "./themes/ThemeDeleteDialog";
import ThemeUpdateDialog from "./themes/ThemeUpdateDialog";
import ThemeImportDialog from "./themes/ThemeImportDialog";

const ThemePage = () => {
  const { t, i18n } = useTranslation();
  // 页面切换时主题列表与当前主题已由 routePreload 提前请求；等待预算内到达直接显示，否则骨架
  const themesResult = useRouteQuery(installedThemesQuery);
  const settingsResult = useRouteQuery(currentThemeQuery);
  const setInstalledThemes = themesResult.setData;
  const [settingTheme, setSettingTheme] = useState<string | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [themeToDelete, setThemeToDelete] = useState<Theme | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [themeToUpdate, setThemeToUpdate] = useState<Theme | null>(null);
  const [updating, setUpdating] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importChecking, setImportChecking] = useState(false);
  const [importInstalling, setImportInstalling] = useState(false);
  const [importPreview, setImportPreview] = useState<ThemeImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const setSettings = settingsResult.setData;
  // 与 useSettings().refetch 一致：失败时抛出（调用处 toast）
  const refetchSettings = useCallback(async () => {
    setSettings(await fetchCurrentTheme());
  }, [setSettings]);
  // 设置读取失败时与原来一样按「没有当前主题」处理
  const settingsLoading = settingsResult.data === undefined && !settingsResult.error;
  const currentTheme = settingsResult.data?.theme;
  useEffect(() => rememberActiveTheme(currentTheme), [currentTheme]);
  // 活跃状态由当前主题派生（原来在列表和设置变化后各同步一次）
  const themes = useMemo(
    () =>
      (themesResult.data ?? []).map((theme: Theme) => ({
        ...theme,
        active: theme.short === currentTheme,
      })),
    [themesResult.data, currentTheme],
  );
  const themesLoading = themesResult.data === undefined && !themesResult.error;
  const firstLoadError = themesResult.error
    ? themesResult.error instanceof Error
      ? themesResult.error.message
      : "Failed to fetch themes"
    : null;
  const error = reloadError ?? firstLoadError;
  const navigate = useNavigate();
  const { publicInfo, refresh: refreshPublicInfo } = usePublicInfo();
  const { refreshNavigation } = useAdminNavigation();
  const activeThemeHasConfig = useActiveThemeHasConfig(currentTheme, publicInfo?.theme);
  const language = i18n.resolvedLanguage || i18n.language || "";
  const displayText = useCallback(
    (value: I18nText | undefined) => resolveI18nText(value, language) || "",
    [language],
  );

  const loading = themesLoading || settingsLoading;
  // 上传、更新、删除、导入后重新获取主题列表（直接请求，不显示骨架）
  const fetchThemes = async () => {
    try {
      setInstalledThemes(await fetchInstalledThemes());
    } catch (err) {
      setReloadError(err instanceof Error ? err.message : "Failed to fetch themes");
    }
  };

  // 上传主题
  const {
    uploading,
    uploadProgress,
    uploadDialogOpen,
    setUploadDialogOpen,
    upload: uploadTheme,
    cancelUpload,
  } = useZipUpload({
    purpose: "theme",
    invalidTypeText: t("theme.invalid_file_type"),
    successText: t("theme.upload_success"),
    failedText: t("theme.upload_failed"),
    onUploaded: fetchThemes,
  });

  // 设置主题
  const setActiveTheme = async (themeShort: string) => {
    try {
      setSettingTheme(themeShort);

      // 先调用 API 设置主题
      await setThemeActive(themeShort);

      // 刷新 settings 以获取最新的主题设置
      await refetchSettings();
      await refreshPublicInfo();
      refreshNavigation();

      // 列表中的活跃状态随 refetchSettings 后的当前主题更新

      toast.success(t("theme.set_success"));
    } catch (err) {
      toast.error(
        t("theme.set_failed") +
          ": " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setSettingTheme(null);
    }
  };

  // 更新主题
  const updateTheme = async (themeShort: string) => {
    try {
      setUpdating(true);

      await updateThemeFromSource(themeShort);

      // 重新获取主题列表
      await fetchThemes();
      if (themeShort === currentTheme) {
        await refreshPublicInfo();
        refreshNavigation();
      }

      setUpdateDialogOpen(false);
      setPreviewDialogOpen(false);
      toast.success(t("theme.update_success"));
    } catch (err) {
      toast.error(
        t("theme.update_failed") +
          ": " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setUpdating(false);
    }
  };

  // 删除主题
  const deleteTheme = async (themeShort: string) => {
    try {
      // 如果删除的是当前活跃主题，先切换到默认主题
      if (themeShort === currentTheme) {
        await setActiveTheme("default");
        await refetchSettings();
      }

      await deleteInstalledTheme(themeShort);

      // 重新获取主题列表
      await fetchThemes();

      setDeleteDialogOpen(false);
      setPreviewDialogOpen(false);
      toast.success(t("theme.delete_success"));
    } catch (err) {
      toast.error(
        t("theme.delete_failed") +
          ": " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    }
  };

  // 预览导入主题
  const previewImportTheme = async () => {
    if (!importUrl.trim()) return;
    setImportChecking(true);
    setImportPreview(null);
    setImportError(null);
    try {
      const data = await importThemeFromUrl(importUrl.trim(), true, t("theme.import_failed"));
      setImportPreview(data?.data ?? null);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : t("theme.import_failed"),
      );
    } finally {
      setImportChecking(false);
    }
  };

  // 确认导入主题
  const confirmImportTheme = async () => {
    if (!importUrl.trim()) return;
    setImportInstalling(true);
    try {
      const data = await importThemeFromUrl(importUrl.trim(), false, t("theme.import_failed"));
      toast.success(data?.message || t("theme.import_success"));
      setImportDialogOpen(false);
      setImportUrl("");
      setImportPreview(null);
      setImportError(null);
      await fetchThemes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("theme.import_failed"),
      );
    } finally {
      setImportInstalling(false);
    }
  };

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  // 页头直接渲染；主题未到时用占位主题渲染同样的卡片网格，每张卡片是一块色块，数据到达后真实卡片入场
  const listThemes = loading ? PLACEHOLDER_THEMES : themes;

  return (
    // 外边距由后台内容区统一提供（与 settings/_layout 一样不再自带 padding），区块之间 section
    <div className="km-page km-page-admin-settings-theme">
      <PageHeader
        title={t("theme.title")}
        actions={
          <>
          {/* control 层：当前主题有配置时「主题设置」按钮弹出（检测是异步的，不再突然插进工具栏） */}
          <AnimatePresence initial={false}>
          {activeThemeHasConfig && (
            <motion.div
              key="theme-settings"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ scale: CONTROL_MOTION.transition, opacity: MOTION_TRANSITION.fade }}
            >
            <Button
              variant="soft"
              className="gap-2"
              onClick={() => navigate("/admin/theme_managed")}
            >
              <Settings size={16} />
              {t("theme.settings_with_name", { name: currentTheme })}
            </Button>
            </motion.div>
          )}
          </AnimatePresence>
          <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
            <Upload size={16} />
            {t("theme.upload")}
          </Button>
          <Button
            variant="soft"
            onClick={() => {
              setImportDialogOpen(true);
              setImportUrl("");
              setImportPreview(null);
              setImportError(null);
            }}
            className="gap-2"
          >
            <Download size={16} />
            {t("theme.import")}
          </Button>
          </>
        }
      />

      {/* 主题卡片网格 */}
      {listThemes.length === 0 ? (
        <Flex direction="column" align="center" gap="2" className="text-center py-km-hero">
          <ImageIcon size={64} className="text-gray-400 mb-km-group" />
          <Text size="4" color="gray">
            {t("theme.no_themes")}
          </Text>
          <Text size="2" color="gray">
            {t("theme.upload_first_theme")}
          </Text>
        </Flex>
      ) : (
        <Grid columns={{ initial: "1", sm: "2", md: "3", lg: "4" }} gap="4">
          {/*
            content 性格：主题卡片网格。父级带 layout，子卡片进场/退场用同一套弹簧；
            上传、删除、更新后列表变化时，其余卡片会先平移让位（Follow-through），
            而不是整块网格重新闪现。popLayout 让退场卡片脱离文档流，避免网格抖动。
          */}
          <AnimatePresence initial={false} mode="popLayout">
          {listThemes.map((theme, index) => (
            <motion.div
              key={theme.id}
              // 只补间位置：卡片里有大段文字与预览图，尺寸补间会把它们拉伸
              layout="position"
              initial={CONTENT_MOTION.item.initial}
              animate={{
                ...CONTENT_MOTION.item.animate,
                transition: {
                  y: MOTION_SPRING.layout,
                  scale: MOTION_SPRING.layout,
                  opacity: MOTION_TRANSITION.fade,
                  // 错峰有上限：主题很多时最后几张也不排队（Timing）
                  delay: Math.min(index * CONTENT_MOTION.stagger(1), 0.22),
                },
              }}
              // 占位卡片没有退场：数据到达的那一帧直接让位给真实卡片（真实卡片入场），网格不会短暂多出一排
              exit={loading ? undefined : {
                ...CONTENT_MOTION.item.exit,
                transition: CONTENT_MOTION.exitTransition,
              }}
              whileHover={loading ? undefined : { y: CONTENT_MOTION.hover.y, transition: CONTROL_MOTION.transition }}
              // 不对整张大卡片做按压缩放：大面积 scale 会让标题与预览图发虚（反馈交给 hover 抬升 + 阴影）
              className="h-full"
            >
            {/* 占位卡片：同尺寸的色块（motion.div 仍是列表的直接子元素） */}
            <Skeletonize loading={loading} className="km-setting-card-skeleton h-full">
            <ThemeCard
              theme={theme}
              displayText={displayText}
              settingTheme={settingTheme}
              setPreviewDialogOpen={setPreviewDialogOpen}
              setSelectedTheme={setSelectedTheme}
              setActiveTheme={setActiveTheme}
            />
            </Skeletonize>
            </motion.div>
          ))}
          </AnimatePresence>
        </Grid>
      )}

      {/* 上传对话框 */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title={t("theme.upload")}
        description={t("theme.upload_description")}
        accept=".zip"
        dragDropText={t("theme.drag_drop")}
        clickToBrowseText={t("theme.or_click_to_browse")}
        hintText={t("theme.zip_files_only")}
        uploading={uploading}
        progress={uploadProgress}
        uploadingText={t("theme.uploading")}
        cancelUploadLabel={t("common.cancel")}
        onCancelUpload={cancelUpload}
        onFileSelected={(file) => uploadTheme(file)}
        closeLabel={t("common.cancel")}
      />

      {/* 预览对话框 */}
      <ThemePreviewDialog
        previewDialogOpen={previewDialogOpen}
        setPreviewDialogOpen={setPreviewDialogOpen}
        selectedTheme={selectedTheme}
        displayText={displayText}
        setActiveTheme={setActiveTheme}
        setThemeToUpdate={setThemeToUpdate}
        setUpdateDialogOpen={setUpdateDialogOpen}
        setThemeToDelete={setThemeToDelete}
        setDeleteDialogOpen={setDeleteDialogOpen}
      />

      {/* 删除确认对话框 */}
      <ThemeDeleteDialog
        deleteDialogOpen={deleteDialogOpen}
        setDeleteDialogOpen={setDeleteDialogOpen}
        themeToDelete={themeToDelete}
        setThemeToDelete={setThemeToDelete}
        currentTheme={currentTheme}
        displayText={displayText}
        deleteTheme={deleteTheme}
      />

      {/* 更新主题对话框 */}
      <ThemeUpdateDialog
        updateDialogOpen={updateDialogOpen}
        setUpdateDialogOpen={setUpdateDialogOpen}
        themeToUpdate={themeToUpdate}
        setThemeToUpdate={setThemeToUpdate}
        updating={updating}
        updateTheme={updateTheme}
      />

      {/* 导入主题对话框 */}
      <ThemeImportDialog
        importDialogOpen={importDialogOpen}
        setImportDialogOpen={setImportDialogOpen}
        importUrl={importUrl}
        setImportUrl={setImportUrl}
        importPreview={importPreview}
        setImportPreview={setImportPreview}
        importError={importError}
        setImportError={setImportError}
        importChecking={importChecking}
        importInstalling={importInstalling}
        previewImportTheme={previewImportTheme}
        confirmImportTheme={confirmImportTheme}
        displayText={displayText}
      />

      <label className="text-muted-foreground text-sm">
        {t("theme.find_more")}
        <a
          href="/admin/market/themes"
          className="text-accent-9"
        >
          {t("market.themes")}
        </a>
      </label>
    </div>
  );
};

export default ThemePage;
