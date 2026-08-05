import { useTranslation } from "react-i18next";
import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { updateSettingsWithToast, useSettings } from "@/lib/api";
import {
  SettingCardButton,
  SettingCardCollapse,
  SettingCardIconButton,
  SettingCardLabel,
  SettingCardLongTextInput,
  SettingCardShortTextInput,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import { toast } from "sonner";
import Loading from "@/components/loading";
import { DownloadIcon } from "lucide-react";
import { useRef, useState } from "react";
import UploadDialog from "@/components/UploadDialog";

export default function SiteSettings() {
  const { t } = useTranslation();
  const { settings, loading, error, refetch } = useSettings();
  const [shareHours, setShareHours] = useState(1);

  // 恢复备份对话框与上传状态
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const cancelledRef = useRef(false);
  const restoreXhrsRef = useRef<Set<XMLHttpRequest>>(new Set());
  const restoreAbortControllerRef = useRef<AbortController | null>(null);

  // 上传单个分块，返回 Promise，通过 onProgress 回调汇报块内进度
  const uploadChunk = (
    uploadID: string,
    chunkIndex: number,
    chunk: Blob,
    onProgress: (pct: number) => void,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      restoreXhrsRef.current.add(xhr);

      const complete = (callback: () => void) => {
        restoreXhrsRef.current.delete(xhr);
        callback();
      };

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          complete(resolve);
        } else {
          let message = `Chunk ${chunkIndex} upload failed: ${xhr.status}`;
          try {
            const data = JSON.parse(xhr.responseText);
            message = data.message || message;
          } catch {
            // Keep the HTTP status message when the response is not JSON.
          }
          complete(() => reject(new Error(message)));
        }
      });

      xhr.addEventListener("error", () =>
        complete(() => reject(new Error(`Chunk ${chunkIndex} network error`))),
      );
      xhr.addEventListener("abort", () =>
        complete(() => reject(new Error("Upload cancelled"))),
      );

      const form = new FormData();
      form.append("upload_id", uploadID);
      form.append("chunk_index", String(chunkIndex));
      form.append("chunk_data", chunk, `chunk-${chunkIndex}`);

      xhr.open("POST", "/api/admin/upload/backup/chunk");
      xhr.send(form);
    });
  };

  const uploadChunkWithRetry = async (
    uploadID: string,
    chunkIndex: number,
    chunk: Blob,
    onProgress: (pct: number) => void,
  ): Promise<void> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await uploadChunk(uploadID, chunkIndex, chunk, onProgress);
        return;
      } catch (error) {
        if (cancelledRef.current || attempt === 1) throw error;
      }
    }
  };

  const uploadBackup = async (file: File) => {
    if (restoring) return;

    if (!file.name.toLowerCase().endsWith(".zip") || file.size === 0) {
      toast.error(t("theme.invalid_file_type", "仅支持 .zip 文件"));
      return;
    }

    cancelledRef.current = false;
    setRestoring(true);
    setRestoreProgress(0);
    try {
      // 1. 初始化分块上传
      const initAbortController = new AbortController();
      restoreAbortControllerRef.current = initAbortController;
      const initRes = await fetch("/api/admin/upload/backup/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: file.size }),
        signal: initAbortController.signal,
      });
      if (!initRes.ok) {
        throw new Error("Failed to init chunk upload");
      }
      const initData: unknown = await initRes.json();
      if (
        !initData ||
        typeof initData !== "object" ||
        typeof (initData as { upload_id?: unknown }).upload_id !== "string" ||
        typeof (initData as { chunk_size?: unknown }).chunk_size !== "number" ||
        (initData as { chunk_size: number }).chunk_size <= 0
      ) {
        throw new Error("Invalid chunk upload configuration");
      }
      const { upload_id, chunk_size } = initData as {
        upload_id: string;
        chunk_size: number;
      };
      restoreAbortControllerRef.current = null;

      // 2. 并行上传分块；单个分块最多自动重试一次
      const totalChunks = Math.ceil(file.size / chunk_size);
      const chunkProgress = new Map<number, number>();
      let nextChunk = 0;
      const worker = async () => {
        while (!cancelledRef.current) {
          const chunkIndex = nextChunk++;
          if (chunkIndex >= totalChunks) return;

          const start = chunkIndex * chunk_size;
          const end = Math.min(start + chunk_size, file.size);
          const chunk = file.slice(start, end);
          await uploadChunkWithRetry(upload_id, chunkIndex, chunk, (chunkPct) => {
            chunkProgress.set(chunkIndex, chunkPct);
            let totalPct = 0;
            for (const pct of chunkProgress.values()) totalPct += pct;
            setRestoreProgress(Math.round(totalPct / totalChunks));
          });
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(3, totalChunks) }, () => worker()),
      );

      if (cancelledRef.current) return;

      // 3. 合并分块并触发恢复
      const mergeAbortController = new AbortController();
      restoreAbortControllerRef.current = mergeAbortController;
      const mergeRes = await fetch("/api/admin/upload/backup/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id }),
        signal: mergeAbortController.signal,
      });
      const mergeData = await mergeRes.json();
      if (!mergeRes.ok || (mergeData.status && mergeData.status !== "success")) {
        throw new Error(mergeData.message || "Merge failed");
      }

      toast.success(t("account_settings.upload_success", "上传成功"));
      setRestoreOpen(false);
      setRestoreProgress(0);
    } catch (err) {
      const userCancelled = cancelledRef.current;
      if (!userCancelled) {
        cancelledRef.current = true;
        for (const xhr of restoreXhrsRef.current) xhr.abort();
      }
      if (userCancelled) return;
      const msg =
        err instanceof Error
          ? err.message
          : t("settings.site.backup_restore_error", "恢复备份失败");
      toast.error(msg);
    } finally {
      setRestoring(false);
      restoreXhrsRef.current.clear();
      restoreAbortControllerRef.current = null;
      if (cancelledRef.current) {
        setRestoreProgress(0);
      }
    }
  };

  const cancelRestore = () => {
    cancelledRef.current = true;
    for (const xhr of restoreXhrsRef.current) xhr.abort();
    restoreAbortControllerRef.current?.abort();
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    <>
      <SettingCardLabel>{t("settings.site.title")}</SettingCardLabel>
      <SettingCardShortTextInput
        title={t("settings.site.name")}
        description={t("settings.site.name_description")}
        defaultValue={settings.sitename || ""}
        OnSave={async (data) => {
          await updateSettingsWithToast({ sitename: data }, t);
        }}
      />
      <SettingCardLongTextInput
        title={t("settings.site.description")}
        description={t("settings.site.description_description")}
        defaultValue={settings.description || ""}
        OnSave={async (data) => {
          await updateSettingsWithToast({ description: data }, t);
        }}
      />
      <SettingCardSwitch
        title={t("settings.site.cors_origin_check_enabled")}
        description={t("settings.site.cors_origin_check_enabled_description")}
        defaultChecked={settings.cors_origin_check_enabled ?? true}
        onChange={async (checked) => {
          await updateSettingsWithToast({ cors_origin_check_enabled: checked }, t);
        }}
        className="km-page-admin-settings-site km-setting-card"
      />
      <SettingCardLongTextInput
        title={t("settings.site.cors_allowed_origins", "API CORS 允许列表")}
        description={t("settings.site.origins_list_description",
          "每行或用逗号分隔一个 Origin，例如 https://example.com",
        )}
        defaultValue={settings.cors_allowed_origins || ""}
        OnSave={async (data) => {
          await updateSettingsWithToast({ cors_allowed_origins: data }, t);
        }}
      />
      <SettingCardSwitch
        title={t("settings.site.ws_origin_check_enabled", "WebSocket Origin 校验")}
        description={t(
          "settings.site.ws_origin_check_enabled_description",
          "开启后 WebSocket 请求只允许同源或允许列表中的 Origin",
        )}
        defaultChecked={settings.ws_origin_check_enabled ?? true}
        onChange={async (checked) => {
          await updateSettingsWithToast(
            { ws_origin_check_enabled: checked },
            t,
          );
        }}
        className="km-setting-card"
      />
      <SettingCardLongTextInput
        title={t("settings.site.ws_allowed_origins", "WebSocket Origin 允许列表")}
        description={t("settings.site.origins_list_description",
          "每行或用逗号分隔一个 Origin，例如 https://example.com",
        )}
        defaultValue={settings.ws_allowed_origins || ""}
        OnSave={async (data) => {
          await updateSettingsWithToast({ ws_allowed_origins: data }, t);
        }}
      />
      <SettingCardSwitch
        title={t("settings.site.send_ip_addr_to_guest")}
        description={t("settings.site.send_ip_addr_to_guest_description")}
        defaultChecked={settings.send_ip_addr_to_guest}
        onChange={async (checked) => {
          await updateSettingsWithToast({ send_ip_addr_to_guest: checked }, t);
        }}
        className="km-setting-card"
      />
      <SettingCardShortTextInput
        title={t("settings.site.script_domain")}
        description={t("settings.site.script_domain_description")}
        placeholder={`${window.location.origin}`}
        defaultValue={settings.script_domain || ""}
        OnSave={async (data) => {
          await updateSettingsWithToast({ script_domain: data }, t);
        }}
      />
      <SettingCardLabel>{t("settings.site.private_site")}</SettingCardLabel>
      <SettingCardSwitch
        title={t("settings.site.private_site")}
        description={t("settings.site.private_site_description")}
        defaultChecked={settings.private_site}
        onChange={async (checked) => {
          await updateSettingsWithToast({ private_site: checked }, t);
        }}
        className="km-setting-card"
      />
      <SettingCardCollapse
        title={t("settings.site.temporary_share")}
        description={t("settings.site.temporary_share_description")}
      >
        <div className="flex w-full flex-col gap-4">
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
                await updateSettingsWithToast(
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
                await updateSettingsWithToast(
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
      <SettingCardLabel>{t("settings.site.custom")}</SettingCardLabel>
      <label className="text-sm text-muted-foreground -mt-4">
        {t("settings.custom.note")}
      </label>
      <SettingCardLongTextInput
        title={t("settings.custom.header")}
        description={t("settings.custom.header_description")}
        defaultValue={settings.custom_head || ""}
        OnSave={async (data) => {
          await updateSettingsWithToast({ custom_head: data }, t);
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
          await updateSettingsWithToast({ custom_body: data }, t);
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
                <Flex gap="2" justify="end">
                  <Dialog.Close>
                    <Button variant="soft">{t("common.cancel", "取消")}</Button>
                  </Dialog.Close>
                  <Dialog.Trigger>
                    <Button
                      color="red"
                      onClick={async () => {
                        fetch("/api/admin/update/favicon", {
                          method: "POST",
                        })
                          .then((response) => {
                            return response.json();
                          })
                          .then((data) => {
                            if (data.status === "success") {
                              toast.success(t("settings.custom.favicon_default_success"));
                            } else {
                              toast.error(
                                data.message || t("settings.custom.favicon_default_error"),
                              );
                            }
                          })
                          .catch((error) => {
                            toast.error("" + error);
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
                      const response = await fetch(
                        "/api/admin/update/favicon",
                        {
                          method: "PUT",
                          body: file,
                          headers: {
                            "Content-Type": "application/octet-stream",
                          },
                        },
                      );
                      const data = await response.json();
                      if (data.status === "success") {
                        toast.success(
                          t(
                            "settings.custom.favicon_update_success"
                          ),
                        );
                      } else {
                        toast.error(data.message || "Failed to update Favicon");
                      }
                    } catch (error) {
                      toast.error("" + error);
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
