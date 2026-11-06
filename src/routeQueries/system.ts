// 页面数据预取登记：exec / pprof / 关于（写法见 ./admin.ts 与 @/lib/routeData）
import { api } from "@/lib/http";
import { prefetchRouteQuery, routeQuery, type RouteQuery } from "@/lib/routeData";
import { registerRouteData } from "@/lib/routeRegistry";

// ---------------------------------------------------------------------------
// 远程执行：节点列表由 NodeDetailsContext（./ops.ts 的 nodeDetailsQuery）负责，这里只登记 2FA 状态
// ---------------------------------------------------------------------------

/** 当前账号是否开启 2FA；只看响应体，不检查 status 字段 */
export const execMeQuery = routeQuery("system/exec/me", () =>
  api.get<{ "2fa_enabled"?: boolean }>("/api/me", { expectSuccess: false }),
);

registerRouteData("/admin/exec", () => prefetchRouteQuery(execMeQuery));

// ---------------------------------------------------------------------------
// 诊断（pprof）：概要 + 堆预览。堆预览的地址在概要里，概要一到就接着预取，
// 页面拿到概要时堆预览请求已经在路上（不会等页面渲染后才串行发出）
// ---------------------------------------------------------------------------

/** 诊断文件请求（预览文本 / 下载）失败：status 为 HTTP 状态，serverMessage 为服务器给出的提示（没有则为空） */
export class PprofRequestError extends Error {
  readonly status: number;
  readonly serverMessage: string | undefined;

  constructor(status: number, serverMessage: string | undefined) {
    super(serverMessage ?? `HTTP ${status}`);
    this.name = "PprofRequestError";
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/** 读取失败响应里的 message（成功时是二进制，失败时可能是 JSON 或纯文本） */
export async function readPprofServerMessage(response: Response): Promise<string | undefined> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  } catch {
    // Diagnostic downloads are binary on success and may be plain text on errors.
  }
  return undefined;
}

/** 读取一份诊断预览文本 */
export async function fetchPprofPreviewText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "text/plain" },
  });
  if (!response.ok) {
    throw new PprofRequestError(response.status, await readPprofServerMessage(response));
  }
  return response.text();
}

/** 概要请求的结果：原始响应体（页面负责校验结构、生成提示文字）+ 本次概要对应的堆预览请求 */
export type PprofSummaryResult = {
  payload: unknown;
  heapPreview: RouteQuery<string> | null;
};

/** 从未校验的概要里找出堆预览地址；结构不对就当没有（页面校验失败时也不会显示堆预览） */
function heapPreviewURL(payload: unknown): string | null {
  const profiles = (payload as { data?: { profiles?: unknown } } | null)?.data?.profiles;
  if (!Array.isArray(profiles)) return null;
  for (const profile of profiles as Array<{ name?: unknown; preview?: unknown } | null>) {
    if (profile?.name !== "heap") continue;
    const preview = profile.preview;
    return typeof preview === "string" && preview.startsWith("/api/admin/pprof/") ? preview : null;
  }
  return null;
}

/** 每次请求概要都对应一份新的堆预览（刷新概要 = 刷新堆预览） */
let pprofSummarySeq = 0;

export const pprofSummaryQuery = routeQuery<PprofSummaryResult>("system/pprof/summary", async () => {
  const payload = await api.get("/api/admin/pprof/summary", {
    cache: "no-store",
    credentials: "same-origin",
    expectSuccess: false,
  });
  const url = heapPreviewURL(payload);
  let heapPreview: RouteQuery<string> | null = null;
  if (url) {
    pprofSummarySeq += 1;
    heapPreview = routeQuery(`system/pprof/heap/${pprofSummarySeq}`, () => fetchPprofPreviewText(url));
    prefetchRouteQuery(heapPreview);
  }
  return { payload, heapPreview };
});

registerRouteData("/admin/pprof", () => prefetchRouteQuery(pprofSummaryQuery));

// ---------------------------------------------------------------------------
// 关于：README（外部 raw.githubusercontent.com）。许可证、依赖列表是打包进来的静态数据，没有别的请求
// ---------------------------------------------------------------------------

export const aboutReadmeQuery = routeQuery("system/about/readme", async () => {
  const res = await fetch(
    "https://raw.githubusercontent.com/komari-monitor/komari/refs/heads/main/README.md",
  );
  if (!res.ok) throw new Error(String(res.status));
  return res.text();
});

// README 在 GitHub 上，可能很慢或访问不了：只预取，不让页面切换等它（README 区自己显示加载中）
registerRouteData("/admin/about", () => prefetchRouteQuery(aboutReadmeQuery, { gate: false }));
