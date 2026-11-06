import { skeletonText } from "@/components/ui/skeleton";
import type { I18nText } from "@/utils/i18nText";

export interface Theme {
  id: string;
  name: I18nText;
  short: string;
  description?: I18nText;
  author?: I18nText;
  version: string;
  preview?: string;
  url?: string;
  active: boolean;
  createdAt: string;
  configuration?: any;
}

/** 从仓库导入前的检查结果 */
export interface ThemeImportPreview {
  theme: Omit<Theme, "id" | "active" | "createdAt">;
  exists: boolean;
}

/** 卡片骨架：常见的已安装主题数量；只用于展示（Skeletonize 期间 inert） */
export const PLACEHOLDER_THEMES: Theme[] = Array.from({ length: 4 }, (_, index) => ({
  id: `__km_placeholder_${index}`,
  name: skeletonText(9 + (index % 3) * 3),
  short: `__km_placeholder_${index}`,
  author: skeletonText(7),
  version: skeletonText(5),
  active: false,
  createdAt: "",
}));
