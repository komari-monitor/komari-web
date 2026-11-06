export interface MarketSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

/** 目录接口里每个源的拉取状态（error 非空时页面顶部提示） */
export interface MarketSourceStatus {
  id: string;
  name: string;
  url: string;
  count: number;
  error?: string;
}

export type MarketSourceForm = Omit<MarketSource, "id">;

/** 主题市场 / 插件市场：接口路径前缀 /api/admin/<kind>/market */
export type MarketKind = "theme" | "plugin";

export const emptySource = (): MarketSourceForm => ({
  name: "",
  url: "",
  enabled: true,
});
