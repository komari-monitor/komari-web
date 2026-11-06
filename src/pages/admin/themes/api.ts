import { ApiError, api, serverMessage } from "@/lib/http";
import type { Theme, ThemeImportPreview } from "./types";

/**
 * 主题管理页的接口。错误文字与重构前一致：
 * - list / set：HTTP 失败抛 "HTTP error! status: <status>"，不检查响应体 status；
 * - update / delete：HTTP 失败取服务器 message，否则用 fallback；
 * - import：HTTP 失败或 status === "error" 时取服务器 message，否则用 fallback。
 */

async function withHttpStatusError<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError) throw new Error(`HTTP error! status: ${error.status}`);
    throw error;
  }
}

async function withServerMessage<T>(request: Promise<T>, fallback: string): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError) throw new Error(serverMessage(error) || fallback);
    throw error;
  }
}

export async function fetchInstalledThemes(): Promise<Theme[]> {
  const data = await withHttpStatusError(
    api.get<{ data?: Theme[] } | null>("/api/admin/theme/list", { expectSuccess: false }),
  );
  return data?.data || [];
}

export const setThemeActive = (themeShort: string) =>
  withHttpStatusError(api.get(`/api/admin/theme/set?theme=${themeShort}`, { expectSuccess: false }));

export const updateThemeFromSource = (themeShort: string) =>
  withServerMessage(
    api.post("/api/admin/theme/update", { short: themeShort, useOriginalUrl: true }, { expectSuccess: false }),
    "Update failed",
  );

export const deleteInstalledTheme = (themeShort: string) =>
  withServerMessage(
    api.post("/api/admin/theme/delete", { short: themeShort }, { expectSuccess: false }),
    "Delete failed",
  );

interface ImportResponse {
  status?: string;
  message?: string;
  data?: ThemeImportPreview;
}

/** 从仓库地址导入主题；preview 为 true 时只检查不安装 */
export async function importThemeFromUrl(url: string, preview: boolean, fallback: string) {
  const data = await withServerMessage(
    api.post<ImportResponse | null>(
      preview ? "/api/admin/theme/import?preview=true" : "/api/admin/theme/import",
      { url },
      { expectSuccess: false },
    ),
    fallback,
  );
  if (data?.status === "error") throw new Error(data.message || fallback);
  return data;
}
