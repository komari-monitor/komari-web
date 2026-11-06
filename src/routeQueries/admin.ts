import { api } from "@/lib/http";
import { prefetchRouteQuery, routeQuery } from "@/lib/routeData";
import { registerRouteData } from "@/lib/routeRegistry";

/** 会话管理：只看 HTTP 状态，不检查响应体的 status 字段 */
export type SessionsResponse = {
  current: string;
  data: Array<{
    uuid: string;
    session: string;
    user_agent: string;
    ip: string;
    login_method: string;
    latest_online: string;
    latest_ip: string;
    latest_user_agent: string;
    expires: string;
    created_at: string;
  }>;
  status: string;
};

export const sessionsQuery = routeQuery("admin/sessions", () =>
  api.get<SessionsResponse>("/api/admin/session/get", { expectSuccess: false }),
);

registerRouteData("/admin/sessions", () => prefetchRouteQuery(sessionsQuery));
