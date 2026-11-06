import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Callout, Container, Flex, Heading, Text } from "@radix-ui/themes";
import {
  AlertTriangle,
  ArrowRight,
  Database,
  Play,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "motion/react";
import { PageMotion } from "@/components/motion";
import { GapCollapse } from "@/components/GapCollapse";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/http";

import RestrictedLoginDialog from "@/components/RestrictedLoginDialog";
import { loadAuth } from "./database/api";
import { STACK_GAP } from "./database/layout";
import GuidePageHeader from "./database/GuidePageHeader";
import PageErrorCallout from "./database/PageErrorCallout";
import { normalRouterAvailable, request } from "./database/migration/api";
import {
  COMMON_I18N,
  LEGACY_I18N,
  NORMAL_ROUTER_PROBE_MS,
  PLACEHOLDER_SUMMARY,
  RECLAIM_PROGRESS_CAP,
  RECLAIM_START_PROGRESS,
  RECLAIM_STEP_MS,
  STRUCTURE_I18N,
  examples,
} from "./database/migration/constants";
import type {
  AuthStatus,
  Driver,
  MigrationLoginMethods,
  MigrationStatus,
} from "./database/migration/types";
import LegacySetup from "./database/migration/LegacySetup";
import MigrationProgress from "./database/migration/MigrationProgress";
import Completion from "./database/migration/Completion";
import StartDialog from "./database/migration/StartDialog";
import DiscardDialog from "./database/migration/DiscardDialog";

export default function DatabaseMigration() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || "en-US";
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [pageError, setPageError] = useState("");
  const [driver, setDriver] = useState<Driver>("sqlite");
  const [dsn, setDSN] = useState(examples.sqlite);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmSQLite, setConfirmSQLite] = useState(false);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [probeActive, setProbeActive] = useState(false);
  const [reclaimStartedAt, setReclaimStartedAt] = useState<number | null>(null);
  const [reclaimNow, setReclaimNow] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const nextAuth = await loadAuth<MigrationLoginMethods>(request);
      setAuth(nextAuth);
      if (!nextAuth.logged_in) {
        setStatus(null);
        return;
      }
      const next = await request<MigrationStatus>("/status");
      setStatus(next);
      setPageError("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuth((current) =>
          current ? { ...current, logged_in: false } : current,
        );
      }
      setPageError(
        error instanceof Error
          ? error.message
          : t(`${COMMON_I18N}.network_error`),
      );
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (
      status?.state !== "migrating" &&
      status?.state !== "copying" &&
      status?.state !== "discarding" &&
      status?.state !== "reclaiming"
    ) {
      return;
    }
    const timer = window.setInterval(() => void refresh(), 700);
    return () => window.clearInterval(timer);
  }, [refresh, status?.state]);

  const mode = status?.mode || auth?.mode;
  const legacy = mode === "legacy_monitoring";
  const prefix = legacy ? LEGACY_I18N : STRUCTURE_I18N;
  const summary = status?.summary;
  const sqliteRisk =
    legacy &&
    driver === "sqlite" &&
    !!summary &&
    summary.server_count > 5 &&
    summary.retention_days > 7;
  const largeRisk =
    legacy && !!summary && summary.load_rows + summary.latency_rows > 300_000;
  const active =
    status?.state === "migrating" ||
    status?.state === "copying" ||
    status?.state === "discarding" ||
    status?.state === "reclaiming";
  const canStart =
    auth?.logged_in &&
    !!status &&
    (status.state === "idle" ||
      status.state === "ready" ||
      status.state === "failed") &&
    !busy;
  const canDiscard =
    auth?.logged_in &&
    !legacy &&
    !!status &&
    (status.state === "ready" || status.state === "failed") &&
    !busy;

  const simulatedProgress =
    probeActive && reclaimStartedAt !== null
      ? Math.min(
          RECLAIM_PROGRESS_CAP,
          RECLAIM_START_PROGRESS +
            Math.floor(
              Math.max(0, reclaimNow - reclaimStartedAt) / RECLAIM_STEP_MS,
            ),
        )
      : !legacy && status?.state === "completed"
        ? RECLAIM_PROGRESS_CAP
        : null;
  const displayedProgress = simulatedProgress ?? status?.progress ?? 0;
  const upgradeWaiting =
    !legacy &&
    (probeActive ||
      status?.state === "reclaiming" ||
      status?.state === "completed");

  useEffect(() => {
    if (legacy) return;
    if (status?.state === "failed") {
      setProbeActive(false);
      setReclaimStartedAt(null);
      return;
    }
    const startsProbe =
      status?.state === "reclaiming" || status?.state === "completed";
    if (!startsProbe || probeActive) return;
    setProbeActive(true);
    setReclaimStartedAt(
      status?.state === "completed"
        ? Date.now() -
            (RECLAIM_PROGRESS_CAP - RECLAIM_START_PROGRESS) * RECLAIM_STEP_MS
        : Date.now(),
    );
    setReclaimNow(Date.now());
  }, [legacy, status?.state, probeActive]);

  useEffect(() => {
    if (!probeActive) return;
    const timer = window.setInterval(() => setReclaimNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [probeActive]);

  useEffect(() => {
    if (!probeActive) return;
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      if (await normalRouterAvailable()) {
        stopped = true;
        window.location.replace("/");
      }
    };
    void check();
    const timer = window.setInterval(
      () => void check(),
      NORMAL_ROUTER_PROBE_MS,
    );
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [probeActive]);

  useEffect(() => {
    if (!legacy || status?.state !== "completed") return;
    const timer = window.setTimeout(() => window.location.replace("/"), 4500);
    return () => window.clearTimeout(timer);
  }, [legacy, status?.state]);

  const phaseText = useMemo(() => {
    if (!status) return "";
    if (!legacy) {
      if (status.state === "discarding")
        return t(`${STRUCTURE_I18N}.phase_discarding`);
      if (status.state === "reclaiming" || status.state === "completed")
        return t(`${STRUCTURE_I18N}.phase_reclaiming`);
      return t(`${STRUCTURE_I18N}.phase_copying`);
    }
    switch (status.phase) {
      case "connecting":
      case "saving_target":
      case "measuring":
        return t(`${LEGACY_I18N}.phase_connecting`);
      case "migrating":
        return t(`${LEGACY_I18N}.phase_migrating`, {
          table: status.table || t(`${LEGACY_I18N}.monitoring_data`),
        });
      case "finalizing":
        return t(`${LEGACY_I18N}.phase_finalizing`);
      case "vacuuming":
        return t(`${LEGACY_I18N}.phase_vacuuming`);
      default:
        return t(`${LEGACY_I18N}.progress_title`);
    }
  }, [legacy, status, t]);

  const handleDriver = (value: string) => {
    const next = value as Driver;
    setDriver(next);
    setDSN(examples[next]);
    setConfirmSQLite(false);
  };

  const start = async () => {
    setBusy(true);
    setPageError("");
    try {
      await request<Record<string, never>>("/start", {
        method: "POST",
        json: legacy
          ? {
              driver,
              dsn,
              confirm_sqlite_risk: confirmSQLite,
              confirm_large_dataset: confirmLarge,
            }
          : undefined,
      });
      setConfirmOpen(false);
      await refresh();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : t(`${COMMON_I18N}.request_failed`),
      );
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    setPageError("");
    try {
      await request<Record<string, never>>("/discard", { method: "POST" });
      setDiscardOpen(false);
      setConfirmDiscard(false);
      await refresh();
    } catch (error) {
      setDiscardOpen(false);
      setConfirmDiscard(false);
      setPageError(
        error instanceof Error
          ? error.message
          : t(`${COMMON_I18N}.request_failed`),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageMotion className="km-page-database-migration min-h-screen bg-[var(--color-background)] text-[var(--gray-12)]">
      <GuidePageHeader className="km-database-migration-header" />

      <Container
        size="3"
        px={{ initial: "4", sm: "6" }}
        py={{ initial: "6", sm: "8" }}
      >
        <Flex direction="column" gap="5">
          {/* 模式未知（auth/status 未到）时标题是哪一种还不确定：画成标题宽度的骨架条 */}
          <Skeletonize loading={!mode && !pageError}>
            <Heading size="7" weight="bold">
              {mode ? t(`${prefix}.title`) : skeletonText(14)}
            </Heading>
            {legacy && (
              <Text as="p" size="2" color="gray" mt="2">
                {t(`${prefix}.subtitle`)}
              </Text>
            )}
          </Skeletonize>

          {/*
            以下条件区块都在 section 档（gap="5"）的纵向栈里：用 GapCollapse 把高度和间距一起展开/收起，
            后面的区块顺势移动，不会被突然顶开或塌下去。
          */}
          <AnimatePresence initial={false}>
          {legacy && (
            <GapCollapse key="migration-legacy-note" gap={STACK_GAP}>
            <Callout.Root color="blue" variant="surface">
              <Callout.Icon>
                <Database size={19} />
              </Callout.Icon>
              <Callout.Text>
                {t(`${COMMON_I18N}.legacy_full_history`)}
              </Callout.Text>
            </Callout.Root>
            </GapCollapse>
          )}
          </AnimatePresence>

          <PageErrorCallout error={pageError} motionKey="migration-page-error" />

          <AnimatePresence initial={false}>
          {auth?.logged_in && status?.state === "failed" && status.error && (
            <GapCollapse key="migration-failed" gap={STACK_GAP}>
            <Callout.Root color="red" variant="surface">
              <Callout.Icon>
                <AlertTriangle size={18} />
              </Callout.Icon>
              <Callout.Text>
                <Text as="div" weight="bold">
                  {t(`${COMMON_I18N}.failed_title`)}
                </Text>
                <Text as="div" mt="1">
                  {status.error}
                </Text>
              </Callout.Text>
            </Callout.Root>
            </GapCollapse>
          )}
          </AnimatePresence>

          {/*
            迁移概览：状态未到时用占位数据渲染同一个 LegacySetup，Skeletonize 画成骨架；
            到达后在同一批 DOM 上淡入真实数字（不重挂载）。占位数据不会被提交（骨架期间 inert）。
          */}
          <AnimatePresence initial={false}>
          {auth?.logged_in &&
            legacy &&
            status?.state !== "completed" &&
            (summary || !status) && (
              <GapCollapse key="migration-legacy-setup" gap={STACK_GAP}>
              <Skeletonize loading={!status && !pageError} label>
              <LegacySetup
                summary={summary ?? PLACEHOLDER_SUMMARY}
                placeholder={!summary}
                locale={locale}
                driver={driver}
                dsn={dsn}
                active={active}
                onDriverChange={handleDriver}
                onDSNChange={setDSN}
              />
              </Skeletonize>
              </GapCollapse>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
          {auth?.logged_in && (active || upgradeWaiting) && status && (
            // feedback 层：只有迁移真的在跑时才展开
            <GapCollapse key="migration-progress" gap={STACK_GAP}>
            <MigrationProgress
              status={status}
              legacy={legacy}
              locale={locale}
              phaseText={phaseText}
              displayedProgress={displayedProgress}
            />
            </GapCollapse>
          )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
          {auth?.logged_in && status?.state === "completed" && legacy && (
            <GapCollapse key="migration-completed" gap={STACK_GAP}>
              <Completion status={status} locale={locale} legacy={legacy} />
            </GapCollapse>
          )}
          </AnimatePresence>

          {/* 操作按钮：状态未到时按钮本身就是骨架（文字画成条、不可点），到达后原地淡入 */}
          <AnimatePresence initial={false}>
          {auth?.logged_in && !active && status?.state !== "completed" && (
            <GapCollapse key="migration-actions" gap={STACK_GAP}>
            <Skeletonize loading={!status && !pageError}>
            <Flex justify="end" gap="2" wrap="wrap">
              {!legacy && (
                <Button
                  size="3"
                  variant="soft"
                  color="red"
                  disabled={!canDiscard}
                  onClick={() => setDiscardOpen(true)}
                >
                  <Trash2 size={17} />
                  {t(`${STRUCTURE_I18N}.discard`)}
                </Button>
              )}
              <Button
                size="3"
                disabled={!canStart}
                onClick={() => setConfirmOpen(true)}
              >
                {legacy ? <ArrowRight size={18} /> : <Play size={17} />}
                {t(`${prefix}.start`)}
              </Button>
            </Flex>
            </Skeletonize>
            </GapCollapse>
          )}
          </AnimatePresence>
        </Flex>
      </Container>

      <StartDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        legacy={legacy}
        busy={busy}
        summary={summary}
        sqliteRisk={sqliteRisk}
        largeRisk={largeRisk}
        confirmSQLite={confirmSQLite}
        onConfirmSQLiteChange={setConfirmSQLite}
        confirmLarge={confirmLarge}
        onConfirmLargeChange={setConfirmLarge}
        onStart={() => void start()}
      />

      <DiscardDialog
        open={discardOpen}
        onOpenChange={(open) => {
          setDiscardOpen(open);
          if (!open) setConfirmDiscard(false);
        }}
        busy={busy}
        confirmDiscard={confirmDiscard}
        onConfirmDiscardChange={setConfirmDiscard}
        onDiscard={() => void discard()}
      />

      <RestrictedLoginDialog
        auth={auth}
        requestFailedKey={`${COMMON_I18N}.request_failed`}
        onAuthenticated={refresh}
      />
    </PageMotion>
  );
}
