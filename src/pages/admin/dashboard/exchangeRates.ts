/**
 * 免费公开汇率服务（零 Key、浏览器端多级缓存、离线自动降级）：
 * 1. 优先尝试 open.er-api.com/v6/latest/USD（自带下次更新时间，约 24h 更新一次，天然节流）
 * 2. 备用 jsDelivr CDN 上的 fawazahmed0/currency-api（全球 CDN，无限次）
 * 3. 全部不可达时优先沿用本地过期缓存，其次降级为内置静态参考汇率
 */

const CACHE_KEY = "komari_dashboard_exchange_rates_v1";
const MIN_CACHE_TTL_MS = 12 * 3600 * 1000; // 至少 12 小时内不重复请求
const MAX_CACHE_TTL_MS = 24 * 3600 * 1000; // 最长 24 小时
const FETCH_TIMEOUT_MS = 5_000;

export type ExchangeRateSource = "live" | "cache" | "fallback";

export type ExchangeRateBundle = {
  /** 以 USD = 1 为基准的汇率表（ISO-4217 大写三字母代码 -> 兑 1 USD 汇率） */
  rates: Record<string, number>;
  fetchedAt: number;
  expiresAt: number;
  source: ExchangeRateSource;
  provider: string;
};

/** 离线兜底参考汇率（以 1 USD 为基准） */
export const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  CNY: 7.24,
  EUR: 0.92,
  GBP: 0.79,
  HKD: 7.78,
  TWD: 32.1,
  JPY: 152.0,
  SGD: 1.34,
  CAD: 1.38,
  AUD: 1.53,
  NZD: 1.66,
  KRW: 1380,
  RUB: 92.0,
  TRY: 34.2,
  CHF: 0.88,
  MYR: 4.42,
  THB: 34.5,
  VND: 25300,
  INR: 84.0,
  BRL: 5.7,
  PLN: 4.02,
  UAH: 41.2,
  AED: 3.67,
  IDR: 15700,
};

export const TARGET_CURRENCIES = [
  { code: "ORIGINAL", symbol: "" },
  { code: "CNY", symbol: "¥" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "HKD", symbol: "HK$" },
  { code: "TWD", symbol: "NT$" },
  { code: "JPY", symbol: "JP¥" },
  { code: "GBP", symbol: "£" },
  { code: "SGD", symbol: "S$" },
] as const;

export type BillingDisplayCurrency = (typeof TARGET_CURRENCIES)[number]["code"];

const CURRENCY_SYMBOL_BY_CODE: Record<string, string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  GBP: "£",
  HKD: "HK$",
  TWD: "NT$",
  JPY: "JP¥",
  SGD: "S$",
  CAD: "C$",
  AUD: "A$",
  KRW: "₩",
  RUB: "₽",
  TRY: "₺",
  CHF: "CHF ",
  INR: "₹",
  MYR: "RM",
  THB: "฿",
  VND: "₫",
  IDR: "Rp",
};

const SYMBOL_TO_ISO: Record<string, string> = {
  "$": "USD",
  "US$": "USD",
  "USD": "USD",
  "¥": "CNY",
  "￥": "CNY",
  "RMB": "CNY",
  "CNY": "CNY",
  "CN¥": "CNY",
  "CN￥": "CNY",
  "元": "CNY",
  "€": "EUR",
  "EUR": "EUR",
  "£": "GBP",
  "GBP": "GBP",
  "HK$": "HKD",
  "HKD": "HKD",
  "NT$": "TWD",
  "TWD": "TWD",
  "JP¥": "JPY",
  "JP￥": "JPY",
  "JPY": "JPY",
  "円": "JPY",
  "S$": "SGD",
  "SGD": "SGD",
  "C$": "CAD",
  "CA$": "CAD",
  "CAD": "CAD",
  "A$": "AUD",
  "AU$": "AUD",
  "AUD": "AUD",
  "NZ$": "NZD",
  "NZD": "NZD",
  "₩": "KRW",
  "KRW": "KRW",
  "₽": "RUB",
  "RUB": "RUB",
  "₺": "TRY",
  "TRY": "TRY",
  "₹": "INR",
  "INR": "INR",
  "RM": "MYR",
  "MYR": "MYR",
  "฿": "THB",
  "THB": "THB",
  "₫": "VND",
  "VND": "VND",
  "RP": "IDR",
  "IDR": "IDR",
};

/** 清理节点自由输入的货币文本，把同义符号归一化（如 ￥ -> ¥） */
export function normalizeCurrencyLabel(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "$";
  if (trimmed === "￥") return "¥";
  return trimmed;
}

/** 尝试将节点货币标识解析为 ISO-4217 三字母代码（用于汇率换算） */
export function resolveCurrencyISO(raw: string | undefined | null): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "USD";
  const upper = trimmed.toUpperCase();
  if (SYMBOL_TO_ISO[trimmed]) return SYMBOL_TO_ISO[trimmed];
  if (SYMBOL_TO_ISO[upper]) return SYMBOL_TO_ISO[upper];
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return null;
}

