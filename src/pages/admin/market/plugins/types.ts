import { skeletonText } from "@/components/ui/skeleton";
import type { I18nText } from "@/utils/i18nText";

export interface MarketPlugin {
  name: I18nText;
  short: string;
  category?: string;
  description?: I18nText;
  version: string;
  author: I18nText;
  url?: string;
  download: string;
  sha256: string;
  komari?: string;
  installable: boolean;
  source_id: string;
  source_name: string;
}

/** 卡片骨架：一屏常见的插件数量；只用于展示（Skeletonize 期间 inert） */
export const PLACEHOLDER_PLUGINS: MarketPlugin[] = Array.from({ length: 6 }, (_, index) => ({
  name: skeletonText(10 + (index % 3) * 3),
  short: `__km_placeholder_${index}`,
  description: skeletonText(44 - (index % 2) * 14),
  version: skeletonText(5),
  author: skeletonText(8),
  download: "",
  sha256: "",
  installable: true,
  source_id: "__km_placeholder",
  source_name: skeletonText(9),
}));
