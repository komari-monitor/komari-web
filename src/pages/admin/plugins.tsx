import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Callout,
  Flex,
  Tabs,
} from "@radix-ui/themes";
import {
  Blocks,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import { AutoHeight, SlideSwap } from "@/components/motion";
import { skeletonText } from "@/components/ui/skeleton";
import { placeholderCard } from "@/components/ui/placeholderCard";
import PluginConfigDialog from "@/components/admin/PluginConfigDialog";
import PluginPermissionDialog from "@/components/admin/PluginPermissionDialog";
import UploadDialog from "@/components/UploadDialog";
import { useZipUpload } from "@/components/useZipUpload";
import { useAdminNavigation } from "@/contexts/AdminNavigationContext";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useRouteQuery } from "@/lib/routeData";
import { fetchPluginList, pluginsQuery } from "@/routeQueries/appearance";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";
import type { PluginInfo } from "@/types/plugin";
import { KmTabsList } from "@/components/admin/KmTabsList";
import PageHeader from "@/components/PageHeader";
import PluginCard from "./plugins/PluginCard";
import PluginLogsDialog from "./plugins/PluginLogsDialog";
import PluginDeleteDialog from "./plugins/PluginDeleteDialog";

interface SetEnabledResult {
  requires_approval?: boolean;
}

/** 列表骨架：常见的已安装插件数量；只用于展示，不会被操作（Skeletonize 期间 inert） */
const PLACEHOLDER_PLUGINS = Array.from(
  { length: 4 },
  (_, index) =>
    ({
      short: `__km_placeholder_${index}`,
      name: skeletonText(10 + (index % 3) * 3),
      version: skeletonText(5),
      author: skeletonText(8),
      description: skeletonText(36 - (index % 2) * 10),
      enabled: false,
      running: false,
    }) as unknown as PluginInfo,
);

const EMPTY_PLUGINS: PluginInfo[] = [];

