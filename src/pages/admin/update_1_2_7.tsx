import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Callout,
  Checkbox,
  Container,
  Dialog,
  Flex,
  Heading,
  Progress,
  SegmentedControl,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HardDrive,
  LoaderCircle,
  LogIn,
  Server,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import GuideHeader from "@/components/GuideHeader";
import { SettingCard, SettingCardLabel } from "@/components/admin/SettingCard";

const API_BASE = "/api/admin/update/1.2.7";
const I18N_PREFIX = "settings.update_1_2_7";

type Driver = "sqlite" | "mysql" | "postgresql";

type Summary = {
  load_rows: number;
  gpu_rows: number;
  latency_rows: number;
  monitoring_rows: number;
  estimated_points: number;
  server_count: number;
  retention_days: number;
  oldest_at?: string;
  newest_at?: string;
};

type UpgradeStatus = {
  state: "idle" | "cleaning" | "migrating" | "completed" | "failed";
  phase: string;
  table?: string;
  summary: Summary;
  source_rows_done: number;
  source_rows_total: number;
  written_points: number;
  progress: number;
  target_driver?: Driver;
  error?: string;
};

type LoginMethods = {
  oauth_enabled: boolean;
  oauth_provider: string;
  password_login_enabled: boolean;
};

type Me = {
  logged_in: boolean;
  username: string;
};

type AuthStatus = LoginMethods & Me;

type APIResponse<T> = {
  status: "success" | "error";
  message: string;
  data?: T;
};

const examples: Record<Driver, string> = {
  sqlite: "./data/metrics.db",
  mysql: "user:password@tcp(127.0.0.1:3306)/komari?parseTime=true",
  postgresql:
    "host=127.0.0.1 port=5432 user=komari password=secret dbname=komari sslmode=disable",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  const payload = (await response.json()) as APIResponse<T>;
  if (
    !response.ok ||
    payload.status !== "success" ||
    payload.data === undefined
  ) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  return payload.data;
}

