import type { TFunction } from "i18next";
import { ApiError, serverMessage } from "@/lib/http";
import { PprofRequestError, readPprofServerMessage } from "@/routeQueries/system";
import { pprofSummaryResponseSchema, type PprofSummary } from "./model";

/** 诊断文件请求（预览文本 / 下载二进制）失败时的提示文字 */
export async function responseError(response: Response, fallback: string): Promise<string> {
  return (await readPprofServerMessage(response)) ?? `${fallback} (${response.status})`;
}

/** 预览请求（fetchPprofPreviewText）抛出的错误转成提示文字，与 responseError 文案一致 */
export function previewErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof PprofRequestError) {
    return error.serverMessage ?? `${fallback} (${error.status})`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** 概要请求失败时的提示文字 */
export function summaryErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    return serverMessage(error) ?? `${t("pprof.summary_load_failed")} (${error.status})`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** 校验诊断概要的响应体；结构不符时抛出带本地化文案的 Error */
export function parsePprofSummary(payload: unknown, t: TFunction): PprofSummary {
  const parsed = pprofSummaryResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(t("pprof.invalid_summary"));
  }
  return parsed.data.data;
}
