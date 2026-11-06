import { createGuideRequest } from "../api";
import { API_BASE } from "./constants";

export const request = createGuideRequest(API_BASE);

/** 迁移结束后监听器切回正常路由：/ping 返回 200 即可跳回首页 */
export async function normalRouterAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/ping", {
      cache: "no-store",
      redirect: "manual",
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
