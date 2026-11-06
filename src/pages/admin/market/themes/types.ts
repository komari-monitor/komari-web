import type { I18nText } from "@/utils/i18nText";

export interface MarketTheme {
  name: I18nText;
  short: string;
  description: I18nText;
  version: string;
  author: I18nText;
  url: string;
  preview: string;
  download: string;
  sha256: string;
  installable: boolean;
  source_id: string;
  source_name: string;
}

export interface InstalledTheme {
  short: string;
  version: string;
}
