import { emojiToRegionMap } from "./regionHelper";

const REGIONAL_INDICATOR_START = 0x1f1e6;
const REGIONAL_INDICATOR_END = 0x1f1ff;
const ASCII_ALPHA_START = 0x41;

/** 将国旗 Emoji（如 🇯🇵）解析为两字母 ISO 国家码（如 JP） */
export function getCountryCodeFromFlagEmoji(emoji: string): string | null {
  if (!emoji) return null;
  const chars = Array.from(emoji.trim());
  if (chars.length !== 2) return null;
  const cp1 = chars[0].codePointAt(0);
  const cp2 = chars[1].codePointAt(0);
  if (
    cp1 === undefined ||
    cp2 === undefined ||
    cp1 < REGIONAL_INDICATOR_START ||
    cp1 > REGIONAL_INDICATOR_END ||
    cp2 < REGIONAL_INDICATOR_START ||
    cp2 > REGIONAL_INDICATOR_END
  ) {
    return null;
  }
  const c1 = String.fromCodePoint(cp1 - REGIONAL_INDICATOR_START + ASCII_ALPHA_START);
  const c2 = String.fromCodePoint(cp2 - REGIONAL_INDICATOR_START + ASCII_ALPHA_START);
  return `${c1}${c2}`;
}

/** 将两字母 ISO 国家码（如 JP）转换为国旗 Emoji（如 🇯🇵） */
export function countryCodeToFlagEmoji(code: string): string {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🌐";
  return String.fromCodePoint(
    upper.charCodeAt(0) - ASCII_ALPHA_START + REGIONAL_INDICATOR_START,
    upper.charCodeAt(1) - ASCII_ALPHA_START + REGIONAL_INDICATOR_START,
  );
}

/**
 * 解析节点 region 字段为 ISO-3166 两字母国家码（用于旗帜文件与地理坐标查询）。
 * 无法识别或显式未知地区返回 "UN"。
 */
