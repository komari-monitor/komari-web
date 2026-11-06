import { updateSettingsWithToast, type SettingsResponse } from "@/lib/api";
import { ApiError, api } from "@/lib/http";
import { invalidateSettingsQueries } from "@/routeQueries/settings";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 这些设置接口原本直接 res.json() 再看 status，不区分 HTTP 状态码。
 * 服务器返回了 JSON 错误体时返回 { message }（message 可能为空，调用方再给默认文案）；
 * 网络错误、响应不是 JSON 等其它异常返回 undefined，调用方按原来的 catch 分支处理。
 */
export function serverError(error: unknown): { message?: string } | undefined {
  if (!(error instanceof ApiError) || !isRecord(error.body)) return undefined;
  const { message } = error.body;
  return { message: message ? String(message) : undefined };
}

/**
 * 保存设置（updateSettingsWithToast，toast 文案不变），结束后让设置的预取结果作废：
 * 保存前悬停过别的设置页留下的预取不会在切过去时读到旧值。
 */
export async function saveSettings(
  settings: Partial<SettingsResponse>,
  t: (key: string) => string,
): Promise<void> {
  try {
    await updateSettingsWithToast(settings, t);
  } finally {
    invalidateSettingsQueries();
  }
}

/** 读取 JSON 响应体，不检查 HTTP 状态与 status 字段（等同原来的 fetch → res.json()） */
export async function getJsonBody<T = unknown>(url: string): Promise<T> {
  try {
    return await api.get<T>(url, { expectSuccess: false });
  } catch (error) {
    if (error instanceof ApiError && error.body !== null) return error.body as T;
    throw error;
  }
}