export function currencySymbolFor(code: string): string {
  return CURRENCY_SYMBOL_BY_CODE[code.toUpperCase()] ?? `${code.toUpperCase()} `;
}

export function formatMoney(amount: number, symbolOrCode: string): string {
  if (!Number.isFinite(amount)) return "-";
  const prefix = /^[A-Z]{3}$/.test(symbolOrCode)
    ? currencySymbolFor(symbolOrCode)
    : symbolOrCode;
  const abs = Math.abs(amount);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${prefix}${formatted}`;
}

export function convertCurrencyAmount(
  amount: number,
  fromISO: string,
  toISO: string,
  rates: Record<string, number>,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (fromISO === toISO) return amount;
  const fromRate = rates[fromISO];
  const toRate = rates[toISO];
  if (!fromRate || !toRate || fromRate <= 0 || toRate <= 0) return null;
  return (amount / fromRate) * toRate;
}

// ---------------------------------------------------------------------------
// 缓存与请求去重
// ---------------------------------------------------------------------------

let memoryCache: ExchangeRateBundle | null = null;
let inflight: Promise<ExchangeRateBundle> | null = null;

function sanitizeRates(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = { USD: 1 };
  let count = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const code = key.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) continue;
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) {
      out[code] = num;
      count += 1;
    }
  }
  return count >= 5 && out.CNY ? out : null;
}

function readLocalCache(): ExchangeRateBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExchangeRateBundle>;
    const rates = sanitizeRates(parsed.rates);
    if (!rates || typeof parsed.fetchedAt !== "number" || typeof parsed.expiresAt !== "number") {
      return null;
    }
    return {
      rates,
      fetchedAt: parsed.fetchedAt,
      expiresAt: parsed.expiresAt,
      source: "cache",
      provider: typeof parsed.provider === "string" ? parsed.provider : "open.er-api.com",
    };
  } catch {
    return null;
  }
}

function writeLocalCache(bundle: ExchangeRateBundle) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
  } catch {
    // 忽略隐私模式或配额满错误
  }
}

export function getCachedExchangeRates(): ExchangeRateBundle | null {
  if (memoryCache) return memoryCache;
  const local = readLocalCache();
  if (local) memoryCache = local;
  return local;
}

export function fallbackExchangeRates(): ExchangeRateBundle {
  return {
    rates: FALLBACK_USD_RATES,
    fetchedAt: 0,
    expiresAt: 0,
    source: "fallback",
    provider: "builtin",
  };
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchFromPublicProviders(): Promise<ExchangeRateBundle> {
  const now = Date.now();

  // 1. 优先 open.er-api.com（免费免 Key、CORS 友好、约每日更新一次并附带下次更新时间）
  try {
    const data = (await fetchJsonWithTimeout("https://open.er-api.com/v6/latest/USD")) as {
      result?: string;
      time_next_update_unix?: number;
      rates?: Record<string, number>;
    };
    const rates = data?.result === "success" ? sanitizeRates(data.rates) : null;
    if (rates) {
      const upstreamNext =
        typeof data.time_next_update_unix === "number"
          ? data.time_next_update_unix * 1000
          : 0;
      const expiresAt = Math.min(
        now + MAX_CACHE_TTL_MS,
        Math.max(now + MIN_CACHE_TTL_MS, upstreamNext),
      );
      return {
        rates,
        fetchedAt: now,
        expiresAt,
        source: "live",
        provider: "open.er-api.com",
      };
    }
  } catch {
    // 尝试备用免费 CDN 接口
  }

  // 2. 备用 jsDelivr CDN 托管的 currency-api（全球 CDN，无限次免费）
  const cdnData = (await fetchJsonWithTimeout(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
  )) as { usd?: Record<string, number> };
  const cdnRates = sanitizeRates(cdnData?.usd);
  if (cdnRates) {
    return {
      rates: cdnRates,
      fetchedAt: now,
      expiresAt: now + MIN_CACHE_TTL_MS,
      source: "live",
      provider: "currency-api (jsDelivr)",
    };
  }

  throw new Error("All public exchange rate providers failed");
}

/**
 * 获取汇率（优先命中有效期内的内存 / localStorage 缓存，极大节约请求；
 * force = true 用于用户手动点击刷新）。
 */
export async function loadExchangeRates(force = false): Promise<ExchangeRateBundle> {
  const now = Date.now();
  const cached = getCachedExchangeRates();
  if (!force && cached && cached.expiresAt > now) {
    return cached;
  }
  if (!force && inflight) {
    return inflight;
  }

  const promise = fetchFromPublicProviders()
    .then((fresh) => {
      memoryCache = fresh;
      writeLocalCache(fresh);
      return fresh;
    })
    .catch(() => {
      // 网络不可用时优先沿用旧缓存，其次降级静态表
      if (cached) return { ...cached, source: "cache" as const };
      return fallbackExchangeRates();
    })
    .finally(() => {
      if (inflight === promise) inflight = null;
    });

  inflight = promise;
  return promise;
}
