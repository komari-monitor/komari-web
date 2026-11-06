import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Callout,
  Container,
  Flex,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { CheckCircle2, Database, LoaderCircle, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { AutoHeight, PageMotion } from "@/components/motion";
import { MOTION_SPRING } from "@/lib/motion";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/http";

import RestrictedLoginDialog from "@/components/RestrictedLoginDialog";
import {
  createGuideRequest,
  loadAuth,
  type LoginMethods,
  type Me,
} from "./database/api";
import GuidePageHeader from "./database/GuidePageHeader";
import PageErrorCallout from "./database/PageErrorCallout";
import SQLiteWarning from "./database/SQLiteWarning";

const API_BASE = "/api/admin/database-recovery";
const I18N_PREFIX = "database_recovery";
/** 状态未到时用真实表单渲染骨架 */
const PLACEHOLDER_STATUS: RecoveryStatus = { state: "waiting", failures: 0, max_failures: 3 };

type AuthStatus = LoginMethods & Me;

type RecoveryStatus = {
  state: "waiting" | "connecting" | "completed";
  failures: number;
  max_failures: number;
  error?: string;
  dsn?: string;
};

const request = createGuideRequest(API_BASE);

async function normalRouterAvailable(): Promise<boolean> {
  const probe = new URL(window.location.href);
  probe.searchParams.set("recovery_probe", Date.now().toString());
  const response = await fetch(probe, {
    cache: "no-store",
    redirect: "manual",
  });
  return (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  );
}

export default function DatabaseRecovery() {
  const { t } = useTranslation();
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [dsn, setDSN] = useState("");
  const [pageError, setPageError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setPageError("");
    try {
      if (await normalRouterAvailable()) {
        window.location.replace("/");
        return;
      }
      const nextAuth = await loadAuth(request);
      setAuth(nextAuth);
      if (!nextAuth.logged_in) {
        setStatus(null);
        return;
      }
      const nextStatus = await request<RecoveryStatus>("/status");
      setStatus(nextStatus);
      setDSN(nextStatus.dsn ?? "");
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : t(`${I18N_PREFIX}.network_error`),
      );
    }
  }, [t]);

  const authenticated = auth?.logged_in === true;
  const completed = status?.state === "completed";
  const canEdit =
    authenticated && status?.state === "waiting" && !busy;
  // 身份或状态还没到（且没有报错）：表单按真实布局渲染成骨架，到达后同一批 DOM 淡入
  const formLoading = !pageError && (auth === null || (authenticated && !status));
  const formStatus = status ?? PLACEHOLDER_STATUS;

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!status || status.state !== "waiting" || busy) return;
    if (!dsn.trim()) {
      setPageError(t(`${I18N_PREFIX}.dsn_required`));
      return;
    }
    setBusy(true);
    setPageError("");
    try {
      await request<Record<string, never>>("", {
        method: "POST",
        json: { dsn: dsn.trim() },
      });
      setStatus((current) => ({
        state: "completed",
        failures: current?.failures ?? 0,
        max_failures: current?.max_failures ?? 3,
        dsn: dsn.trim(),
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuth((current) =>
          current ? { ...current, logged_in: false } : current,
        );
      }
      setPageError(
        error instanceof Error
          ? error.message
          : t(`${I18N_PREFIX}.save_failed`),
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!completed) return;
    const timer = window.setInterval(async () => {
      try {
        if (await normalRouterAvailable()) {
          window.clearInterval(timer);
          window.location.replace("/");
          return;
        }
      } catch {
        // The listener is switching from recovery to normal mode.
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [completed]);

  return (
    <PageMotion className="km-page-database-recovery min-h-screen bg-[var(--color-background)] text-[var(--gray-12)]">
      <GuidePageHeader className="km-database-recovery-header" />

      <Container
        size="2"
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

          {/* 错误提示连同 section 间距一起展开/收起，下面的表单顺势移动 */}
          <PageErrorCallout error={pageError} motionKey="recovery-page-error" />

          {/* 表单 -> 完成卡：先淡出再弹入，高度用弹簧跟过去 */}
          <AutoHeight threshold={4}>
          <AnimatePresence initial={false} mode="wait">
          {authenticated && completed ? (
            <motion.div
              key="recovery-completed"
              // feedback 层：恢复完成时绿卡弹一下
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={MOTION_SPRING.pop}
            >
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
            </motion.div>
          ) : (authenticated && status) || formLoading ? (
            <motion.div
              key="recovery-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={MOTION_SPRING.soft}
            >
            <Skeletonize loading={formLoading}>
            {/* 内容（提示、字段）之间 block；底部按钮区与内容之间 section */}
            <Flex direction="column" gap="5">
            <Flex direction="column" gap="4">
              <Callout.Root color="amber" variant="surface">
                <Callout.Icon>
                  <Database size={18} />
                </Callout.Icon>
                <Callout.Text>
                  <Text as="div">
                    {formLoading
                      ? skeletonText(22)
                      : t(`${I18N_PREFIX}.failure_detail`, {
                          count: formStatus.failures,
                          max: formStatus.max_failures,
                        })}
                  </Text>
                  {status?.error && (
                    <Text as="div" size="1" mt="1" className="break-all">
                      {status.error}
                    </Text>
                  )}
                </Callout.Text>
              </Callout.Root>

              <label>
                <Text as="div" size="2" weight="bold" mb="2">
                  {t("settings.metrics.dsn_title")}
                </Text>
                <TextField.Root
                  size="3"
                  value={dsn}
                  onChange={(event) => {
                    setDSN(event.target.value);
                  }}
                  disabled={!canEdit}
                  autoFocus
                  spellCheck={false}
                />
                <Text as="div" size="1" color="gray" mt="2">
                  {t("settings.metrics.dsn_description")}
                </Text>
                <Text as="div" size="1" color="gray" mt="1">
                  {t(`${I18N_PREFIX}.history_note`)}
                </Text>
              </label>

              <SQLiteWarning dsn={dsn} motionKey="recovery-sqlite-warning" />
            </Flex>

              <Flex justify="end">
                <Button
                  size="3"
                  disabled={!canEdit || !dsn.trim()}
                  onClick={() => void save()}
                >
                  {busy || formStatus.state === "connecting" ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}
                  {busy || formStatus.state === "connecting"
                    ? t(`${I18N_PREFIX}.saving`)
                    : t(`${I18N_PREFIX}.save`)}
                </Button>
              </Flex>
            </Flex>
            </Skeletonize>
            </motion.div>
          ) : null}
          </AnimatePresence>
          </AutoHeight>
        </Flex>
      </Container>

      <RestrictedLoginDialog
        auth={auth}
        requestFailedKey={`${I18N_PREFIX}.request_failed`}
        onAuthenticated={load}
      />
    </PageMotion>
  );
}