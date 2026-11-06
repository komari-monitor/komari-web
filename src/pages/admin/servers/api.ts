import { ApiError, api } from "@/lib/http";

/**
 * 服务器列表页用到的 /api/admin/client/* 接口。
 *
 * 除 editClient 外，原实现都不检查 HTTP 状态和响应体 status：只有网络错误会进 catch 提示。
 * 这里保持一致：HTTP 错误（ApiError）吞掉，网络错误照常抛出。
 */
async function ignoreHttpError(request: Promise<unknown>): Promise<void> {
  try {
    await request;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
}

const post = (url: string, json?: unknown) =>
  ignoreHttpError(api.post(url, json, { expectSuccess: false }));

export const addClient = (name: string) => post("/api/admin/client/add", { name });

/** 拖拽排序：{ uuid: 序号 } */
export const reorderClients = (order: Record<string, number>) =>
  post("/api/admin/client/order", order);

export const removeClient = (uuid: string) => post(`/api/admin/client/${uuid}/remove`);

/** 编辑信息：HTTP 非 2xx 时抛错（原实现检查 res.ok，不检查响应体 status） */
export const editClient = (uuid: string, data: Record<string, unknown>) =>
  api.post(`/api/admin/client/${uuid}/edit`, data, { expectSuccess: false });

/** 账单：同一个 edit 接口，但原实现不检查 HTTP 状态 */
export const saveClientBilling = (uuid: string, data: Record<string, unknown>) =>
  post(`/api/admin/client/${uuid}/edit`, data);
