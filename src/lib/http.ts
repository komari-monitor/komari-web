/**
 * 后台 / 公共 HTTP 接口的统一请求层。
 *
 * Komari 的 REST 接口大多返回 { status: "success" | "error", message?, data? }，
 * 少数接口直接返回数组或对象。这里统一处理：
 * - 传 json 时自动 JSON.stringify，并设置 Content-Type 和默认 POST；
 * - 响应体按 JSON 解析（解析失败视为 null，不抛语法错误）；
 * - HTTP 非 2xx，或响应体带 status 且不是 "success" 时抛出 ApiError，
 *   message 优先取服务器返回的 message，其次是 HTTP 状态；
 * - requestData / api.getData / api.postData 直接返回响应里的 data。
 *
 * 调用方只需要 try/catch 并用 errorMessage(error) 拿到可展示的文字。
 * RPC 调用请继续使用 src/lib/rpc2.ts，这里只负责普通 HTTP 接口。
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  /** HTTP 状态文本（如 "Not Found"），服务器未提供时为空串 */
  readonly statusText: string;

  constructor(status: number, message: string, body?: unknown, statusText = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.statusText = statusText;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** 以 JSON 发送的请求体；提供时默认方法为 POST */
  json?: unknown;
  /** 原样发送的请求体（FormData、Blob 等），与 json 二选一 */
  body?: BodyInit | null;
  /**
   * 是否要求响应体的 status 为 "success"。默认 true；
   * 对直接返回数组/对象、没有 status 字段的接口没有影响。
   */
  expectSuccess?: boolean;
}

type Envelope = { status?: unknown; message?: unknown; data?: unknown };

const isEnvelope = (value: unknown): value is Envelope =>
  typeof value === "object" && value !== null && !Array.isArray(value);

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 发起请求并返回解析后的 JSON 响应体；失败时抛出 ApiError */
export async function requestJson<T = unknown>(
  input: string,
  { json, body, expectSuccess = true, headers, method, ...init }: RequestOptions = {},
): Promise<T> {
  const hasJson = json !== undefined;
  const response = await fetch(input, {
    ...init,
    method: method ?? (hasJson ? "POST" : undefined),
    headers: hasJson ? { "Content-Type": "application/json", ...headers } : headers,
    body: hasJson ? JSON.stringify(json) : body,
  });
  const payload = await readJson(response);
  const envelope = isEnvelope(payload) ? payload : undefined;
  const serverMessage =
    envelope && typeof envelope.message === "string" && envelope.message
      ? envelope.message
      : undefined;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      serverMessage ?? `HTTP ${response.status}${response.statusText ? " " + response.statusText : ""}`,
      payload,
      response.statusText,
    );
  }
  if (expectSuccess && envelope && "status" in envelope && envelope.status !== "success") {
    throw new ApiError(response.status, serverMessage ?? "Request failed", payload, response.statusText);
  }
  return payload as T;
}

/** 与 requestJson 相同，但返回响应体里的 data 字段 */
export async function requestData<T = unknown>(input: string, options?: RequestOptions): Promise<T> {
  const payload = await requestJson<Envelope>(input, options);
  return (isEnvelope(payload) ? payload.data : undefined) as T;
}

export const api = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    requestJson<T>(url, { ...options, method: "GET" }),
  post: <T = unknown>(url: string, json?: unknown, options?: RequestOptions) =>
    requestJson<T>(url, { ...options, method: "POST", json: json ?? undefined }),
  getData: <T = unknown>(url: string, options?: RequestOptions) =>
    requestData<T>(url, { ...options, method: "GET" }),
  postData: <T = unknown>(url: string, json?: unknown, options?: RequestOptions) =>
    requestData<T>(url, { ...options, method: "POST", json: json ?? undefined }),
};

/**
 * ApiError 响应体里服务器给出的 message；不是 ApiError、响应体不是 JSON 对象、
 * 或 message 为空时返回 undefined（调用方再接自己的默认文案）。
 */
export function serverMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const body = error.body as { message?: unknown } | null;
  return body && typeof body.message === "string" && body.message ? body.message : undefined;
}

/** 把任意异常转成可展示的文字 */
export function errorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
