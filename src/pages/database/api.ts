import {
  ApiError,
  requestData,
  requestJson,
  serverMessage,
  type RequestOptions,
} from "@/lib/http";
import type { RestrictedAuthStatus } from "@/components/RestrictedLoginDialog";

/**
 * 安装向导、数据库迁移、数据库恢复这几个独立引导页共用的请求层。
 * 它们的接口都是 { status, message, data } 信封，统一不走缓存。
 */
export type GuideRequest = <T>(path: string, options?: RequestOptions) => Promise<T>;

/**
 * 把 ApiError 的文案换成这几页一直使用的格式：
 * 服务器 message（useServerMessage 时），否则只写「HTTP 状态码」，不带 statusText。
 */
async function withStatusMessage<T>(
  promise: Promise<T>,
  useServerMessage: boolean,
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    throw new ApiError(
      error.status,
      (useServerMessage ? serverMessage(error) : undefined) ?? `HTTP ${error.status}`,
      error.body,
      error.statusText,
    );
  }
}

/** 以 base 为前缀发请求并返回 data；HTTP 非 2xx 或 status 不是 success 时抛 ApiError */
export function createGuideRequest(base: string): GuideRequest {
  return <T>(path: string, options?: RequestOptions) =>
    withStatusMessage(
      requestData<T>(`${base}${path}`, { ...options, cache: "no-store" }),
      true,
    );
}

/** 受限登录弹窗需要的登录方式（各页 /auth 接口返回） */
export type LoginMethods = Pick<
  RestrictedAuthStatus,
  "oauth_enabled" | "oauth_provider" | "password_login_enabled"
>;

export type Me = Pick<RestrictedAuthStatus, "logged_in" | "username">;

/** /api/me 直接返回对象，没有 status 信封；失败时只提示 HTTP 状态码 */
export function getMe(): Promise<Me> {
  return withStatusMessage(
    requestJson<Me>("/api/me", { cache: "no-store", expectSuccess: false }),
    false,
  );
}

/** 同时读取登录方式（`${base}/auth`）和当前登录状态，合并后交给 RestrictedLoginDialog */
export async function loadAuth<M extends LoginMethods>(
  request: GuideRequest,
): Promise<M & Me> {
  const [methods, me] = await Promise.all([request<M>("/auth"), getMe()]);
  return { ...methods, ...me };
}