async function getMe(): Promise<Me> {
  const response = await fetch("/api/me", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Me;
}

const Upgrade127 = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || "en-US";
  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  );
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [status, setStatus] = useState<UpgradeStatus | null>(null);
  const [pageError, setPageError] = useState("");
  const [driver, setDriver] = useState<Driver>("sqlite");
  const [dsn, setDSN] = useState(examples.sqlite);
  const [cutoff, setCutoff] = useState("");
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmSQLite, setConfirmSQLite] = useState(false);
  const [confirmLarge, setConfirmLarge] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const [methods, me] = await Promise.all([
        request<LoginMethods>("/auth"),
        getMe(),
      ]);
      const next = { ...methods, ...me };
      setAuth(next);
      return next;
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : t(`${I18N_PREFIX}.network_error`),
      );
      return null;
    }
  }, [t]);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await request<UpgradeStatus>("/status");
      setStatus(next);
      setPageError("");
      return next;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        setAuth((current) =>
          current ? { ...current, logged_in: false } : current,
        );
      } else {
        setPageError(
          error instanceof Error
            ? error.message
            : t(`${I18N_PREFIX}.network_error`),
        );
      }
      return null;
    }
  }, [t]);

  useEffect(() => {
    void refreshAuth().then((next) => {
      if (next?.logged_in) void refreshStatus();
    });
  }, [refreshAuth, refreshStatus]);

  useEffect(() => {
    if (
      !auth?.logged_in ||
      !status ||
      (status.state !== "migrating" && status.state !== "cleaning")
    ) {
      return;
    }
    const timer = window.setInterval(() => void refreshStatus(), 700);
    return () => window.clearInterval(timer);
  }, [auth?.logged_in, refreshStatus, status]);

  useEffect(() => {
    if (status?.state !== "completed") return;
    const timer = window.setTimeout(() => window.location.replace("/"), 3200);
    return () => window.clearTimeout(timer);
  }, [status?.state]);

  const summary = status?.summary;
  const sqliteRisk =
    driver === "sqlite" &&
    !!summary &&
    summary.server_count > 5 &&
    summary.retention_days > 7;
  const largeRisk =
    !!summary && summary.load_rows + summary.latency_rows > 300_000;
  const operating =
    status?.state === "migrating" || status?.state === "cleaning" || busy;

  const phaseText = useMemo(() => {
    if (!status) return "";
    switch (status.phase) {
      case "connecting":
      case "saving_target":
        return t(`${I18N_PREFIX}.phase_connecting`);
      case "migrating":
        return t(`${I18N_PREFIX}.phase_migrating`, {
          table: status.table || t(`${I18N_PREFIX}.monitoring_data`),
        });
      case "finalizing":
        return t(`${I18N_PREFIX}.phase_finalizing`);
      case "vacuuming":
        return t(`${I18N_PREFIX}.phase_vacuuming`);
      case "cleaning":
        return t(`${I18N_PREFIX}.phase_cleaning`);
      default:
        return t(`${I18N_PREFIX}.progress_title`);
    }
  }, [status, t]);

  const handleDriver = (value: string) => {
    const next = value as Driver;
    setDriver(next);
    setDSN(examples[next]);
    setConfirmSQLite(false);
  };

  const cleanup = async () => {
    if (!cutoff) {
      setPageError(t(`${I18N_PREFIX}.missing_cutoff`));
      setCleanupOpen(false);
      return;
    }
    setBusy(true);
    setPageError("");
    try {
      await request<{ summary: Summary }>("/cleanup", {
        method: "POST",
        body: JSON.stringify({ before: new Date(cutoff).toISOString() }),
      });
      setCleanupOpen(false);
      await refreshStatus();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : t(`${I18N_PREFIX}.request_failed`),
      );
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setPageError("");
    try {
      await request<Record<string, never>>("/start", {
        method: "POST",
        body: JSON.stringify({
          driver,
          dsn,
          confirm_sqlite_risk: confirmSQLite,
          confirm_large_dataset: confirmLarge,
        }),
      });
      setStartOpen(false);
      await refreshStatus();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : t(`${I18N_PREFIX}.request_failed`),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--gray-12)]">
      <header
        className="border-b bg-[var(--color-panel-solid)]"
        style={{ borderColor: "var(--gray-a5)" }}
      >
        <Container size="3" px={{ initial: "4", sm: "6" }} py="3">
          <GuideHeader />
        </Container>
      </header>

      <Container
        size="3"
        px={{ initial: "4", sm: "6" }}
        py={{ initial: "6", sm: "8" }}
      >
        <Flex direction="column" gap="5">
          <div>
            <Heading size="7" weight="bold">
              {t(`${I18N_PREFIX}.title`)}
            </Heading>
            <Text as="p" size="2" color="gray" mt="2">
              {t(`${I18N_PREFIX}.subtitle`)}
            </Text>
          </div>

          {pageError && (
            <Callout.Root color="red" variant="surface">
              <Callout.Icon>
                <AlertTriangle size={18} />
              </Callout.Icon>
              <Callout.Text>{pageError}</Callout.Text>
            </Callout.Root>
          )}

          {status?.state === "completed" ? (
            <Callout.Root color="green" variant="surface" size="3">
              <Callout.Icon>
                <CheckCircle2 size={22} />
              </Callout.Icon>
              <Callout.Text>
                <Text as="div" weight="bold">
                  {t(`${I18N_PREFIX}.completed_title`)}
                </Text>
                <Text as="div" mt="1">
                  {t(`${I18N_PREFIX}.completed_description`)}
                </Text>
              </Callout.Text>
            </Callout.Root>
          ) : (
            <Flex direction="column" gap="5">
              <Flex direction="column" gap="3">
                <SettingCardLabel>
                  {t(`${I18N_PREFIX}.overview`)}
                </SettingCardLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SettingCard title={t(`${I18N_PREFIX}.load_rows`)}>
                    <Flex direction="column" gap="1" className="mt-2 w-full">
                      <Text size="7" weight="bold" className="tabular-nums">
                        {formatNumber(summary?.load_rows ?? 0)}{" "}
                        <Text size="2" color="gray">
                          {t(`${I18N_PREFIX}.rows`)}
                        </Text>
                      </Text>
                      <Text size="1" color="gray">
                        {t(`${I18N_PREFIX}.gpu_rows`, {
                          count: summary?.gpu_rows ?? 0,
                        })}
                      </Text>
                    </Flex>
                  </SettingCard>
                  <SettingCard title={t(`${I18N_PREFIX}.latency_rows`)}>
                    <Flex direction="column" gap="1" className="mt-2 w-full">
                      <Text size="7" weight="bold" className="tabular-nums">
                        {formatNumber(summary?.latency_rows ?? 0)}{" "}
                        <Text size="2" color="gray">
                          {t(`${I18N_PREFIX}.rows`)}
                        </Text>
                      </Text>
                    </Flex>
                  </SettingCard>
                </div>
                <Text size="2" color="gray">
                  {t(`${I18N_PREFIX}.overview_detail`, {
                    points: formatNumber(summary?.estimated_points ?? 0),
                    days: summary?.retention_days ?? 0,
                    servers: summary?.server_count ?? 0,
                  })}
                </Text>
              </Flex>

              <Flex direction="column" gap="3">
                <SettingCardLabel>
                  {t(`${I18N_PREFIX}.target`)}
                </SettingCardLabel>
                <SettingCard
                  title={t(`${I18N_PREFIX}.target`)}
                  description={t(`${I18N_PREFIX}.target_description`)}
                >
                  <Flex direction="column" gap="3" className="mt-3 w-full">
                    <SegmentedControl.Root
                      value={driver}
                      onValueChange={handleDriver}
                      className="w-full"
                    >
                      <SegmentedControl.Item value="sqlite">
                        <div className="flex flex-row items-center justify-center gap-1.5">
                          <HardDrive size={15} />
                          <span className="hidden sm:inline">
                            {t(`${I18N_PREFIX}.sqlite_local`)}
                          </span>
                        </div>
                        <span className="sm:hidden">SQLite</span>
                      </SegmentedControl.Item>
                      <SegmentedControl.Item value="mysql">
                        <div className="flex flex-row items-center justify-center gap-1.5">
                          <Server size={15} />
                          <span className="hidden sm:inline">
                            {t(`${I18N_PREFIX}.mysql_remote`)}
                          </span>
                          <span className="sm:hidden">MySQL</span>
                        </div>
                      </SegmentedControl.Item>
                      <SegmentedControl.Item value="postgresql">
                        <div className="flex flex-row items-center justify-center gap-1.5">
                          <Server size={15} />
                          <span className="hidden sm:inline">
                            {t(`${I18N_PREFIX}.postgresql_remote`)}
                          </span>
                          <span className="sm:hidden">PG</span>
                        </div>
                      </SegmentedControl.Item>
                    </SegmentedControl.Root>

                    <label>
                      <Text as="div" size="2" weight="bold" mb="2">
                        {t(`${I18N_PREFIX}.dsn`)}
                      </Text>
                      <TextField.Root
                        size="3"
                        value={dsn}
                        onChange={(event) => setDSN(event.target.value)}
                        disabled={operating}
                        spellCheck={false}
                      />
                      <Text
                        as="div"
                        size="1"
                        color="gray"
                        mt="2"
                        className="break-all"
                      >
                        {t(`${I18N_PREFIX}.example`, {
                          example: examples[driver],
                        })}
                      </Text>
                    </label>

                    {driver === "sqlite" && (
                      <Callout.Root color="amber" variant="surface">
                        <Callout.Icon>
                          <AlertTriangle size={18} />
                        </Callout.Icon>
                        <Callout.Text>
                          {t(`${I18N_PREFIX}.sqlite_warning`)}
                        </Callout.Text>
                      </Callout.Root>
                    )}
                  </Flex>
                </SettingCard>
              </Flex>

              <Flex direction="column" gap="3">
                <SettingCardLabel>
                  {t(`${I18N_PREFIX}.cleanup`)}
                </SettingCardLabel>
                <SettingCard
                  title={t(`${I18N_PREFIX}.cleanup`)}
                  description={t(`${I18N_PREFIX}.cleanup_description`)}
                >
                  <div className="mt-3 grid w-full items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label>
                      <Text as="div" size="2" weight="bold" mb="2">
                        {t(`${I18N_PREFIX}.before`)}
                      </Text>
                      <TextField.Root
                        type="datetime-local"
                        size="3"
                        value={cutoff}
                        onChange={(event) => setCutoff(event.target.value)}
                        disabled={operating}
                        max={new Date(
                          Date.now() - new Date().getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)}
                      />
                    </label>
                    <Button
                      color="red"
                      variant="soft"
                      size="3"
                      disabled={!cutoff || operating}
                      onClick={() => setCleanupOpen(true)}
                    >
                      <Trash2 size={17} />
                      {t(`${I18N_PREFIX}.cleanup_action`)}
                    </Button>
                  </div>
                </SettingCard>
              </Flex>

              {(status?.state === "migrating" ||
                status?.state === "cleaning") && (
                <SettingCard
                  title={t(`${I18N_PREFIX}.progress_title`)}
                  description={phaseText}
                >
                  <Flex direction="column" gap="3" className="mt-3 w-full">
                    <Flex justify="between" gap="3">
                      <Text size="2" color="gray">
                        {t(`${I18N_PREFIX}.progress_detail`, {
                          done: formatNumber(status.source_rows_done),
                          total: formatNumber(status.source_rows_total),
                          points: formatNumber(status.written_points),
                        })}
                      </Text>
                      <Text weight="bold" className="tabular-nums">
                        {Math.round(status.progress)}%
                      </Text>
                    </Flex>
                    <Progress value={status.progress} size="3" />
                  </Flex>
                </SettingCard>
              )}

              {status?.state === "failed" && (
                <Callout.Root color="red" variant="surface">
                  <Callout.Icon>
                    <AlertTriangle size={18} />
                  </Callout.Icon>
                  <Callout.Text>
                    <Text as="div" weight="bold">
                      {t(`${I18N_PREFIX}.failed_title`)}
                    </Text>
                    <Text as="div" mt="1">
                      {status.error}
                    </Text>
                    <Text as="div" mt="1">
                      {t(`${I18N_PREFIX}.retry_hint`)}
                    </Text>
                  </Callout.Text>
                </Callout.Root>
              )}

              <Flex justify="end">
                <Button
                  size="3"
                  disabled={operating || !status}
                  onClick={() => setStartOpen(true)}
                >
                  {t(`${I18N_PREFIX}.start`)}
                  <ArrowRight size={18} />
                </Button>
              </Flex>
            </Flex>
          )}
        </Flex>
      </Container>

      <LoginDialog
        auth={auth}
        onAuthenticated={async () => {
          const next = await refreshAuth();
          if (next?.logged_in) await refreshStatus();
        }}
      />

      <Dialog.Root open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>{t(`${I18N_PREFIX}.cleanup_title`)}</Dialog.Title>
          <Dialog.Description>
            {t(`${I18N_PREFIX}.cleanup_confirm`, {
              date: cutoff ? new Date(cutoff).toLocaleString(locale) : "-",
            })}
          </Dialog.Description>
          <Flex justify="end" gap="3" mt="5" wrap="wrap">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t("cancel")}
              </Button>
            </Dialog.Close>
            <Button color="red" disabled={busy} onClick={() => void cleanup()}>
              {busy && <LoaderCircle size={16} className="animate-spin" />}
              {t(`${I18N_PREFIX}.confirm_cleanup`)}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={startOpen} onOpenChange={setStartOpen}>
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>{t(`${I18N_PREFIX}.start_title`)}</Dialog.Title>
          <Dialog.Description>
            {t(`${I18N_PREFIX}.start_description`)}
          </Dialog.Description>
          <Flex direction="column" gap="3" mt="4">
            {sqliteRisk && (
              <label
                className="flex items-start gap-3 border p-3"
                style={{
                  borderColor: "var(--amber-a6)",
                  background: "var(--amber-a2)",
                  borderRadius: "var(--radius-2)",
                }}
              >
                <Checkbox
                  checked={confirmSQLite}
                  onCheckedChange={(checked) =>
                    setConfirmSQLite(checked === true)
                  }
                  mt="1"
                />
                <span>
                  <Text as="div" size="2">
                    {t(`${I18N_PREFIX}.sqlite_risk`, {
                      servers: summary?.server_count ?? 0,
                      days: summary?.retention_days ?? 0,
                    })}
                  </Text>
                  <Text as="div" size="2" weight="bold" mt="1">
                    {t(`${I18N_PREFIX}.sqlite_confirm`)}
                  </Text>
                </span>
              </label>
            )}
            {largeRisk && (
              <label
                className="flex items-start gap-3 border p-3"
                style={{
                  borderColor: "var(--red-a6)",
                  background: "var(--red-a2)",
                  borderRadius: "var(--radius-2)",
                }}
              >
                <Checkbox
                  checked={confirmLarge}
                  onCheckedChange={(checked) =>
                    setConfirmLarge(checked === true)
                  }
                  mt="1"
                />
                <span>
                  <Text as="div" size="2">
                    {t(`${I18N_PREFIX}.large_risk`)}
                  </Text>
                  <Text as="div" size="2" weight="bold" mt="1">
                    {t(`${I18N_PREFIX}.large_confirm`)}
                  </Text>
                </span>
              </label>
            )}
          </Flex>
          <Flex justify="end" gap="3" mt="5" wrap="wrap">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t("cancel")}
              </Button>
            </Dialog.Close>
            <Button
              disabled={
                busy ||
                (sqliteRisk && !confirmSQLite) ||
                (largeRisk && !confirmLarge)
              }
              onClick={() => void start()}
            >
              {busy && <LoaderCircle size={16} className="animate-spin" />}
              {t(`${I18N_PREFIX}.confirm_start`)}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </main>
  );
};

