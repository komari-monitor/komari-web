import { useTranslation } from "react-i18next";
import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import {
  SettingCardButton,
  SettingCardCollapse,
  SettingCardIconButton,
  SettingCardLabel,
  SettingCardLongTextInput,
  SettingCardShortTextInput,
  SettingCardsLoading,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import { toast } from "sonner";
import { DownloadIcon } from "lucide-react";
import { useRef, useState } from "react";
import UploadDialog from "@/components/UploadDialog";
import { createChunkUploadTask, type ChunkUploadTask } from "@/lib/chunkUpload";
import { HighlightPulse, StaggeredItem, StaggeredList } from "@/components/motion";
import { api, requestJson } from "@/lib/http";
import { useRouteQuery } from "@/lib/routeData";
import { DEFAULT_SETTINGS, settingsErrorText, settingsQuery } from "@/routeQueries/settings";
import { saveSettings, serverError } from "./shared/request";

export default function SiteSettings() {
  const { t } = useTranslation();
  // 页面切换时设置已由 routePreload 提前请求；等待预算内到达直接显示，否则设置卡显示色块
  const settingsResult = useRouteQuery(settingsQuery);
  const settings = settingsResult.data ?? DEFAULT_SETTINGS;
  const loading = settingsResult.loading;
  const error = settingsErrorText(settingsResult.error);
  const setSettings = settingsResult.setData;
  // 生成/撤销临时分享后静默重新读取（与原来的 refetch 一样不显示骨架）
  const refetch = async () => {
    setSettings(await settingsQuery.fetch());
  };
  const [shareHours, setShareHours] = useState(1);

  // 恢复备份对话框与上传状态
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const restoreTaskRef = useRef<ChunkUploadTask | null>(null);

  const uploadBackup = async (file: File) => {
    if (restoring) return;

    if (!file.name.toLowerCase().endsWith(".zip") || file.size === 0) {
      toast.error(t("theme.invalid_file_type", "仅支持 .zip 文件"));
      return;
    }

    setRestoring(true);
    setRestoreProgress(0);
    const task = createChunkUploadTask("/api/admin/upload");
    restoreTaskRef.current = task;
    try {
      await task.upload("backup", file, setRestoreProgress);
      toast.success(t("account_settings.upload_success", "上传成功"));
      setRestoreOpen(false);
      setRestoreProgress(0);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg =
        err instanceof Error
          ? err.message
          : t("settings.site.backup_restore_error", "恢复备份失败");
      toast.error(msg);
    } finally {
      setRestoring(false);
      restoreTaskRef.current = null;
    }
  };

  const cancelRestore = () => {
    restoreTaskRef.current?.cancel();
    setRestoreProgress(0);
  };

  // 加载中渲染真实设置卡片（默认值），每张卡画成同尺寸的色块；数据到达后同一批 DOM 淡入
  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    <>
    <div className="flex w-full flex-col gap-km-block">
    <SettingCardsLoading loading={loading}>
      <SettingCardLabel>{t("settings.site.title")}</SettingCardLabel>
      {/*
        content 性格：站点基础信息这一组是首屏最重要的 6 张卡，用 StaggeredList 错峰进场。
        SettingCard 自己只做 30ms 内的一次弹簧落位，错峰再叠一层「先后次序」，
        数量上限由 StaggeredList 内部的固定 stagger 控制，长表单不会排队到尾。
      */}
      <StaggeredList className="flex w-full flex-col gap-km-block">
        <StaggeredItem>
          <SettingCardShortTextInput
            title={t("settings.site.name")}
            description={t("settings.site.name_description")}
            defaultValue={settings.sitename || ""}
            OnSave={async (data) => {
              await saveSettings({ sitename: data }, t);
            }}
          />
        </StaggeredItem>
        <StaggeredItem>
          <SettingCardLongTextInput
            title={t("settings.site.description")}
            description={t("settings.site.description_description")}
            defaultValue={settings.description || ""}
            OnSave={async (data) => {
              await saveSettings({ description: data }, t);
            }}
          />
        </StaggeredItem>
        <StaggeredItem>
          <SettingCardSwitch
            title={t("settings.site.cors_origin_check_enabled")}
            description={t("settings.site.cors_origin_check_enabled_description")}
            defaultChecked={settings.cors_origin_check_enabled ?? true}
            onChange={async (checked) => {
              await saveSettings({ cors_origin_check_enabled: checked }, t);
            }}
            className="km-page-admin-settings-site km-setting-card"
          />
        </StaggeredItem>
        <StaggeredItem>
          <SettingCardLongTextInput
            title={t("settings.site.cors_allowed_origins", "API CORS 允许列表")}
            description={t("settings.site.origins_list_description",
              "每行或用逗号分隔一个 Origin，例如 https://example.com",
            )}
            defaultValue={settings.cors_allowed_origins || ""}
            OnSave={async (data) => {
              await saveSettings({ cors_allowed_origins: data }, t);
            }}
          />
        </StaggeredItem>
        <StaggeredItem>
          <SettingCardSwitch
            title={t("settings.site.ws_origin_check_enabled", "WebSocket Origin 校验")}
            description={t(
              "settings.site.ws_origin_check_enabled_description",
              "开启后 WebSocket 请求只允许同源或允许列表中的 Origin",
            )}
            defaultChecked={settings.ws_origin_check_enabled ?? true}
            onChange={async (checked) => {
              await saveSettings(
                { ws_origin_check_enabled: checked },
                t,
              );
            }}
            className="km-setting-card"
          />
        </StaggeredItem>
        <StaggeredItem>
          <SettingCardLongTextInput
            title={t("settings.site.ws_allowed_origins", "WebSocket Origin 允许列表")}
            description={t("settings.site.origins_list_description",
              "每行或用逗号分隔一个 Origin，例如 https://example.com",
            )}
            defaultValue={settings.ws_allowed_origins || ""}
            OnSave={async (data) => {
              await saveSettings({ ws_allowed_origins: data }, t);
            }}
          />
        </StaggeredItem>
      </StaggeredList>
      <SettingCardSwitch
        title={t("settings.site.ssrf_protection_enabled")}
        description={t("settings.site.ssrf_protection_enabled_description")}
        defaultChecked={settings.ssrf_protection_enabled ?? false}
        onChange={async (checked) => {
          await saveSettings(
            { ssrf_protection_enabled: checked },
            t,
          );
        }}
        className="km-setting-card"
      />
      <SettingCardSwitch
        title={t("settings.site.send_ip_addr_to_guest")}
        description={t("settings.site.send_ip_addr_to_guest_description")}
        defaultChecked={settings.send_ip_addr_to_guest}
        onChange={async (checked) => {
          await saveSettings({ send_ip_addr_to_guest: checked }, t);
        }}
        className="km-setting-card"
      />
      <SettingCardShortTextInput
        title={t("settings.site.script_domain")}
        description={t("settings.site.script_domain_description")}
        placeholder={`${window.location.origin}`}
        defaultValue={settings.script_domain || ""}
        OnSave={async (data) => {
          await saveSettings({ script_domain: data }, t);
        }}
      />
      <SettingCardLabel>{t("settings.site.private_site")}</SettingCardLabel>
      <SettingCardSwitch
        title={t("settings.site.private_site")}
        description={t("settings.site.private_site_description")}
        defaultChecked={settings.private_site}
        onChange={async (checked) => {
          await saveSettings({ private_site: checked }, t);
        }}
        className="km-setting-card"
      />
      <SettingCardCollapse
        title={t("settings.site.temporary_share")}
        description={t("settings.site.temporary_share_description")}
      >
        <div className="flex w-full flex-col gap-km-block">
          {/*
            feedback 性格：临时分享链接只在 token 真的变化（生成/撤销）时脉冲一次，
            轮询或普通重渲染不会触发，不会变成持续闪烁的噪声。
          */}
          <HighlightPulse trigger={settings.tempory_share_token}>
          <SettingCardShortTextInput
            title={t("settings.site.temporary_share_current_link")}
            value={
              settings.tempory_share_token
                ? `${window.location.origin}/?temp_key=${settings.tempory_share_token}`
                : ""
            }
            showSaveButton={false}
            description={`${t("admin.nodeTable.expiredAt")}: ${new Date((settings.tempory_share_token_expire_at || 0) * 1000).toLocaleString()}`}
            disabled
            bordless
          >
            <Button
              onClick={() => {
                if (!settings.tempory_share_token) return;
                navigator.clipboard.writeText(
                  `${window.location.origin}/?temp_key=${settings.tempory_share_token}`,
                );
                toast.success(t("common.copy"));
              }}
            >
              {t("common.copy")}
            </Button>
          </SettingCardShortTextInput>
          </HighlightPulse>
          <SettingCardShortTextInput
            title={t("settings.site.temporary_share_hours")}
            bordless
            showSaveButton={false}
            value={shareHours}
            type="number"
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(val)) {
                setShareHours(val);
              }
            }}
          ></SettingCardShortTextInput>
          <div className="flex flex-row w-full gap-2">
            <Button
              onClick={async () => {
                const chars =
                  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                let key = "";
                for (let i = 0; i < 8; i++) {
                  key += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                await saveSettings(
                  {
                    tempory_share_token: key,
                    tempory_share_token_expire_at:
                      Math.floor(Date.now() / 1000) + shareHours * 3600,
                  },
                  t,
                );
                await refetch();
              }}
            >
              {t("common.generate")}
            </Button>
            <Button
              color="red"
              variant="soft"
              onClick={async () => {
                await saveSettings(
                  { tempory_share_token: "", tempory_share_token_expire_at: 0 },
                  t,
                );
                await refetch();
              }}
            >
              {t("settings.site.temporary_share_revoke")}
            </Button>
          </div>
        </div>
      </SettingCardCollapse>
      {/* 小标题 + 说明是同一个标题块（inline），标题块整体离下方卡片 group，离上一组 section */}
      <div className="km-section-title flex flex-col gap-km-inline">
        {/* 外层已带 km-section-title；这里不用 SettingCardLabel，避免它自带的负下边距叠到说明上 */}
        <label className="block text-xl font-bold" style={{ fontWeight: 600 }}>
          {t("settings.site.custom")}
        </label>
        <label className="text-sm text-muted-foreground">
          {t("settings.custom.note")}
        </label>
      </div>
      <SettingCardLongTextInput
        title={t("settings.custom.header")}
        description={t("settings.custom.header_description")}
        defaultValue={settings.custom_head || ""}
        OnSave={async (data) => {
          await saveSettings({ custom_head: data }, t);
        }}
      />
      <SettingCardLongTextInput
        title={t("settings.custom.body", "自定义 Body")}
        description={t(
          "settings.custom.body_description",
          "在页面底部添加自定义内容",
        )}
        defaultValue={settings.custom_body || ""}
        OnSave={async (data) => {
          await saveSettings({ custom_body: data }, t);
        }}
      />
      <SettingCardCollapse
        title={t("settings.custom.favicon", "自定义 Favicon")}
        description={t(
          "settings.custom.favicon_description",
          "在浏览器标签页显示的图标",
        )}
        defaultOpen={true}
      >
        <Flex
          width={"100%"}
          justify="between"
          align="start"
          direction={"column"}
          gap="2"
        >
          <Flex gap="2" align="center">
            {t("settings.custom.favicon_current", "当前 Favicon")}
            <img
              src="/favicon.ico"
              alt="Favicon"
              style={{ width: 32, height: 32 }}
            />
          </Flex>
          <label className="text-sm text-muted-foreground">
            {t(
              "settings.custom.favicon_note",
              "Favicon 图标的更新速度可能较慢，通常需要清除浏览器缓存后才能看到更改。",
            )}
          </label>
          <Flex gap="2" align="center">
            <Dialog.Root>
              <Dialog.Trigger>
                <Button color="tomato">
                  {t("settings.custom.favicon_default", "恢复默认")}
                </Button>
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Title>
                  {t("settings.custom.favicon_default", "恢复默认")}
                </Dialog.Title>
                <Dialog.Description>
                  {t(
                    "settings.custom.favicon_default_description",
                    "这将恢复默认的 Favicon 图标，是否继续？",
                  )}
                </Dialog.Description>
                <Flex gap="2" justify="end" mt="5">
                  <Dialog.Close>
                    <Button variant="soft">{t("common.cancel", "取消")}</Button>
                  </Dialog.Close>
                  <Dialog.Trigger>
                    <Button
                      color="red"
                      onClick={async () => {
                        api
                          .post("/api/admin/update/favicon")
                          .then(() => {
                            toast.success(t("settings.custom.favicon_default_success"));
                          })
                          .catch((error) => {
                            const failure = serverError(error);
                            toast.error(
                              failure
                                ? failure.message || t("settings.custom.favicon_default_error")
                                : "" + error,
                            );
                          });
                      }}
                    >
                      {t("common.confirm")}
                    </Button>
                  </Dialog.Trigger>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
            <Button
              onClick={async () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    try {
                      await requestJson("/api/admin/update/favicon", {
                        method: "PUT",
                        body: file,
                        headers: {
                          "Content-Type": "application/octet-stream",
                        },
                      });
                      toast.success(
                        t(
                          "settings.custom.favicon_update_success"
                        ),
                      );
                    } catch (error) {
                      const failure = serverError(error);
                      toast.error(
                        failure
                          ? failure.message || "Failed to update Favicon"
                          : "" + error,
                      );
                    }
                  }
                };
                input.click();
              }}
            >
              {t("settings.custom.favicon_change")}
            </Button>
          </Flex>
        </Flex>
      </SettingCardCollapse>
      <SettingCardLabel>{t("settings.site.backup")}</SettingCardLabel>
      <SettingCardIconButton
        title={t("settings.site.backup_download")}
        description={t("settings.site.backup_download_description")}
        onClick={() => {
          window.open("/api/admin/download/backup", "_blank");
        }}
        className="km-setting-card"
      >
        <DownloadIcon size={16} />
      </SettingCardIconButton>
      <SettingCardButton
        title={t("settings.site.backup_restore")}
        description={t("settings.site.backup_restore_description")}
        onClick={() => setRestoreOpen(true)}
        className="km-setting-card"
      >
        {t("common.select")}
      </SettingCardButton>
    </SettingCardsLoading>
    </div>

      {/* 上传备份对话框 */}
      <UploadDialog
        open={restoreOpen}
        onOpenChange={(open) => {
          if (!open && restoring) {
            cancelRestore();
            return;
          }
          setRestoreOpen(open);
        }}
        title={t("settings.site.backup_restore")}
        description={t("settings.site.backup_restore_description")}
        accept=".zip"
        dragDropText={t("theme.drag_drop")}
        clickToBrowseText={t("theme.or_click_to_browse")}
        hintText={t("theme.zip_files_only")}
        uploading={restoring}
        progress={restoreProgress}
        cancelUploadLabel={t("common.cancel")}
        onCancelUpload={cancelRestore}
        onFileSelected={(file) => uploadBackup(file)}
        closeLabel={t("common.cancel")}
      />
    </>
  );
}