export function resolveCountryCode(region: string | null | undefined): string {
  if (!region) return "UN";
  const trimmed = region.trim();
  if (!trimmed || trimmed === "🇺🇳" || trimmed === "🌐") return "UN";
  const fromEmoji = getCountryCodeFromFlagEmoji(trimmed);
  if (fromEmoji) return fromEmoji;
  if (/^[a-zA-Z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return "UN";
}

/** 国家/地区 ISO 两字母代码 -> [纬度, 经度] 质心坐标 */
export const COUNTRY_CENTROIDS: Record<string, readonly [number, number]> = {
  // 东亚 / 港澳台
  CN: [35.0, 104.2],
  HK: [22.32, 114.17],
  MO: [22.2, 113.55],
  TW: [23.7, 121.0],
  JP: [36.2, 138.25],
  KR: [36.5, 127.8],
  MN: [46.9, 103.8],
  // 东南亚
  SG: [1.35, 103.82],
  MY: [4.2, 101.97],
  TH: [15.87, 100.99],
  VN: [14.06, 108.28],
  PH: [12.88, 121.77],
  ID: [-2.5, 118.0],
  KH: [12.57, 104.99],
  LA: [19.86, 102.5],
  MM: [21.91, 95.96],
  BN: [4.54, 114.73],
  // 南亚 / 中亚
  IN: [20.59, 78.96],
  PK: [30.38, 69.35],
  BD: [23.68, 90.36],
  LK: [7.87, 80.77],
  NP: [28.39, 84.12],
  KZ: [48.02, 66.92],
  UZ: [41.38, 64.59],
  KG: [41.2, 74.77],
  // 中东 / 西亚
  AE: [24.45, 54.38],
  SA: [23.89, 45.08],
  IL: [31.05, 34.85],
  TR: [38.96, 35.24],
  QA: [25.35, 51.18],
  KW: [29.31, 47.48],
  BH: [26.07, 50.56],
  OM: [21.47, 55.98],
  JO: [30.59, 36.24],
  IQ: [33.22, 43.68],
  IR: [32.43, 53.69],
  AM: [40.07, 45.04],
  GE: [42.32, 43.36],
  AZ: [40.14, 47.58],
  CY: [35.13, 33.43],
  // 欧洲
  GB: [54.5, -2.5],
  IE: [53.41, -8.24],
  IS: [64.96, -19.02],
  FR: [46.23, 2.21],
  DE: [51.17, 10.45],
  NL: [52.13, 5.29],
  BE: [50.5, 4.47],
  LU: [49.82, 6.13],
  CH: [46.82, 8.23],
  AT: [47.52, 14.55],
  IT: [41.87, 12.57],
  ES: [40.46, -3.75],
  PT: [39.4, -8.22],
  NO: [60.47, 8.47],
  SE: [60.13, 18.64],
  FI: [61.92, 25.75],
  DK: [56.26, 9.5],
  PL: [51.92, 19.15],
  CZ: [49.82, 15.47],
  SK: [48.67, 19.7],
  HU: [47.16, 19.5],
  RO: [45.94, 24.97],
  BG: [42.73, 25.49],
  GR: [39.07, 21.82],
  HR: [45.1, 15.2],
  SI: [46.15, 14.99],
  RS: [44.02, 21.01],
  BA: [43.92, 17.68],
  AL: [41.15, 20.17],
  MK: [41.61, 21.75],
  ME: [42.71, 19.37],
  EE: [58.6, 25.01],
  LV: [56.88, 24.6],
  LT: [55.17, 23.88],
  UA: [48.38, 31.17],
  BY: [53.71, 27.95],
  MD: [47.41, 28.37],
  RU: [61.52, 95.0],
  MT: [35.94, 14.38],
  // 北美 / 中美 / 加勒比
  US: [39.83, -98.58],
  CA: [56.13, -106.35],
  MX: [23.63, -102.55],
  PA: [8.54, -80.78],
  CR: [9.75, -83.75],
  NI: [12.87, -85.21],
  HN: [15.2, -86.24],
  GT: [15.78, -90.23],
  BZ: [17.19, -88.5],
  SV: [13.79, -88.9],
  JM: [18.11, -77.3],
  CU: [21.52, -77.78],
  DO: [18.74, -70.16],
  HT: [18.97, -72.29],
  BS: [25.03, -77.4],
  BB: [13.19, -59.54],
  TT: [10.69, -61.22],
  PR: [18.22, -66.59],
  GL: [71.71, -42.6],
  // 南美
  BR: [-14.24, -51.93],
  AR: [-38.42, -63.62],
  CL: [-35.68, -71.54],
  CO: [4.57, -74.3],
  PE: [-9.19, -75.02],
  VE: [6.42, -66.59],
  UY: [-32.52, -55.77],
  EC: [-1.83, -78.18],
  BO: [-16.29, -63.59],
  PY: [-23.44, -58.44],
  GY: [4.86, -58.93],
  SR: [3.92, -56.03],
  FK: [-51.8, -59.52],
  GF: [3.93, -53.13],
  // 大洋洲
  AU: [-25.27, 133.78],
  NZ: [-40.9, 174.89],
  // 非洲
  ZA: [-30.56, 22.94],
  EG: [26.82, 30.8],
  MA: [31.79, -7.09],
  DZ: [28.03, 1.66],
  TN: [33.89, 9.54],
  LY: [26.34, 17.23],
  NG: [9.08, 8.68],
  KE: [-0.02, 37.91],
  ET: [9.15, 40.49],
  GH: [7.95, -1.02],
  UG: [1.37, 32.29],
  TZ: [-6.37, 34.89],
  RW: [-1.94, 29.87],
  ZW: [-19.02, 29.15],
  ZM: [-13.13, 27.85],
  BW: [-22.33, 24.68],
  NA: [-22.96, 18.49],
  SD: [12.86, 30.22],
  SS: [6.88, 31.31],
  CD: [-4.04, 21.76],
  CG: [-0.23, 15.83],
  CF: [6.61, 20.94],
  CM: [7.37, 12.35],
  TD: [15.45, 18.73],
  NE: [17.61, 8.08],
  ML: [17.57, -4.0],
  BF: [12.24, -1.56],
  SN: [14.5, -14.45],
  GM: [13.44, -15.31],
  GW: [11.8, -15.18],
  GN: [9.95, -9.7],
  SL: [8.46, -11.78],
  LR: [6.43, -9.43],
  CI: [7.54, -5.55],
  TG: [8.62, 0.82],
  BJ: [9.31, 2.32],
  MU: [-20.35, 57.55],
  MG: [-18.77, 46.87],
  AO: [-11.2, 17.87],
};

/** 通过两字母国家码获取本地化地区名称（优先浏览器 Intl.DisplayNames，回退内置字典与代码） */
export function getCountryDisplayName(code: string, locale: string): string {
  const upper = code.trim().toUpperCase();
  if (!upper || upper === "UN") return "";
  try {
    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
      const display = new Intl.DisplayNames([locale || "en"], { type: "region" });
      const resolved = display.of(upper);
      if (resolved && resolved !== upper) return resolved;
    }
  } catch {
    // 忽略不受支持的 locale，回退静态字典
  }
  const emoji = countryCodeToFlagEmoji(upper);
  const info = emojiToRegionMap[emoji];
  if (info) {
    return locale.toLowerCase().startsWith("zh") ? info.zh : info.en;
  }
  return upper;
}
