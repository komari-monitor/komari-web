import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Activity, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNodeDetails, type NodeDetail } from "@/contexts/NodeDetailsContext";
import { errorMessage } from "@/lib/http";
import { TRAFFIC_TIMEZONE_SUGGESTIONS } from "@/utils/timezones";
import { formatBytes, stringToBytes } from "@/utils/unitHelper";
import {
  calibrateClientTrafficLedger,
  configureClientTrafficLedger,
  getClientTrafficLedger,
  resetClientTrafficLedger,
  type ClientTrafficLedger,
  type TrafficCycleMode,
} from "./api";

type CalibrationMode = "targets" | "total" | "deltas";

type TrafficConfigForm = {
  mode: TrafficCycleMode;
  resetDay: string;
  intervalDays: string;
  anchorDate: string;
  timezone: string;
  trafficLimit: string;
  trafficLimitType: string;
};

const cycleModes: TrafficCycleMode[] = ["agent", "monthly", "fixed_days", "manual"];
const modeLabels: Record<TrafficCycleMode, string> = {
  agent: "admin.trafficLedger.modeAgent",
  monthly: "admin.trafficLedger.modeMonth",
  fixed_days: "admin.trafficLedger.modeInterval",
  manual: "admin.trafficLedger.modeManual",
};
const limitTypes = ["sum", "max", "min", "up", "down"];

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined, timezone: string, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
    if (timezone && timezone !== "Local") options.timeZone = timezone;
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
}

function formatSignedBytes(value: number) {
  if (value === 0) return "0 B";
  const formatted = formatBytes(Math.abs(value));
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

function parseCalibrationValue(value: string, signed: boolean) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (signed && trimmed.startsWith("-")) {
    if (trimmed.length === 1) return undefined;
    const parsed = stringToBytes(trimmed.slice(1));
    return parsed === null ? undefined : -parsed;
  }
  if (signed && trimmed === "+") return undefined;
  const parsed = stringToBytes(trimmed.startsWith("+") ? trimmed.slice(1) : trimmed);
  return parsed === null ? undefined : parsed;
}

