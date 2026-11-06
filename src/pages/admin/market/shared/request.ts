import { ApiError, requestJson, serverMessage, type RequestOptions } from "@/lib/http";
import type { MarketKind } from "./types";

export interface MarketResponse<T> {
  status: string;
  message?: string;
  data: T;
}

/**
 * 市场相关接口的请求：HTTP 非 2xx、响应体为空/不是 JSON、或 status === "error" 时抛错，
 * 错误信息优先取服务器 message，否则 "HTTP <status>"（与重构前页面内的 request() 一致）。
 * 只依赖 @/lib/http：页面数据预取（src/routeQueries/appearance.ts）也用它。
 */
export async function marketRequest<T = unknown>(url: string, options?: RequestOptions) {
  let payload: MarketResponse<T> | null;
  try {
    payload = await requestJson<MarketResponse<T> | null>(url, { ...options, expectSuccess: false });
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(serverMessage(error) || `HTTP ${error.status}`);
    }
    throw error;
  }
  if (!payload || payload.status === "error") {
    throw new Error(payload?.message || "HTTP 200");
  }
  return payload;
}

export const marketBase = (kind: MarketKind) => `/api/admin/${kind}/market`;

export const fetchMarketCatalog = <T>(kind: MarketKind, force = false) =>
  marketRequest<T>(`${marketBase(kind)}/catalog${force ? "?refresh=true" : ""}`);

export const marketSourceUrl = (kind: MarketKind, id?: string | null) =>
  id
    ? `${marketBase(kind)}/sources/${encodeURIComponent(id)}`
    : `${marketBase(kind)}/sources`;

export const fetchMarketSources = <T>(kind: MarketKind) => marketRequest<T>(marketSourceUrl(kind));
