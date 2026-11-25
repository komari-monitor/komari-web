import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Separator,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { ChevronDown, RefreshCw, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatedNumber } from "@/components/motion";
import { useDashboardWidgetContext } from "@/components/admin/dashboard/widgetContext";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { RankListPopover } from "./RankList";
import {
  convertCurrencyAmount,
  currencySymbolFor,
  fallbackExchangeRates,
  formatMoney,
  getCachedExchangeRates,
  loadExchangeRates,
  TARGET_CURRENCIES,
  type BillingDisplayCurrency,
  type ExchangeRateBundle,
} from "./exchangeRates";
import type { BillingSummary } from "./types";

const DISPLAY_CURRENCY_KEY = "komari_dashboard_billing_currency_v1";

function readStoredCurrency(): BillingDisplayCurrency {
  if (typeof window === "undefined") return "ORIGINAL";
  try {
    const raw = window.localStorage.getItem(DISPLAY_CURRENCY_KEY);
    if (raw && TARGET_CURRENCIES.some((entry) => entry.code === raw)) {
      return raw as BillingDisplayCurrency;
    }
  } catch {
    // 忽略存储读取失败
  }
  return "ORIGINAL";
}

function writeStoredCurrency(code: BillingDisplayCurrency) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISPLAY_CURRENCY_KEY, code);
  } catch {
    // 忽略隐私模式错误
  }
}

