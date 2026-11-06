import { toast } from "sonner";
import type { MarketKind, MarketSourceForm } from "./types";
import { marketBase, marketRequest, marketSourceUrl } from "./request";

export {
  fetchMarketCatalog,
  fetchMarketSources,
  marketRequest,
  type MarketResponse,
} from "./request";

/** 市场页统一的失败提示：直接展示错误信息 */
export const toastError = (error: unknown) =>
  toast.error(error instanceof Error ? error.message : String(error));

export const installFromMarket = (kind: MarketKind, sourceId: string, short: string) =>
  marketRequest(`${marketBase(kind)}/install`, {
    json: { source_id: sourceId, short },
  });

/** 有 id 时 PUT 更新，否则 POST 新建 */
export const saveMarketSource = (kind: MarketKind, id: string | null, body: MarketSourceForm) =>
  marketRequest(marketSourceUrl(kind, id), { method: id ? "PUT" : "POST", json: body });

export const deleteMarketSource = (kind: MarketKind, id: string) =>
  marketRequest(marketSourceUrl(kind, id), { method: "DELETE" });