const LoginDialog = ({
  auth,
  onAuthenticated,
}: {
  auth: AuthStatus | null;
  onAuthenticated: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState("");
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          ...(twoFactor ? { "2fa_code": twoFactor } : {}),
        }),
      });
      const payload = (await response.json()) as APIResponse<unknown>;
      if (!response.ok) {
        if (payload.message === "2FA code is required") {
          setRequireTwoFactor(true);
        }
        throw new Error(payload.message || `HTTP ${response.status}`);
      }
      await onAuthenticated();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : t(`${I18N_PREFIX}.request_failed`),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={auth !== null && !auth.logged_in}>
      <Dialog.Content
        maxWidth="430px"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <Dialog.Title>{t("login.title")}</Dialog.Title>
        <Dialog.Description>{t("login.desc")}</Dialog.Description>
        {auth?.password_login_enabled && (
          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void login();
            }}
          >
            <label className="block">
              <Text as="div" size="2" weight="bold" mb="1">
                {t("login.username")}
              </Text>
              <TextField.Root
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
                disabled={busy}
              />
            </label>
            <label className="block">
              <Text as="div" size="2" weight="bold" mb="1">
                {t("login.password")}
              </Text>
              <TextField.Root
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={busy}
              />
            </label>
            {requireTwoFactor && (
              <label className="block">
                <Text as="div" size="2" weight="bold" mb="1">
                  {t("login.two_factor")}
                </Text>
                <TextField.Root
                  value={twoFactor}
                  onChange={(event) => setTwoFactor(event.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  disabled={busy}
                />
              </label>
            )}
            {error && (
              <Text as="div" size="2" color="red">
                {error}
              </Text>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !username.trim() || !password}
            >
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {busy ? t("loading") : t("login.title")}
            </Button>
          </form>
        )}
        {auth?.oauth_enabled && (
          <Button
            variant={auth.password_login_enabled ? "soft" : "solid"}
            className="mt-3 w-full"
            onClick={() => {
              window.location.href = "/api/oauth";
            }}
          >
            {t("login.login_with", {
              provider: auth.oauth_provider || "OAuth",
            })}
          </Button>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default Upgrade127;
