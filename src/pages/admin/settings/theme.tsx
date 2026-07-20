import { useTranslation } from "react-i18next";
import {
  Text,
  Card,
  Button,
  Grid,
  Box,
  Flex,
  Dialog,
  Badge,
  IconButton,
  TextField,
  Callout,
  Separator,
} from "@radix-ui/themes";
import { useState, useEffect } from "react";
import {
  Upload,
  Settings,
  Image as ImageIcon,
  RefreshCw,
  SquareArrowOutUpRight,
  Download,
  Search,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import Loading from "@/components/loading";
import { useSettings } from "@/lib/api";
import UploadDialog from "@/components/UploadDialog";
import {
  getThemeConfigurationType,
  THEME_CONFIGURATION_MANAGED,
} from "@/utils/themeConfiguration";

interface Theme {
  id: string;
  name: string;
  short: string;
  description: string;
  author: string;
  version: string;
  preview?: string;
  url?: string;
  active: boolean;
  createdAt: string;
  configuration?: any;
}

const ThemePage = () => {
  const { t } = useTranslation();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themesLoading, setThemesLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadXhr, setUploadXhr] = useState<XMLHttpRequest | null>(null);
  const [settingTheme, setSettingTheme] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
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
  const [importPreview, setImportPreview] = useState<{
    theme: Omit<Theme, "id" | "active" | "createdAt">;
    exists: boolean;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const {
    settings,
    loading: settingsLoading,
    refetch: refetchSettings,
  } = useSettings();
  const currentTheme = settings?.theme;
  const navigate = useNavigate();
  const { publicInfo } = usePublicInfo();
  const [activeThemeHasConfig, setActiveThemeHasConfig] = useState(false);

  // 当 currentTheme 或 publicInfo.theme 变化时重新检测当前主题是否有配置文件
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const themeShort = currentTheme || publicInfo?.theme;
      if (!themeShort) {
        setActiveThemeHasConfig(false);
        return;
      }
      try {
        // 强制不缓存
        const resp = await fetch(`/themes/${themeShort}/komari-theme.json`, {
          cache: "no-cache",
        });
        if (!resp.ok) {
          setActiveThemeHasConfig(false);
          return;
        }
        const data = await resp.json().catch(() => null);
        if (
          !cancelled &&
          data &&
          data.configuration &&
          getThemeConfigurationType(data.configuration) ===
            THEME_CONFIGURATION_MANAGED &&
          Array.isArray(data.configuration.data) &&
          data.configuration.data.length > 0
        ) {
          setActiveThemeHasConfig(true);
        } else if (!cancelled) {
          setActiveThemeHasConfig(false);
        }
      } catch {
        if (!cancelled) setActiveThemeHasConfig(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [currentTheme, publicInfo?.theme]);

  const loading = themesLoading || settingsLoading || !currentTheme;
  // 获取主题列表
  const fetchThemes = async () => {
    try {
      const response = await fetch("/api/admin/theme/list");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const themeList = data.data || [];

      // 根据 settings 中的 theme 设置活跃状态
      const updatedThemes = themeList.map((theme: Theme) => ({
        ...theme,
        active: theme.short === currentTheme,
      }));

      setThemes(updatedThemes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch themes");
    } finally {
      setThemesLoading(false);
    }
  };

  // 上传主题
  const uploadTheme = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      toast.error(t("theme.invalid_file_type"));
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      setUploadXhr(xhr);

      // 监听上传进度
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(Math.round(percentComplete));
        }
      });

      // 监听请求完成
      xhr.addEventListener("load", async () => {
        if (xhr.status === 413) {
          toast.error(t("theme.uploda_413_content_too_large"));
          setUploading(false);
          setUploadProgress(0);
          setUploadXhr(null);
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // 检查响应是否成功
            JSON.parse(xhr.responseText);
            toast.success(t("theme.upload_success"));
            setUploadDialogOpen(false);
            setUploadProgress(0);
            await fetchThemes();
            resolve();
          } catch (err) {
            toast.error(t("theme.upload_failed") + ": Parse error");
            reject(err);
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            throw new Error(errorData.message || "Upload failed");
          } catch (err) {
            toast.error(
              t("theme.upload_failed") +
                ": " +
                (err instanceof Error ? err.message : "Unknown error"),
            );
            reject(err);
          }
        }
        setUploading(false);
        setUploadXhr(null);
      });

      // 监听错误
      xhr.addEventListener("error", () => {
        toast.error(t("theme.upload_failed") + ": Network error");
        setUploading(false);
        setUploadProgress(0);
        setUploadXhr(null);
        reject(new Error("Network error"));
      });

      // 监听中断
      xhr.addEventListener("abort", () => {
        toast.error(t("theme.upload_failed") + ": Upload cancelled");
        setUploading(false);
        setUploadProgress(0);
        setUploadXhr(null);
        reject(new Error("Upload cancelled"));
      });

      // 发送请求
      xhr.open("PUT", "/api/admin/theme/upload");
      xhr.send(formData);
    });
  };

  // 取消上传
  const cancelUpload = () => {
    if (uploadXhr) {
      uploadXhr.abort();
    }
  };

  // 设置主题
  const setActiveTheme = async (themeShort: string) => {
    try {
      setSettingTheme(themeShort);

      // 先调用 API 设置主题
      const response = await fetch(`/api/admin/theme/set?theme=${themeShort}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 刷新 settings 以获取最新的主题设置
      await refetchSettings();

      // 更新主题列表中的活跃状态
      setThemes((prevThemes) =>
        prevThemes.map((theme) => ({
          ...theme,
          active: theme.short === themeShort,
        })),
      );

      const theme = themes.find((t) => t.short === themeShort);
      console.log(theme);
      if (
        theme &&
        getThemeConfigurationType(theme.configuration) ===
          THEME_CONFIGURATION_MANAGED &&
        Array.isArray(theme.configuration.data) &&
        theme.configuration.data.length > 0
      ) {
        window.location.reload();
      }

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

      const requestBody = { short: themeShort, useOriginalUrl: true };

      const response = await fetch("/api/admin/theme/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Update failed");
      }

      // 重新获取主题列表
      await fetchThemes();

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

      const response = await fetch("/api/admin/theme/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ short: themeShort }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Delete failed");
      }

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
      const response = await fetch("/api/admin/theme/import?preview=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok || data.status === "error") {
        setImportError(data.message || t("theme.import_failed"));
        return;
      }
      setImportPreview(data.data);
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
      const response = await fetch("/api/admin/theme/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok || data.status === "error") {
        toast.error(data.message || t("theme.import_failed"));
        return;
      }
      toast.success(data.message || t("theme.import_success"));
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

  // 同步活跃状态
  useEffect(() => {
    fetchThemes();
  }, [currentTheme]);

  useEffect(() => {
    if (!settingsLoading && themes.length > 0) {
      setThemes((prevThemes) =>
        prevThemes.map((theme) => ({
          ...theme,
          active: theme.short === currentTheme,
        })),
      );
    }
  }, [currentTheme, settingsLoading, themes.length]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    <Box className="p-6 space-y-6">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Text size="6" weight="bold">
          {t("theme.title")}
        </Text>
        <Flex gap="2">
          {activeThemeHasConfig && (
            <Button
              variant="soft"
              className="gap-2"
              onClick={() => navigate("/admin/theme_managed")}
            >
              <Settings size={16} />
              {`${currentTheme}设置`}
            </Button>
          )}
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
        </Flex>
      </Flex>

      {/* 主题卡片网格 */}
      {themes.length === 0 ? (
        <Box className="text-center py-12">
          <ImageIcon size={64} className="mx-auto text-gray-400 mb-4" />
          <Text size="4" color="gray" className="mb-2">
            {t("theme.no_themes")}
          </Text>
          <Text size="2" color="gray">
            {t("theme.upload_first_theme")}
          </Text>
        </Box>
      ) : (
        <Grid columns={{ initial: "1", sm: "2", md: "3", lg: "4" }} gap="4">
          {themes.map((theme) => (
            <Card
              key={theme.id}
              className="relative group hover:shadow-lg transition-all duration-200"
            >
              <Box
                onClick={() => {
                  setPreviewDialogOpen(true);
                  setSelectedTheme(theme);
                }}
                className="aspect-video bg-gradient-to-br rounded-t-lg overflow-hidden relative "
              >
                {theme.preview ? (
                  <img
                    src={`/themes/${theme.short}/${theme.preview}`}
                    alt={theme.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove(
                        "hidden",
                      );
                    }}
                  />
                ) : null}
                <Flex
                  align="center"
                  justify="center"
                  className={`w-full h-full ${theme.preview ? "hidden" : ""}`}
                >
                  <ImageIcon size={48} className="text-gray-400" />
                </Flex>
                {/* 覆盖层 */}
                <Box className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <Flex gap="2">{/* 预留操作位 */}</Flex>
                </Box>

                {/* 活跃状态指示器 */}
                {theme.active && (
                  <Badge
                    color="green"
                    className="absolute top-2 right-2 px-2 py-1 text-xs"
                  >
                    {t("theme.active")}
                  </Badge>
                )}
              </Box>

              <Flex
                onClick={() => {
                  setPreviewDialogOpen(true);
                  setSelectedTheme(theme);
                }}
                direction="column"
                className="p-4 space-y-2"
              >
                <Text weight="bold" size="3">
                  {theme.name}
                </Text>
                <Flex justify="between" align="center">
                  <Text size="1" color="gray">
                    by {theme.author}
                  </Text>
                  <Text size="1" color="gray">
                    v{theme.version}
                  </Text>
                </Flex>
              </Flex>
              <Flex justify="end" align="center">
                {!theme.active && (
                  <IconButton
                    size="2"
                    variant="ghost"
                    onClick={() => setActiveTheme(theme.short)}
                    disabled={settingTheme === theme.short}
                  >
                    {settingTheme === theme.short ? (
                      <Box className="animate-spin">
                        <Settings size={16} />
                      </Box>
                    ) : (
                      <Settings size={16} />
                    )}
                  </IconButton>
                )}
              </Flex>
            </Card>
          ))}
        </Grid>
      )}

      {/* 上传对话框 */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title={t("theme.upload_theme")}
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
      <Dialog.Root open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <Dialog.Content maxWidth="800px">
          <Dialog.Title>{selectedTheme?.name}</Dialog.Title>

          <Box className="space-y-4 mt-4">
            <Box className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative">
              {selectedTheme?.preview ? (
                <img
                  src={`/themes/${selectedTheme.short}/${selectedTheme.preview}`}
                  alt={selectedTheme.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Flex align="center" justify="center" className="w-full h-full">
                  <ImageIcon size={64} className="text-gray-400" />
                </Flex>
              )}
            </Box>

            <Flex direction="column">
              <Flex gap="2" justify="start" align="center">
                <Text size="2" weight="bold" color="gray" wrap="nowrap">
                  {t("theme.author")}
                </Text>
                <Text size="3">{selectedTheme?.author}</Text>
              </Flex>
              <Flex gap="2" justify="start" align="center">
                <Text size="2" weight="bold" color="gray" wrap="nowrap">
                  {t("theme.version")}
                </Text>
                <Text size="3">{selectedTheme?.version}</Text>
              </Flex>
              <Flex gap="2" justify="start" align="center">
                <Text size="2" weight="bold" color="gray" wrap="nowrap">
                  {t("theme.description")}
                </Text>
                <Text size="3">{selectedTheme?.description}</Text>
              </Flex>
              {selectedTheme?.url && (
                <Flex gap="2" justify="start" align="center">
                  <Text size="2" weight="bold" color="gray" wrap="nowrap">
                    URL
                  </Text>
                  <Text size="1" className="overflow-hidden text-ellipsis">
                    {selectedTheme?.url}
                  </Text>
                  <a href={selectedTheme.url} target="_blank">
                    <SquareArrowOutUpRight size={12} />
                  </a>
                </Flex>
              )}
            </Flex>
          </Box>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t("common.close")}
              </Button>
            </Dialog.Close>
            {selectedTheme && !selectedTheme.active && (
              <Button
                onClick={() => {
                  setActiveTheme(selectedTheme.short);
                  setPreviewDialogOpen(false);
                }}
              >
                {t("theme.set_active")}
              </Button>
            )}
            {selectedTheme && selectedTheme.short !== "default" && (
              <Button
                variant="soft"
                color="blue"
                onClick={() => {
                  setThemeToUpdate(selectedTheme);
                  setUpdateDialogOpen(true);
                }}
                className="gap-2"
              >
                <RefreshCw size={16} />
                {t("theme.update")}
              </Button>
            )}
            {selectedTheme && selectedTheme.short !== "default" && (
              <Button
                size="2"
                variant="solid"
                color="red"
                onClick={() => {
                  setThemeToDelete(selectedTheme);
                  setDeleteDialogOpen(true);
                }}
              >
                {t("common.delete")}
              </Button>
            )}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* 删除确认对话框 */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>{t("theme.confirm_delete")}</Dialog.Title>
          <Dialog.Description>
            {t("theme.delete_warning", { themeName: themeToDelete?.name })}
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t("common.cancel")}
              </Button>
            </Dialog.Close>
            <Button
              color="red"
              onClick={async () => {
                if (themeToDelete) {
                  await deleteTheme(themeToDelete.short);
                  setDeleteDialogOpen(false);
                  setThemeToDelete(null);
                }
              }}
            >
              {t("common.delete")}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* 更新主题对话框 */}
      <Dialog.Root open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <Dialog.Content maxWidth="500px">
          <Dialog.Title>{t("theme.update_theme")}</Dialog.Title>
          <Dialog.Description>
            {t("theme.update_description")}
          </Dialog.Description>

          <Box className="space-y-4 mt-4">
            {/* Auto Mode Explanation */}
            <Flex direction="column" gap="2">
              <Text size="2" color="gray" className="mt-2">
                {t("theme.update_mode_auto_description")}
              </Text>
            </Flex>
          </Box>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t("common.cancel")}
              </Button>
            </Dialog.Close>
            <Button
              color="blue"
              disabled={updating}
              onClick={async () => {
                if (themeToUpdate) {
                  await updateTheme(themeToUpdate.short);
                  setUpdateDialogOpen(false);
                  setThemeToUpdate(null);
                }
              }}
            >
              {updating ? (
                <Box className="animate-spin mr-2">
                  <RefreshCw size={16} />
                </Box>
              ) : null}
              {t("theme.update")}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* 导入主题对话框 */}
      <Dialog.Root
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) {
            setImportUrl("");
            setImportPreview(null);
            setImportError(null);
          }
        }}
      >
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>{t("theme.import_title")}</Dialog.Title>
          <Dialog.Description>
            {t("theme.import_description")}
          </Dialog.Description>

          <Box className="space-y-4 mt-4">
            <Flex gap="2">
              <Box className="flex-1">
                <TextField.Root
                  placeholder="https://github.com/owner/repo"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !importChecking) {
                      previewImportTheme();
                    }
                  }}
                  disabled={importChecking || importInstalling}
                />
              </Box>
              <Button
                onClick={previewImportTheme}
                disabled={
                  !importUrl.trim() || importChecking || importInstalling
                }
                className="gap-2"
              >
                {importChecking ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                {t("theme.import_check")}
              </Button>
            </Flex>

            {importError && (
              <Callout.Root color="red" size="1">
                <Callout.Icon>
                  <AlertTriangle size={16} />
                </Callout.Icon>
                <Callout.Text>{importError}</Callout.Text>
              </Callout.Root>
            )}

            {importPreview && (
              <Box>
                <Separator size="4" className="my-3" />
                <Card className="p-4">
                  <Flex direction="column" gap="2">
                    <Flex gap="2" align="center">
                      <Text size="2" weight="bold" color="gray" wrap="nowrap">
                        {t("theme.name")}
                      </Text>
                      <Text size="3" weight="bold">
                        {importPreview.theme.name}
                      </Text>
                    </Flex>
                    <Flex gap="2" align="center">
                      <Text size="2" weight="bold" color="gray" wrap="nowrap">
                        {t("theme.version")}
                      </Text>
                      <Text size="3">{importPreview.theme.version}</Text>
                    </Flex>
                    <Flex gap="2" align="center">
                      <Text size="2" weight="bold" color="gray" wrap="nowrap">
                        {t("theme.author")}
                      </Text>
                      <Text size="3">{importPreview.theme.author}</Text>
                    </Flex>
                    {importPreview.theme.description && (
                      <Flex gap="2" align="center">
                        <Text
                          size="2"
                          weight="bold"
                          color="gray"
                          wrap="nowrap"
                        >
                          {t("theme.description")}
                        </Text>
                        <Text size="3">
                          {importPreview.theme.description}
                        </Text>
                      </Flex>
                    )}
                  </Flex>

                  {importPreview.exists && (
                    <Callout.Root color="orange" size="1" className="mt-3">
                      <Callout.Icon>
                        <AlertTriangle size={16} />
                      </Callout.Icon>
                      <Callout.Text>
                        {t("theme.import_exists_warning")}
                      </Callout.Text>
                    </Callout.Root>
                  )}
                </Card>
              </Box>
            )}
          </Box>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t("common.cancel")}
              </Button>
            </Dialog.Close>
            {importPreview && (
              <Button
                onClick={confirmImportTheme}
                disabled={importInstalling}
                className="gap-2"
              >
                {importInstalling && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {t("theme.import_confirm")}
              </Button>
            )}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <label className="text-muted-foreground text-sm">
        {t("theme.find_more")}
        <a
          href="/admin/market/themes"
          className="text-accent-9"
        >
          {t("market.themes")}
        </a>
      </label>
    </Box>
  );
};

export default ThemePage;
