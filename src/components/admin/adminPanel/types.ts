import type { MenuItem } from "@/types/menu";

// 扩展的菜单项类型（允许直接提供 rawLabel 而不是多语言 key）
export interface ExtendedMenuItem extends MenuItem {
  rawLabel?: string; // 不走 i18n，直接显示
  reloadDocument?: boolean;
}

// GitHub 发布信息（更新检测）
export interface GithubReleaseInfo {
  tag_name: string;
  name?: string;
  body?: string;
  html_url: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
}