// 插件管理：上传 zip、switch 启停、权限确认弹窗、运行日志、行内错误文本。
export default function PluginsPage() {
  const { call } = useRPC2Call();
  const { refreshNavigation } = useAdminNavigation();
  const { t, i18n } = useTranslation();
  const [configPlugin, setConfigPlugin] = useState<PluginInfo | null>(null);
  const language = i18n.resolvedLanguage || i18n.language || "";
  const displayText = useCallback(
    (value: I18nText | undefined) => resolveI18nText(value, language) || "",
    [language],
  );

  // 页面切换时插件列表已由 routePreload 提前请求；等待预算内到达直接显示，否则骨架
  const pluginsResult = useRouteQuery(pluginsQuery);
  const plugins = pluginsResult.data ?? EMPTY_PLUGINS;
  const setPlugins = pluginsResult.setData;
  const [statusFilter, setStatusFilter] = useState("all");
  const [slideDirection, setSlideDirection] = useState(1);
  const reduceMotion = useKmReducedMotion();
  const filteredPlugins = plugins.filter((plugin) =>
    statusFilter === "all" || (statusFilter === "running" ? plugin.running : !plugin.running),
  );
  const changeStatusFilter = (value: string) => {
    const order = ["all", "running", "stopped"];
    setSlideDirection(order.indexOf(value) > order.indexOf(statusFilter) ? 1 : -1);
    setStatusFilter(value);
  };
  const loading = pluginsResult.data === undefined && !pluginsResult.error;
  useEffect(() => {
    const error = pluginsResult.error;
    if (error) toast.error(error instanceof Error ? error.message : String(error));
  }, [pluginsResult.error]);
  const [toggling, setToggling] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PluginInfo | null>(
    null,
  );
  const [logPlugin, setLogPlugin] = useState<PluginInfo | null>(null);
  const [logContent, setLogContent] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [pluginToDelete, setPluginToDelete] = useState<PluginInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 刷新按钮、启停、上传、删除后重新获取（直接请求，不显示骨架）
  const loadList = useCallback(async () => {
    try {
      setPlugins(await fetchPluginList());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }, [setPlugins]);

  const {
    uploading,
    uploadProgress,
    uploadDialogOpen,
    setUploadDialogOpen,
    upload: uploadPlugin,
    cancelUpload,
  } = useZipUpload({
    purpose: "plugin",
    invalidTypeText: t(
      "plugin.invalid_file_type",
      "Invalid file type, only .zip files are supported",
    ),
    successText: t("plugin.uploaded", "Plugin uploaded"),
    failedText: t("plugin.upload_failed", "Plugin upload failed"),
    onUploaded: loadList,
  });

  const toggle = async (plugin: PluginInfo, enabled: boolean) => {
    setToggling(plugin.short);
    try {
      const result = await call<
        { short: string; enabled: boolean },
        SetEnabledResult
      >("admin:setPluginEnabled", {
        short: plugin.short,
        enabled,
      });
      if (enabled && result?.requires_approval) {
        setPendingApproval(plugin);
        return;
      }
      toast.success(
        enabled
          ? t("plugin.enable_success", "Plugin enabled")
          : t("plugin.disable_success", "Plugin disabled"),
      );
      refreshNavigation();
      await loadList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      await loadList(); // 启动失败自动禁用，刷新后行内显示 last_error
    } finally {
      setToggling(null);
    }
  };

  const approveAndEnable = async () => {
    if (!pendingApproval) return;
    const plugin = pendingApproval;
    setPendingApproval(null);
    setToggling(plugin.short);
    try {
      await call("admin:setPluginEnabled", {
        short: plugin.short,
        enabled: true,
        approved: true,
      });
      refreshNavigation();
      toast.success(t("plugin.enable_success", "Plugin enabled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setToggling(null);
      await loadList();
    }
  };

  const openLogs = async (plugin: PluginInfo) => {
    setLogPlugin(plugin);
    setLogContent("");
    setLogsLoading(true);
    try {
      const result = await call<{ short: string }, { logs?: string }>(
        "admin:getPluginLogs",
        {
          short: plugin.short,
        },
      );
      setLogContent(result?.logs || "");
    } catch (error) {
      setLogContent(
        `${t("plugin.logs_load_failed", "Failed to load logs")}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setLogsLoading(false);
    }
  };

  const deletePlugin = async (plugin: PluginInfo) => {
    setDeleting(true);
    try {
      await call("admin:deletePlugin", { short: plugin.short });
      refreshNavigation();
      toast.success(t("plugin.deleted", "Plugin deleted"));
      setPluginToDelete(null);
      await loadList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDeleting(false);
    }
  };

  // 页头、筛选直接渲染；列表未到时用占位插件渲染同样的卡片，每张卡片是一块色块
  const listPlugins = loading ? PLACEHOLDER_PLUGINS : filteredPlugins;

  return (
    // 外边距由后台内容区统一提供；页头 → 筛选+列表 之间 section
    <div className="km-page km-page-admin-plugins">
      <PageHeader
        className="km-plugins-toolbar"
        icon={<Blocks size={20} />}
        title={t("plugin.title", "Plugins")}
        actions={
          <>
          <Button
            onClick={() => setUploadDialogOpen(true)}
            disabled={uploading}
          >
            <Upload size={14} />
            {t("plugin.upload", "Upload Plugin")}
          </Button>
          <Button variant="soft" onClick={loadList}>
            <RefreshCw size={14} />
            {t("common.refresh", "Refresh")}
          </Button>
          </>
        }
      />

      {/* 筛选 Tab 与它服务的插件列表是同一区块：block */}
      <Flex direction="column" gap="4">
      <Tabs.Root value={statusFilter} onValueChange={changeStatusFilter}>
        {/* control 性格：选中下划线在标签间弹簧滑动（共享指示器，可被打断） */}
        <KmTabsList aria-label={t("common.status", "Status")}>
          <Tabs.Trigger value="all">{t("common.all", "All")}</Tabs.Trigger>
          <Tabs.Trigger value="running">{t("exec.status.running", "Running")}</Tabs.Trigger>
          <Tabs.Trigger value="stopped">{t("plugin.stopped", "Stopped")}</Tabs.Trigger>
        </KmTabsList>
      </Tabs.Root>

      {/* 占位卡片数 -> 真实插件数、切换状态筛选：列表高度弹簧过渡 */}
      <AutoHeight className="overflow-x-clip">
        <SlideSwap swapKey={statusFilter} direction={slideDirection} reduceMotion={reduceMotion}>
            {listPlugins.length === 0 ? (
              <Callout.Root>
                <Callout.Text>
                  {plugins.length === 0
                    ? t("plugin.no_plugins", "No plugins installed yet")
                    : t("common.no_data", "No data")}
                </Callout.Text>
              </Callout.Root>
            ) : (
              <Flex direction="column" gap="4" className="km-plugins-list">
                {listPlugins.map((plugin, index) => placeholderCard(loading, plugin.short, (
                  <PluginCard
                    key={plugin.short}
                    plugin={plugin}
                    index={index}
                    reduceMotion={reduceMotion}
                    displayText={displayText}
                    toggling={toggling}
                    onConfigure={setConfigPlugin}
                    onLogs={openLogs}
                    onDelete={setPluginToDelete}
                    onToggle={toggle}
                  />
                ), "w-full"))}
              </Flex>
            )}

        </SlideSwap>
      </AutoHeight>
      </Flex>

      {configPlugin && (
        <PluginConfigDialog
          key={configPlugin.short}
          plugin={configPlugin}
          onClose={() => setConfigPlugin(null)}
          onSaved={() => {
            refreshNavigation();
            void loadList();
          }}
        />
      )}

      {/* 权限确认弹窗 */}
      <PluginPermissionDialog
        plugin={pendingApproval}
        onOpenChange={(open) => {
          if (!open) setPendingApproval(null);
        }}
        onCancel={() => setPendingApproval(null)}
        onApprove={approveAndEnable}
        animated
      />

      {/* 运行日志弹窗 */}
      <PluginLogsDialog
        logPlugin={logPlugin}
        setLogPlugin={setLogPlugin}
        logsLoading={logsLoading}
        logContent={logContent}
      />

      {/* 上传对话框 */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title={t("plugin.upload", "Upload Plugin")}
        description={t(
          "plugin.upload_description",
          "Upload a .zip plugin package",
        )}
        accept=".zip"
        dragDropText={t("plugin.drag_drop", "Drag and drop files here")}
        clickToBrowseText={t(
          "plugin.or_click_to_browse",
          "Or click to browse files",
        )}
        hintText={t("plugin.zip_files_only", "Only .zip files are supported")}
        uploading={uploading}
        progress={uploadProgress}
        uploadingText={t("plugin.uploading", "Uploading...")}
        cancelUploadLabel={t("common.cancel", "Cancel")}
        onCancelUpload={cancelUpload}
        onFileSelected={uploadPlugin}
        closeLabel={t("common.cancel", "Cancel")}
      />

      {/* 删除确认 */}
      <PluginDeleteDialog
        pluginToDelete={pluginToDelete}
        setPluginToDelete={setPluginToDelete}
        deleting={deleting}
        deletePlugin={deletePlugin}
      />
    </div>
  );
}