export default function TrafficButton({
  node,
  defaultTimezone = "",
}: {
  node: NodeDetail;
  defaultTimezone?: string;
}) {
  const { t, i18n } = useTranslation();
  const { refresh } = useNodeDetails();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [ledger, setLedger] = useState<ClientTrafficLedger | null>(null);
  const [agentMonthRotate, setAgentMonthRotate] = useState(false);
  const [checkedAgentForMode, setCheckedAgentForMode] = useState(false);
  const [busy, setBusy] = useState<"config" | "calibration" | "reset" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const [config, setConfig] = useState<TrafficConfigForm>({
    mode: "agent",
    resetDay: "1",
    intervalDays: "30",
    anchorDate: todayDateString(),
    timezone: "",
    trafficLimit: "0 B",
    trafficLimitType: "sum",
  });
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>("targets");
  const [targetUp, setTargetUp] = useState("");
  const [targetDown, setTargetDown] = useState("");
  const [targetTotal, setTargetTotal] = useState("");
  const [deltaUp, setDeltaUp] = useState("");
  const [deltaDown, setDeltaDown] = useState("");
  const [suppressAlert, setSuppressAlert] = useState(true);
  const [calibrationNote, setCalibrationNote] = useState("");

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await getClientTrafficLedger(node.uuid);
      setLedger(result);
      setConfig({
        mode: result.mode,
        resetDay: String(result.reset_day ?? 1),
        intervalDays: String(result.interval_days ?? 30),
        anchorDate: result.anchor_date || (result.anchor_at ? result.anchor_at.slice(0, 10) : todayDateString()),
        timezone: result.timezone && result.timezone !== "Local" ? result.timezone : "",
        trafficLimit: formatBytes(Number(result.traffic_limit) || 0),
        trafficLimitType: result.traffic_limit_type || "sum",
      });
      const up = Number(result.effective_up) || 0;
      const down = Number(result.effective_down) || 0;
      setTargetUp(formatBytes(up));
      setTargetDown(formatBytes(down));
      setTargetTotal(formatBytes(up + down));
      if ((result.traffic_limit_type || "sum") !== "sum") {
        setCalibrationMode((current) => (current === "total" ? "targets" : current));
      }
    } catch (error) {
      setLoadError(errorMessage(error, t("admin.trafficLedger.loadError")));
    } finally {
      setLoading(false);
    }
  }, [node.uuid, t]);

  useEffect(() => {
    if (!open) return;
    setLedger(null);
    setAgentMonthRotate(false);
    setCheckedAgentForMode(false);
    setConfirmReset(false);
    void loadLedger();
  }, [open, loadLedger]);

  // 仅在服务端周期模式下按需检查被控端是否同时开启了 --month-rotate
  useEffect(() => {
    if (!open || !ledger || ledger.mode === "agent" || checkedAgentForMode) return;
    setCheckedAgentForMode(true);
    void getClientTrafficLedger(node.uuid, true)
      .then((result) => setAgentMonthRotate(result.agent_month_rotate === true))
      .catch(() => setAgentMonthRotate(false));
  }, [checkedAgentForMode, ledger, node.uuid, open]);

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const updateConfig = <K extends keyof TrafficConfigForm>(key: K, value: TrafficConfigForm[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const handleFillBilling = () => {
    if (!node.billing_cycle || node.billing_cycle <= 0) {
      toast.info(t("admin.trafficLedger.fillBillingEmpty"));
      return;
    }
    const rawExpired = node.expired_at ? node.expired_at.slice(0, 10) : "";
    const anchorDate = rawExpired && !rawExpired.startsWith("0001-") ? rawExpired : todayDateString();
    setConfig((current) => ({
      ...current,
      mode: "fixed_days",
      intervalDays: String(node.billing_cycle),
      anchorDate,
    }));
  };

  const handleConfigSave = async () => {
    const trafficLimit = stringToBytes(config.trafficLimit);
    const resetDay = Number(config.resetDay);
    const intervalDays = Number(config.intervalDays);
    if (trafficLimit === null || trafficLimit < 0) {
      toast.error(t("admin.nodeEdit.trafficLimitInvalid"));
      return;
    }
    if (config.mode === "monthly" && (!Number.isInteger(resetDay) || resetDay < 1 || resetDay > 31)) {
      toast.error(t("settings.invalid_integer"));
      return;
    }
    if (config.mode === "fixed_days" && (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 36500)) {
      toast.error(t("settings.invalid_integer"));
      return;
    }
    if (config.mode === "fixed_days" && !/^\d{4}-\d{2}-\d{2}$/.test(config.anchorDate)) {
      toast.error(t("admin.trafficLedger.anchorDate"));
      return;
    }
    const timezone = config.timezone.trim();
    if (timezone) {
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch {
        toast.error(t("settings.general.traffic_timezone_invalid"));
        return;
      }
    }

    setBusy("config");
    try {
      await configureClientTrafficLedger(node.uuid, {
        mode: config.mode,
        reset_day: Number.isInteger(resetDay) ? resetDay : 1,
        interval_days: Number.isInteger(intervalDays) ? intervalDays : 30,
        ...(config.mode === "fixed_days" ? { anchor_date: config.anchorDate } : {}),
        timezone,
        traffic_limit: trafficLimit,
        traffic_limit_type: config.trafficLimitType,
      });
      setCheckedAgentForMode(false);
      refresh();
      await loadLedger();
      toast.success(t("admin.trafficLedger.configSaved"));
    } catch (error) {
      toast.error(`${t("admin.trafficLedger.configError")}: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleCalibration = async () => {
    const payload: {
      target_up?: number;
      target_down?: number;
      target_total?: number;
      delta_up?: number;
      delta_down?: number;
      suppress_alert: boolean;
      note?: string;
    } = {
      suppress_alert: suppressAlert,
      ...(calibrationNote.trim() ? { note: calibrationNote.trim() } : {}),
    };

    if (calibrationMode === "total") {
      const total = parseCalibrationValue(targetTotal, false);
      if (total === null || total === undefined) {
        toast.error(t("admin.trafficLedger.targetTotal"));
        return;
      }
      payload.target_total = total;
    } else {
      const isDelta = calibrationMode === "deltas";
      const up = parseCalibrationValue(isDelta ? deltaUp : targetUp, isDelta);
      const down = parseCalibrationValue(isDelta ? deltaDown : targetDown, isDelta);
      if (up === undefined || down === undefined || (up === null && down === null)) {
        toast.error(t("admin.trafficLedger.calibrationHeading"));
        return;
      }
      if (isDelta) {
        if (up !== null) payload.delta_up = up;
        if (down !== null) payload.delta_down = down;
      } else {
        if (up !== null) payload.target_up = up;
        if (down !== null) payload.target_down = down;
      }
    }

    setBusy("calibration");
    try {
      await calibrateClientTrafficLedger(node.uuid, payload);
      setDeltaUp("");
      setDeltaDown("");
      setCalibrationNote("");
      refresh();
      await loadLedger();
      toast.success(t("admin.trafficLedger.calibrateSuccess"));
    } catch (error) {
      toast.error(`${t("admin.trafficLedger.calibrateError")}: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleClearOffsets = async () => {
    if (!ledger || !serverManaged) return;
    setBusy("calibration");
    try {
      await calibrateClientTrafficLedger(node.uuid, {
        target_up: Number(ledger.accumulated_up) || 0,
        target_down: Number(ledger.accumulated_down) || 0,
        suppress_alert: true,
        note: t("admin.trafficLedger.clearOffsets"),
      });
      refresh();
      await loadLedger();
      toast.success(t("admin.trafficLedger.clearOffsetsSuccess"));
    } catch (error) {
      toast.error(`${t("admin.trafficLedger.calibrateError")}: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    setBusy("reset");
    try {
      await resetClientTrafficLedger(node.uuid);
      setConfirmReset(false);
      refresh();
      await loadLedger();
      toast.success(t("admin.trafficLedger.resetSuccess"));
    } catch (error) {
      toast.error(`${t("admin.trafficLedger.resetError")}: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy !== null;
  const serverManaged = Boolean(ledger && ledger.mode !== "agent");
  const displayTimezone = ledger?.timezone && ledger.timezone !== "Local" ? ledger.timezone : defaultTimezone;
  const formatTs = (value?: string | null) => formatDate(value, displayTimezone, i18n.language);

  const cycleRemaining = (endIso: string) => {
    const diff = Date.parse(endIso) - now;
    if (!Number.isFinite(diff)) return "";
    if (diff <= 0) return t("admin.trafficLedger.cycleEnded");
    const totalMinutes = Math.ceil(diff / 60_000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return t("admin.trafficLedger.cycleRemaining", { days, hours });
    return t("admin.trafficLedger.cycleRemainingShort", { hours, minutes });
  };

  const effectiveUp = Number(ledger?.effective_up) || 0;
  const effectiveDown = Number(ledger?.effective_down) || 0;
  const effectiveTotal = effectiveUp + effectiveDown;
  const accumulatedUp = Number(ledger?.accumulated_up) || 0;
  const accumulatedDown = Number(ledger?.accumulated_down) || 0;
  const currentOffsetUp = Number(ledger?.offset_up) || 0;
  const currentOffsetDown = Number(ledger?.offset_down) || 0;
  const hasOffset = currentOffsetUp !== 0 || currentOffsetDown !== 0;

  const quotaType = ledger?.traffic_limit_type || "sum";
  const quotaUsed =
    quotaType === "up"
      ? effectiveUp
      : quotaType === "down"
        ? effectiveDown
        : quotaType === "max"
          ? Math.max(effectiveUp, effectiveDown)
          : quotaType === "min"
            ? Math.min(effectiveUp, effectiveDown)
            : effectiveTotal;
  const quotaLimit = Number(ledger?.traffic_limit) || 0;
  const quotaPercent = quotaLimit > 0 ? Math.min(100, Math.round((quotaUsed / quotaLimit) * 100)) : 0;

  const availableCalibrationModes: CalibrationMode[] =
    quotaType === "sum" ? ["targets", "total", "deltas"] : ["targets", "deltas"];

  // 预览计算与后端 Calibrate 语义保持完全一致（含负偏移截断场景）
  let previewOffsetUp = currentOffsetUp;
  let previewOffsetDown = currentOffsetDown;
  let previewValid = serverManaged;
  if (calibrationMode === "total") {
    const total = parseCalibrationValue(targetTotal, false);
    if (quotaType !== "sum" || total === null || total === undefined) {
      previewValid = false;
    } else {
      const splitUp =
        effectiveTotal > 0 ? Math.floor((total * effectiveUp) / effectiveTotal) : total;
      const splitDown = total - splitUp;
      previewOffsetUp = splitUp - accumulatedUp;
      previewOffsetDown = splitDown - accumulatedDown;
    }
  } else {
    const isDelta = calibrationMode === "deltas";
    const upVal = parseCalibrationValue(isDelta ? deltaUp : targetUp, isDelta);
    const downVal = parseCalibrationValue(isDelta ? deltaDown : targetDown, isDelta);
    if (upVal === undefined || downVal === undefined || (upVal === null && downVal === null)) {
      previewValid = false;
    } else if (isDelta) {
      if (upVal !== null) previewOffsetUp = currentOffsetUp + upVal;
      if (downVal !== null) previewOffsetDown = currentOffsetDown + downVal;
    } else {
      if (upVal !== null) previewOffsetUp = upVal - accumulatedUp;
      if (downVal !== null) previewOffsetDown = downVal - accumulatedDown;
    }
  }
  const previewUp = Math.max(0, accumulatedUp + previewOffsetUp);
  const previewDown = Math.max(0, accumulatedDown + previewOffsetDown);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <IconButton
          variant="ghost"
          title={t("admin.trafficLedger.title")}
          aria-label={t("admin.trafficLedger.title")}
        >
          <Activity size={18} />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content style={{ maxWidth: 680, maxHeight: "85vh", overflowY: "auto" }}>
        <Dialog.Title className="break-words">
          {t("admin.trafficLedger.title")} · {node.name}
        </Dialog.Title>

        {loading && !ledger ? (
          <Text as="p" color="gray" role="status">{t("admin.trafficLedger.loading")}</Text>
        ) : loadError && !ledger ? (
          <Flex direction="column" gap="3" mt="3">
            <Text color="red">{loadError}</Text>
            <Button variant="soft" onClick={() => void loadLedger()}>{t("common.retry")}</Button>
          </Flex>
        ) : ledger ? (
          <Flex direction="column" gap="5" mt="4">
            {serverManaged && agentMonthRotate && (
              <Callout.Root color="amber" variant="soft">
                <Callout.Icon><AlertTriangle size={16} /></Callout.Icon>
                <Callout.Text>{t("admin.trafficLedger.agentRotate")}</Callout.Text>
              </Callout.Root>
            )}

            {/* 1. 当期用量概览 */}
            <section className="flex flex-col gap-3">
              <Flex justify="between" align="center" gap="2" wrap="wrap">
                <Heading size="3" weight="bold">{t("admin.trafficLedger.overview")}</Heading>
                <Text size="1" color="gray">
                  {ledger.mode === "agent"
                    ? t("admin.trafficLedger.cycleAgent")
                    : ledger.cycle_end_at
                      ? `${formatTs(ledger.cycle_start_at)} – ${formatTs(ledger.cycle_end_at)} · ${cycleRemaining(ledger.cycle_end_at)}`
                      : `${formatTs(ledger.cycle_start_at)} · ${t("admin.trafficLedger.cycleNoEnd")}`}
                </Text>
              </Flex>

              {quotaLimit > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Flex justify="between" gap="3" align="center">
                    <Text size="2" color="gray">
                      {t("admin.trafficLedger.quotaUsage")} ({t(`admin.nodeEdit.trafficLimitType_${quotaType}`)})
                    </Text>
                    <Text size="2" weight="medium">
                      {formatBytes(quotaUsed)} / {formatBytes(quotaLimit)} ({quotaPercent}%)
                    </Text>
                  </Flex>
                  <div
                    className="h-2 overflow-hidden rounded"
                    style={{ background: "var(--gray-a3)" }}
                    role="progressbar"
                    aria-label={t("admin.trafficLedger.quotaUsage")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={quotaPercent}
                  >
                    <div
                      className="h-full rounded bg-[var(--accent-9)]"
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 rounded-md border border-gray-a5 p-3">
                <div className="min-w-0">
                  <Flex align="center" gap="1" className="mb-1">
                    <Text size="1" color="gray">{t("admin.trafficLedger.total")}</Text>
                    {serverManaged && hasOffset && (
                      <Badge size="1" variant="soft" color="blue">
                        {t("admin.trafficLedger.calibratedTag")}
                      </Badge>
                    )}
                  </Flex>
                  <Text as="div" size="3" weight="bold">{formatBytes(effectiveTotal)}</Text>
                </div>
                <div className="min-w-0">
                  <Text as="div" size="1" color="gray" className="mb-1">{t("admin.trafficLedger.upload")}</Text>
                  <Text as="div" size="3" weight="medium">{formatBytes(effectiveUp)}</Text>
                  {serverManaged && currentOffsetUp !== 0 && (
                    <Text as="div" size="1" color="gray">
                      {t("admin.trafficLedger.calibrationOffsetHint", { value: formatSignedBytes(currentOffsetUp) })}
                    </Text>
                  )}
                </div>
                <div className="min-w-0">
                  <Text as="div" size="1" color="gray" className="mb-1">{t("admin.trafficLedger.download")}</Text>
                  <Text as="div" size="3" weight="medium">{formatBytes(effectiveDown)}</Text>
                  {serverManaged && currentOffsetDown !== 0 && (
                    <Text as="div" size="1" color="gray">
                      {t("admin.trafficLedger.calibrationOffsetHint", { value: formatSignedBytes(currentOffsetDown) })}
                    </Text>
                  )}
                </div>
              </div>

              {serverManaged && !ledger.has_baseline && (
                <Text size="1" color="gray">{t("admin.trafficLedger.waitingFirstReport")}</Text>
              )}
            </section>

            {/* 2. 周期与限额配置 */}
            <section className="flex flex-col gap-3 border-t border-gray-a5 pt-4">
              <Heading size="3" weight="bold">{t("admin.trafficLedger.configHeading")}</Heading>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1 text-sm">
                  <span>{t("admin.trafficLedger.mode")}</span>
                  <Select.Root
                    value={config.mode}
                    onValueChange={(value) => {
                      const nextMode = value as TrafficCycleMode;
                      setConfig((cur) => ({
                        ...cur,
                        mode: nextMode,
                        anchorDate: nextMode === "fixed_days" && !cur.anchorDate ? todayDateString() : cur.anchorDate,
                      }));
                    }}
                  >
                    <Select.Trigger className="w-full" aria-label={t("admin.trafficLedger.mode")} />
                    <Select.Content>
                      {cycleModes.map((mode) => (
                        <Select.Item key={mode} value={mode}>{t(modeLabels[mode])}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </label>

                {config.mode === "monthly" && (
                  <label className="flex min-w-0 flex-col gap-1 text-sm">
                    <span>{t("admin.trafficLedger.resetDay")}</span>
                    <TextField.Root
                      type="number"
                      min="1"
                      max="31"
                      value={config.resetDay}
                      onChange={(e) => updateConfig("resetDay", e.currentTarget.value)}
                    />
                    <Text as="span" size="1" color="gray">{t("admin.trafficLedger.resetDayHint")}</Text>
                  </label>
                )}

                {config.mode === "fixed_days" && (
                  <>
                    <label className="flex min-w-0 flex-col gap-1 text-sm">
                      <span>{t("admin.trafficLedger.intervalDays")}</span>
                      <TextField.Root
                        type="number"
                        min="1"
                        max="36500"
                        value={config.intervalDays}
                        onChange={(e) => updateConfig("intervalDays", e.currentTarget.value)}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-sm">
                      <span>{t("admin.trafficLedger.anchorDate")}</span>
                      <TextField.Root
                        type="date"
                        value={config.anchorDate}
                        onChange={(e) => updateConfig("anchorDate", e.currentTarget.value)}
                      />
                    </label>
                  </>
                )}

                {config.mode !== "agent" && (
                  <label className="flex min-w-0 flex-col gap-1 text-sm">
                    <span>{t("admin.trafficLedger.timezone")}</span>
                    <TextField.Root
                      list="traffic-node-timezones"
                      placeholder={t("admin.trafficLedger.timezonePlaceholder")}
                      value={config.timezone}
                      onChange={(e) => updateConfig("timezone", e.currentTarget.value)}
                    />
                    <datalist id="traffic-node-timezones">
                      {TRAFFIC_TIMEZONE_SUGGESTIONS.map((zone) => <option key={zone} value={zone} />)}
                    </datalist>
                  </label>
                )}

                <label className="flex min-w-0 flex-col gap-1 text-sm">
                  <span>{t("admin.trafficLedger.quota")}</span>
                  <TextField.Root
                    value={config.trafficLimit}
                    onChange={(e) => updateConfig("trafficLimit", e.currentTarget.value)}
                  />
                </label>

                <label className="flex min-w-0 flex-col gap-1 text-sm">
                  <span>{t("admin.trafficLedger.quotaType")}</span>
                  <Select.Root
                    value={config.trafficLimitType}
                    onValueChange={(value) => {
                      updateConfig("trafficLimitType", value);
                      if (value !== "sum" && calibrationMode === "total") setCalibrationMode("targets");
                    }}
                  >
                    <Select.Trigger className="w-full" aria-label={t("admin.trafficLedger.quotaType")} />
                    <Select.Content>
                      {limitTypes.map((type) => (
                        <Select.Item key={type} value={type}>{t(`admin.nodeEdit.trafficLimitType_${type}`)}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </label>
              </div>

              <Flex justify="between" align="center" gap="2" wrap="wrap">
                {node.billing_cycle > 0 ? (
                  <Button type="button" variant="soft" color="gray" onClick={handleFillBilling} disabled={isBusy}>
                    {t("admin.trafficLedger.fillBilling")}
                  </Button>
                ) : <span />}
                <Button onClick={() => void handleConfigSave()} disabled={isBusy}>
                  {busy === "config" ? t("admin.trafficLedger.saving") : t("admin.trafficLedger.save")}
                </Button>
              </Flex>
            </section>

            {/* 3. 流量校准 */}
            <section className="flex flex-col gap-3 border-t border-gray-a5 pt-4">
              <Heading size="3" weight="bold">{t("admin.trafficLedger.calibrationHeading")}</Heading>
              {!serverManaged ? (
                <Text size="2" color="gray">{t("admin.trafficLedger.agentModeDisabled")}</Text>
              ) : (
                <>
                  <Flex gap="2" wrap="wrap" role="group" aria-label={t("admin.trafficLedger.calibrationHeading")}>
                    {availableCalibrationModes.map((mode) => (
                      <Button
                        key={mode}
                        size="1"
                        variant={calibrationMode === mode ? "solid" : "soft"}
                        onClick={() => setCalibrationMode(mode)}
                        disabled={isBusy}
                      >
                        {t(`admin.trafficLedger.calibration${mode === "targets" ? "Targets" : mode === "total" ? "Total" : "Deltas"}`)}
                      </Button>
                    ))}
                  </Flex>

                  {calibrationMode === "total" ? (
                    <label className="flex min-w-0 flex-col gap-1 text-sm">
                      <span>{t("admin.trafficLedger.targetTotal")}</span>
                      <TextField.Root value={targetTotal} onChange={(e) => setTargetTotal(e.currentTarget.value)} />
                    </label>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex min-w-0 flex-col gap-1 text-sm">
                        <span>{t(calibrationMode === "targets" ? "admin.trafficLedger.targetUp" : "admin.trafficLedger.deltaUp")}</span>
                        <TextField.Root
                          value={calibrationMode === "targets" ? targetUp : deltaUp}
                          placeholder={calibrationMode === "targets" ? "0 B" : "+/- 10 GB"}
                          onChange={(e) =>
                            calibrationMode === "targets"
                              ? setTargetUp(e.currentTarget.value)
                              : setDeltaUp(e.currentTarget.value)
                          }
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1 text-sm">
                        <span>{t(calibrationMode === "targets" ? "admin.trafficLedger.targetDown" : "admin.trafficLedger.deltaDown")}</span>
                        <TextField.Root
                          value={calibrationMode === "targets" ? targetDown : deltaDown}
                          placeholder={calibrationMode === "targets" ? "0 B" : "+/- 10 GB"}
                          onChange={(e) =>
                            calibrationMode === "targets"
                              ? setTargetDown(e.currentTarget.value)
                              : setDeltaDown(e.currentTarget.value)
                          }
                        />
                      </label>
                    </div>
                  )}

                  {previewValid && (
                    <Text size="1" color="gray" aria-live="polite">
                      {t("admin.trafficLedger.previewLine", {
                        up: formatBytes(previewUp),
                        offsetUp: formatSignedBytes(previewOffsetUp),
                        down: formatBytes(previewDown),
                        offsetDown: formatSignedBytes(previewOffsetDown),
                      })}
                    </Text>
                  )}

                  <Flex gap="2" align="center">
                    <Checkbox
                      id="traffic-suppress-alert"
                      checked={suppressAlert}
                      onCheckedChange={(checked) => setSuppressAlert(checked === true)}
                    />
                    <label htmlFor="traffic-suppress-alert" className="text-sm">
                      {t("admin.trafficLedger.suppressAlert")}
                    </label>
                  </Flex>

                  <label className="flex min-w-0 flex-col gap-1 text-sm">
                    <span>{t("admin.trafficLedger.note")}</span>
                    <TextField.Root
                      value={calibrationNote}
                      placeholder={t("admin.trafficLedger.notePlaceholder")}
                      onChange={(e) => setCalibrationNote(e.currentTarget.value)}
                    />
                  </label>

                  <Flex justify="between" gap="2" wrap="wrap">
                    <Button
                      variant="soft"
                      color="gray"
                      onClick={() => void handleClearOffsets()}
                      disabled={isBusy || !hasOffset}
                    >
                      {t("admin.trafficLedger.clearOffsets")}
                    </Button>
                    <Button onClick={() => void handleCalibration()} disabled={isBusy || !previewValid}>
                      {busy === "calibration" ? t("admin.trafficLedger.saving") : t("admin.trafficLedger.calibrate")}
                    </Button>
                  </Flex>
                </>
              )}
            </section>

            {/* 4. 重置当期流量 */}
            {serverManaged && (
              <section className="flex flex-col gap-3 border-t border-gray-a5 pt-4">
                {confirmReset ? (
                  <div className="flex flex-col gap-3 rounded-md border border-red-a6 p-3">
                    <Text size="2" color="red">{t("admin.trafficLedger.resetDescription")}</Text>
                    <Flex justify="end" gap="2">
                      <Button variant="soft" color="gray" onClick={() => setConfirmReset(false)} disabled={isBusy}>
                        {t("common.cancel")}
                      </Button>
                      <Button color="red" onClick={() => void handleReset()} disabled={isBusy}>
                        {busy === "reset" ? t("admin.trafficLedger.saving") : t("admin.trafficLedger.resetConfirm")}
                      </Button>
                    </Flex>
                  </div>
                ) : (
                  <Flex justify="end">
                    <Button color="red" variant="soft" onClick={() => setConfirmReset(true)} disabled={isBusy}>
                      {t("admin.trafficLedger.reset")}
                    </Button>
                  </Flex>
                )}
              </section>
            )}
          </Flex>
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}