/** 持机成本汇总：沿用 DatabaseWidget / ExtraWidget(resources) 的 Radix 键值行与分隔线风格 */
export const BillingWidget = ({
  summary,
  loading = false,
}: {
  summary: BillingSummary;
  loading?: boolean;
}) => {
  const { t } = useTranslation();
  const { height } = useDashboardWidgetContext();
  const [targetCurrency, setTargetCurrency] = useState<BillingDisplayCurrency>(readStoredCurrency);
  const [rateBundle, setRateBundle] = useState<ExchangeRateBundle>(
    () => getCachedExchangeRates() ?? fallbackExchangeRates(),
  );
  const [loadingRates, setLoadingRates] = useState(false);

  const fetchRates = useCallback(async (force = false) => {
    setLoadingRates(true);
    try {
      const next = await loadExchangeRates(force);
      setRateBundle(next);
    } finally {
      setLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    if (targetCurrency === "ORIGINAL") return;
    void fetchRates(false);
  }, [targetCurrency, fetchRates]);

  const handleSelectCurrency = (code: BillingDisplayCurrency) => {
    setTargetCurrency(code);
    writeStoredCurrency(code);
  };

  const converted = useMemo(() => {
    if (targetCurrency === "ORIGINAL") return null;
    let monthly = 0;
    let annual = 0;
    let due30d = 0;
    let oneTime = 0;
    const unconverted: Array<{ label: string; monthly: number; annual: number }> = [];

    for (const item of summary.currencies) {
      const m = item.iso
        ? convertCurrencyAmount(item.monthly, item.iso, targetCurrency, rateBundle.rates)
        : null;
      const a = item.iso
        ? convertCurrencyAmount(item.annual, item.iso, targetCurrency, rateBundle.rates)
        : null;
      const d = item.iso
        ? convertCurrencyAmount(item.due30d, item.iso, targetCurrency, rateBundle.rates)
        : null;
      const o = item.iso
        ? convertCurrencyAmount(item.oneTime, item.iso, targetCurrency, rateBundle.rates)
        : null;
      if (m !== null && a !== null && d !== null && o !== null) {
        monthly += m;
        annual += a;
        due30d += d;
        oneTime += o;
      } else if (item.monthly > 0 || item.annual > 0) {
        unconverted.push({ label: item.label, monthly: item.monthly, annual: item.annual });
      }
    }

    return { monthly, annual, due30d, oneTime, unconverted };
  }, [summary.currencies, targetCurrency, rateBundle.rates]);

  const primaryCurrency = summary.currencies[0] ?? null;
  const hasMultipleCurrencies = summary.currencies.length > 1;
  const symbol = targetCurrency === "ORIGINAL" ? "" : currencySymbolFor(targetCurrency);

  const rateCaption = useMemo(() => {
    if (targetCurrency === "ORIGINAL") return null;
    if (rateBundle.source === "fallback") {
      return t("dashboard.billingRateFallback", "Offline reference rates");
    }
    const time = rateBundle.fetchedAt
      ? new Date(rateBundle.fetchedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "";
    return t("dashboard.billingRateCached", "Rates cached {{time}} · {{provider}}", {
      time,
      provider: rateBundle.provider,
    });
  }, [targetCurrency, rateBundle, t]);

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center" gap="2" style={{ color: "var(--gray-10)" }}>
        <Flex gap="2" align="center">
          <Wallet size={18} />
          <Text size="3" weight="bold">
            {t("dashboardLayout.widgets.billing", "Server cost")}
          </Text>
        </Flex>
        <Flex gap="1" align="center">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button size="1" variant="ghost" color="gray">
                {targetCurrency === "ORIGINAL"
                  ? t("dashboard.billingOriginal", "Original")
                  : targetCurrency}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.RadioGroup
                value={targetCurrency}
                onValueChange={(value) => handleSelectCurrency(value as BillingDisplayCurrency)}
              >
                {TARGET_CURRENCIES.map((entry) => (
                  <DropdownMenu.RadioItem key={entry.code} value={entry.code}>
                    {entry.code === "ORIGINAL"
                      ? t("dashboard.billingOriginal", "Original currency")
                      : `${entry.code} (${entry.symbol})`}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          {summary.groups.length > 0 && (
            <RankListPopover
              title={t("dashboard.billingByGroup", "Cost by group")}
              ariaLabel={t("common.details", "Details")}
            >
              <Flex direction="column" gap="2">
                {summary.groups.map((group) => {
                  const groupLabel = group.group || t("common.ungrouped", "Ungrouped");
                  const convertedGroupMonthly =
                    targetCurrency !== "ORIGINAL"
                      ? group.currencies.reduce((sum, cur) => {
                          const val = cur.iso
                            ? convertCurrencyAmount(
                                cur.monthly,
                                cur.iso,
                                targetCurrency,
                                rateBundle.rates,
                              )
                            : null;
                          return val !== null ? sum + val : sum;
                        }, 0)
                      : null;
                  return (
                    <Flex
                      key={group.group || "__ungrouped"}
                      justify="between"
                      align="center"
                      gap="2"
                      className="border-b border-gray-a4 pb-1.5 last:border-b-0"
                    >
                      <Text size="2" className="truncate" title={groupLabel}>
                        {groupLabel}{" "}
                        <Text size="1" color="gray">
                          ({group.count})
                        </Text>
                      </Text>
                      <Text size="2" weight="bold" className="whitespace-nowrap">
                        {convertedGroupMonthly !== null
                          ? `${formatMoney(convertedGroupMonthly, targetCurrency)}/${t("dashboard.monthShort", "mo")}`
                          : group.currencies
                              .map(
                                (cur) =>
                                  `${formatMoney(cur.monthly, cur.label)}/${t("dashboard.monthShort", "mo")}`,
                              )
                              .join(" + ")}
                      </Text>
                    </Flex>
                  );
                })}
              </Flex>
            </RankListPopover>
          )}
        </Flex>
      </Flex>

      <Skeletonize loading={loading}>
        {loading ? (
          <Flex direction="column" gap="2">
            <Flex justify="between" align="center" gap="2">
              <Text size="2">{skeletonText(6)}</Text>
              <Text size="3" weight="bold">
                {skeletonText(8)}
              </Text>
            </Flex>
            <Flex justify="between" align="center" gap="2">
              <Text size="2">{skeletonText(6)}</Text>
              <Text size="3" weight="bold">
                {skeletonText(8)}
              </Text>
            </Flex>
            <Separator size="4" />
            <Flex justify="between" align="center" gap="2">
              <Text size="2">{skeletonText(8)}</Text>
              <Text size="3" weight="bold">
                {skeletonText(6)}
              </Text>
            </Flex>
          </Flex>
        ) : summary.pricedCount === 0 ? (
          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              {t("dashboard.noBillingData", "No priced servers configured")}
            </Text>
            {summary.freeCount > 0 && (
              <Text size="1" color="gray">
                {t("dashboard.billingFreeCount", "{{count}} free servers", {
                  count: summary.freeCount,
                })}
              </Text>
            )}
          </Flex>
        ) : targetCurrency !== "ORIGINAL" && converted ? (
          <Flex direction="column" gap="2">
            <Flex justify="between" align="center" gap="2">
              <Text size="2" color="gray">
                {t("dashboard.billingMonthly", "Est. monthly")}
              </Text>
              <Text size="3" weight="bold">
                <AnimatedNumber
                  value={converted.monthly}
                  format={(value) => formatMoney(value, symbol)}
                />
              </Text>
            </Flex>
            <Flex justify="between" align="center" gap="2">
              <Text size="2" color="gray">
                {t("dashboard.billingAnnual", "Est. annual")}
              </Text>
              <Text size="3" weight="bold">
                <AnimatedNumber
                  value={converted.annual}
                  format={(value) => formatMoney(value, symbol)}
                />
              </Text>
            </Flex>

            {converted.unconverted.length > 0 && (
              <Text size="1" color="gray">
                +{" "}
                {converted.unconverted
                  .map(
                    (cur) =>
                      `${formatMoney(cur.monthly, cur.label)}/${t("dashboard.monthShort", "mo")}`,
                  )
                  .join(" · ")}
              </Text>
            )}

            <Separator size="4" />

            <Flex justify="between" align="center" gap="2">
              <Text size="2" weight="medium">
                {t("dashboard.billingDue30d", "Due in 30d")}
              </Text>
              <Flex align="center" gap="2">
                <Text size="3" weight="bold">
                  {formatMoney(converted.due30d, symbol)}
                </Text>
                <Badge
                  size="1"
                  variant="soft"
                  color={summary.totalDue30dCount > 0 ? "amber" : "gray"}
                >
                  {t("dashboard.billingServersUnit", "{{count}} servers", {
                    count: summary.totalDue30dCount,
                  })}
                </Badge>
              </Flex>
            </Flex>

            {converted.oneTime > 0 && (
              <Flex justify="between" align="center" gap="2">
                <Text size="1" color="gray">
                  {t("dashboard.billingOneTime", "One-time purchase")}
                </Text>
                <Text size="1" color="gray">
                  {formatMoney(converted.oneTime, symbol)} ({summary.oneTimeCount})
                </Text>
              </Flex>
            )}

            <Flex justify="between" align="center" gap="2" mt="1">
              <Text size="1" color="gray" className="truncate" title={rateCaption ?? undefined}>
                {rateCaption}
              </Text>
              <Tooltip content={t("dashboard.billingRefreshRates", "Refresh exchange rates")}>
                <IconButton
                  size="1"
                  variant="ghost"
                  color="gray"
                  disabled={loadingRates}
                  aria-label={t("dashboard.billingRefreshRates", "Refresh exchange rates")}
                  onClick={() => void fetchRates(true)}
                >
                  <RefreshCw size={12} className={loadingRates ? "animate-spin" : ""} />
                </IconButton>
              </Tooltip>
            </Flex>
          </Flex>
        ) : (
          <Flex direction="column" gap="2">
            {!hasMultipleCurrencies && primaryCurrency ? (
              <>
                <Flex justify="between" align="center" gap="2">
                  <Text size="2" color="gray">
                    {t("dashboard.billingMonthly", "Est. monthly")}
                  </Text>
                  <Text size="3" weight="bold">
                    <AnimatedNumber
                      value={primaryCurrency.monthly}
                      format={(value) => formatMoney(value, primaryCurrency.label)}
                    />
                  </Text>
                </Flex>
                <Flex justify="between" align="center" gap="2">
                  <Text size="2" color="gray">
                    {t("dashboard.billingAnnual", "Est. annual")}
                  </Text>
                  <Text size="3" weight="bold">
                    <AnimatedNumber
                      value={primaryCurrency.annual}
                      format={(value) => formatMoney(value, primaryCurrency.label)}
                    />
                  </Text>
                </Flex>
              </>
            ) : (
              <>
                {(height === "short" ? summary.currencies.slice(0, 2) : summary.currencies).map(
                  (cur) => (
                    <Flex key={cur.label} justify="between" align="center" gap="2">
                      <Flex align="center" gap="2">
                        <Badge size="1" variant="soft" color="gray">
                          {cur.iso ?? cur.label}
                        </Badge>
                        <Text size="1" color="gray">
                          {cur.recurringCount}
                        </Text>
                      </Flex>
                      <Flex align="baseline" gap="2" className="whitespace-nowrap">
                        <Text size="3" weight="bold">
                          {formatMoney(cur.monthly, cur.label)}
                          <Text size="1" color="gray" weight="regular">
                            /{t("dashboard.monthShort", "mo")}
                          </Text>
                        </Text>
                        <Text size="1" color="gray">
                          · {formatMoney(cur.annual, cur.label)}/{t("dashboard.yearShort", "yr")}
                        </Text>
                      </Flex>
                    </Flex>
                  ),
                )}
                {height === "short" && summary.currencies.length > 2 && (
                  <Text size="1" color="gray">
                    {t("dashboard.billingMoreCurrencies", "+{{count}} more", {
                      count: summary.currencies.length - 2,
                    })}
                  </Text>
                )}
              </>
            )}

            <Separator size="4" />

            <Flex justify="between" align="center" gap="2">
              <Text size="2" weight="medium">
                {t("dashboard.billingDue30d", "Due in 30d")}
              </Text>
              <Flex align="center" gap="2">
                {summary.totalDue30dCount > 0 ? (
                  <Text size="3" weight="bold" className="truncate">
                    {summary.currencies
                      .filter((cur) => cur.due30d > 0)
                      .map((cur) => formatMoney(cur.due30d, cur.label))
                      .join(" + ")}
                  </Text>
                ) : (
                  <Text size="3" weight="bold" color="gray">
                    0
                  </Text>
                )}
                <Badge
                  size="1"
                  variant="soft"
                  color={summary.totalDue30dCount > 0 ? "amber" : "gray"}
                >
                  {t("dashboard.billingServersUnit", "{{count}} servers", {
                    count: summary.totalDue30dCount,
                  })}
                </Badge>
              </Flex>
            </Flex>

            <Flex justify="between" align="center" gap="2" wrap="wrap" mt="1">
              <Text size="1" color="gray">
                {t("dashboard.billingFooter", "Priced {{priced}} · Free {{free}}", {
                  priced: summary.pricedCount,
                  free: summary.freeCount,
                })}
                {summary.oneTimeCount > 0
                  ? ` · ${t("dashboard.billingOneTimeShort", "Once {{count}}", { count: summary.oneTimeCount })}`
                  : ""}
              </Text>
              {hasMultipleCurrencies && (
                <Button
                  size="1"
                  variant="ghost"
                  onClick={() => handleSelectCurrency("CNY")}
                >
                  {t("dashboard.billingConvertHint", "Convert to CNY")}
                </Button>
              )}
            </Flex>
          </Flex>
        )}
      </Skeletonize>
    </Flex>
  );
};
