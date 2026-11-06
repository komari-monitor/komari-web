export interface TaskResult {
    task_id: string;
    client: string;
    client_info: {
        uuid: string;
        name: string;
        [key: string]: any;
    };
    result: string;
    exit_code: number | null;
    finished_at: string | null;
    created_at: string;
}

export interface ExecResponse {
    success?: boolean;
    task_id?: string;
    clients?: string[];
    message?: string;
    // 新的响应格式
    status?: string;
    data?: {
        task_id: string;
    };
}

export interface TaskResultResponse {
    success?: boolean;
    results?: TaskResult[];
    message?: string;
    // 新的响应格式
    status?: string;
    data?: TaskResult[];
}

// 客户端标记“执行超时”的内部结果（避免在 UI 中展示硬编码中文）
export const TIMEOUT_RESULT_MARKER = "__komari_exec_timeout__";
