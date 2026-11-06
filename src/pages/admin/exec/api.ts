import { ApiError, api, serverMessage } from "@/lib/http";
import type { ExecResponse, TaskResultResponse } from "./types";

/**
 * 下发命令（/api/admin/task/exec）。不检查响应体 status（新旧两种响应格式由调用方区分）；
 * HTTP 失败时 message 为服务器返回的 message，没有则为「HTTP error! status: N」。
 */
export async function execTask(payload: {
    command: string;
    clients: string[];
    "2fa_code": string;
}): Promise<ExecResponse> {
    try {
        return await api.post<ExecResponse>("/api/admin/task/exec", payload, { expectSuccess: false });
    } catch (error) {
        if (error instanceof ApiError) {
            throw new Error(serverMessage(error) ?? `HTTP error! status: ${error.status}`);
        }
        throw error;
    }
}

/** 拉取任务结果（/api/admin/task/{id}/result），HTTP 失败时抛出 */
export const fetchTaskResult = (taskId: string) =>
    api.get<TaskResultResponse>(`/api/admin/task/${taskId}/result`, { expectSuccess: false });
