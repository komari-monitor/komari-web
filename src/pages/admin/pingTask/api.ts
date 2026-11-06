import type { TFunction } from "i18next";
import { ApiError, requestJson, serverMessage } from "@/lib/http";

/**
 * 提交 ping 任务的增删改/排序请求（/api/admin/ping/*）。
 * 这些接口只看 HTTP 状态，不检查响应体的 status 字段；
 * HTTP 失败时抛出 ApiError，message 为服务器返回的 message，没有则为 common.error。
 */
export async function postPingTask(url: string, payload: unknown, t: TFunction): Promise<void> {
  try {
    await requestJson(url, { json: payload, expectSuccess: false });
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(
        error.status,
        serverMessage(error) ?? t("common.error"),
        error.body,
        error.statusText
      );
    }
    throw error;
  }
}
