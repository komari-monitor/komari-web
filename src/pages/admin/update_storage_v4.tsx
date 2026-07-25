import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Callout,
  Container,
  Flex,
  Heading,
  Progress,
  Text,
} from "@radix-ui/themes";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import GuideHeader from "@/components/GuideHeader";
import { SettingCard } from "@/components/admin/SettingCard";
import RestrictedLoginDialog, {
  type RestrictedAuthStatus,
} from "@/components/RestrictedLoginDialog";

const API_BASE = "/api/admin/update/storage-v4";
const I18N_PREFIX = "settings.update_storage_v4";

type MigrationSummary = {
  required: boolean;
  layout: string;
  source_rows: number;
  legacy_blocks: number;
};

type MigrationStatus = {
  state: "pending" | "migrating" | "completed" | "failed";
  phase: string;
  current: number;
  total: number;
  preserved: number;
  progress: number;
  elapsed_ms: number;
  summary: MigrationSummary;
  error?: string;
};

type Me = { logged_in: boolean; username: string };
type AuthStatus = RestrictedAuthStatus & Me;
type LoginMethods = Pick<
  RestrictedAuthStatus,
  "oauth_enabled" | "oauth_provider" | "password_login_enabled"
>;
type APIResponse<T> = { status: "success" | "error"; message: string; data?: T };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
    cache: "no-store",
  });
  const payload = (await response.json()) as APIResponse<T>;
  if (!response.ok || payload.status !== "success" || payload.data === undefined) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  return payload.data;
}

async function getMe(): Promise<Me> {
  const response = await fetch("/api/me", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Me;
}

export default function StorageV4Upgrade() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || "en-US";
  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  );
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [pageError, setPageError] = useState("");
  const [retrying, setRetrying] = useState(false);

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
      setPageError(error instanceof Error ? error.message : t(`${I18N_PREFIX}.network_error`));
      return null;
    }
  }, [t]);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await request<MigrationStatus>("/status");
      setStatus(next);
      setPageError("");
      return next;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        setAuth((current) => current && { ...current, logged_in: false });
      } else {
        setPageError(error instanceof Error ? error.message : t(`${I18N_PREFIX}.network_error`));
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
    if (!auth?.logged_in || status?.state === "completed" || status?.state === "failed") return;
    const timer = window.setInterval(() => void refreshStatus(), 500);
    return () => window.clearInterval(timer);
  }, [auth?.logged_in, refreshStatus, status?.state]);

  useEffect(() => {
    if (status?.state !== "completed") return;
    const timer = window.setTimeout(() => window.location.replace("/"), 2400);
    return () => window.clearTimeout(timer);
  }, [status?.state]);

  const phaseText = useMemo(() => {
    const key = status?.phase || "preparing";
    return t(`${I18N_PREFIX}.phase_${key}`, {
      defaultValue: t(`${I18N_PREFIX}.phase_preparing`),
    });
  }, [status?.phase, t]);

  const retry = async () => {
    setRetrying(true);
    setPageError("");
    try {
      await request<Record<string, never>>("/retry", { method: "POST" });
      await refreshStatus();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : t(`${I18N_PREFIX}.retry_failed`));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--gray-12)]">
      <header className="border-b bg-[var(--color-panel-solid)]" style={{ borderColor: "var(--gray-a5)" }}>
        <Container size="3" px={{ initial: "4", sm: "6" }} py="3">
          <GuideHeader />
        </Container>
      </header>

      <Container size="3" px={{ initial: "4", sm: "6" }} py={{ initial: "6", sm: "8" }}>
        <Flex direction="column" gap="5">
          <div>
            <Flex align="center" gap="3">
              <Database size={28} />
              <Heading size="7" weight="bold">{t(`${I18N_PREFIX}.title`)}</Heading>
            </Flex>
            <Text as="p" size="2" color="gray" mt="2">{t(`${I18N_PREFIX}.subtitle`)}</Text>
          </div>

          {pageError && (
            <Callout.Root color="red" variant="surface">
              <Callout.Icon><AlertTriangle size={18} /></Callout.Icon>
              <Callout.Text>{pageError}</Callout.Text>
            </Callout.Root>
          )}

          {status?.state === "completed" ? (
            <Callout.Root color="green" variant="surface" size="3">
              <Callout.Icon><CheckCircle2 size={22} /></Callout.Icon>
              <Callout.Text>
                <Text as="div" weight="bold">{t(`${I18N_PREFIX}.completed_title`)}</Text>
                <Text as="div" mt="1">{t(`${I18N_PREFIX}.completed_description`)}</Text>
              </Callout.Text>
            </Callout.Root>
          ) : (
            <SettingCard title={t(`${I18N_PREFIX}.progress_title`)} description={phaseText}>
              <Flex direction="column" gap="4" className="mt-3 w-full">
                <Flex justify="between" align="center" gap="3">
                  <Text size="2" color="gray">
                    {t(`${I18N_PREFIX}.progress_detail`, {
                      done: formatNumber(status?.current ?? 0),
                      total: formatNumber(status?.total ?? status?.summary.source_rows ?? 0),
                    })}
                  </Text>
                  <Text weight="bold" className="tabular-nums">
                    {Math.round(status?.progress ?? 0)}%
                  </Text>
                </Flex>
                <Progress value={status?.progress ?? 0} size="3" />
                <div className="grid gap-3 border-t pt-4 sm:grid-cols-3" style={{ borderColor: "var(--gray-a5)" }}>
                  <Metric label={t(`${I18N_PREFIX}.preserved`)} value={formatNumber(status?.preserved ?? 0)} />
                  <Metric label={t(`${I18N_PREFIX}.source_rows`)} value={formatNumber(status?.summary.source_rows ?? 0)} />
                  <Metric label={t(`${I18N_PREFIX}.elapsed`)} value={formatElapsed(status?.elapsed_ms ?? 0)} />
                </div>
              </Flex>
            </SettingCard>
          )}

          {status?.state === "failed" && (
            <Callout.Root color="red" variant="surface">
              <Callout.Icon><AlertTriangle size={18} /></Callout.Icon>
              <Callout.Text>
                <Text as="div" weight="bold">{t(`${I18N_PREFIX}.failed_title`)}</Text>
                <Text as="div" mt="1" className="break-all">{status.error}</Text>
                <Text as="div" mt="1">{t(`${I18N_PREFIX}.failed_hint`)}</Text>
                <Button mt="3" color="red" variant="soft" disabled={retrying} onClick={() => void retry()}>
                  {retrying ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {t(`${I18N_PREFIX}.retry`)}
                </Button>
              </Callout.Text>
            </Callout.Root>
          )}

          {!status && !pageError && (
            <Flex align="center" gap="2" py="6" justify="center">
              <LoaderCircle size={18} className="animate-spin" />
              <Text color="gray">{t(`${I18N_PREFIX}.loading`)}</Text>
            </Flex>
          )}
        </Flex>
      </Container>

      <RestrictedLoginDialog
        auth={auth}
        requestFailedKey={`${I18N_PREFIX}.login_failed`}
        onAuthenticated={async () => {
          const next = await refreshAuth();
          if (next?.logged_in) await refreshStatus();
        }}
      />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text as="div" size="1" color="gray">{label}</Text>
      <Text as="div" size="4" weight="bold" mt="1" className="tabular-nums">{value}</Text>
    </div>
  );
}

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
}
