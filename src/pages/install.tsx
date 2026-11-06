import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AutoHeight, PageMotion } from "@/components/motion";
import { GapCollapse } from "@/components/GapCollapse";
import { SPACE } from "@/lib/spacing";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
} from "@/lib/motion";
import {
  Button,
  Callout,
  Card,
  Container,
  Flex,
  Heading,
  Progress,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import GuideHeader from "@/components/GuideHeader";
import UploadDialog from "@/components/UploadDialog";
import { createChunkUploadTask, type ChunkUploadTask } from "@/lib/chunkUpload";
import { createGuideRequest } from "./database/api";
import SQLiteWarning from "./database/SQLiteWarning";

type InstallStatus = { state: string; required: boolean };

const request = createGuideRequest("/api/install");

export default function Install() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  // 步骤方向：下一步从右来、上一步从左来（Anticipation，和安装向导的心理模型一致）
  const [stepDirection, setStepDirection] = useState(1);
  const goToStep = (next: number) => {
    setStep((current) => {
      const target = Math.max(0, next);
      setStepDirection(target >= current ? 1 : -1);
      return target;
    });
  };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [sitename, setSitename] = useState("Komari");
  const [description, setDescription] = useState(
    "A simple server monitor tool.",
  );
  const [metricDSN, setMetricDSN] = useState("./data/metrics.db");
  const [busy, setBusy] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const restoreTaskRef = useRef<ChunkUploadTask | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    void request<InstallStatus>("/status")
      .then((status) => setReady(status.required))
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : t("install.connection_error"),
        ),
      );
  }, [t]);

  const next = () => {
    setError("");
    if (step === 1 && !username.trim())
      return setError(t("install.username_required"));
    if (step === 1 && password.length < 8)
      return setError(t("account.password_too_short_error"));
    if (step === 1 && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
      return setError(t("account.password_strength_error"));
    if (step === 1 && password !== passwordAgain)
      return setError(t("account.password_mismatch_error"));
    if (step === 2 && !sitename.trim())
      return setError(t("install.sitename_required"));
    if (step === 3 && !metricDSN.trim())
      return setError(t("install.dsn_required"));
    goToStep(Math.min(step + 1, 4));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step !== 4) return next();
    setBusy(true);
    setError("");
    try {
      await request("/complete", {
        method: "POST",
        json: {
          username,
          password,
          sitename,
          description,
          metric_dsn: metricDSN,
        },
      });
      window.setTimeout(() => window.location.assign("/"), 1200);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("install.failed"));
      setBusy(false);
    }
  };

  const restoreBackup = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError(t("install.restore_file_type"));
      return;
    }

    setError("");
    setRestoring(true);
    setRestoreProgress(0);
    const task = createChunkUploadTask("/api/install/upload");
    restoreTaskRef.current = task;
    let restored = false;
    try {
      await task.upload("backup", file, setRestoreProgress);
      restored = true;
      window.setTimeout(() => window.location.assign("/"), 5000);
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setError(
          reason instanceof Error
            ? reason.message
            : t("install.restore_failed"),
        );
      }
      setRestoreProgress(0);
    } finally {
      restoreTaskRef.current = null;
      if (!restored) setRestoring(false);
    }
  };

  const cancelRestore = () => {
    restoreTaskRef.current?.cancel();
    setRestoreProgress(0);
  };

  const titles = ["welcome", "administrator", "site", "database", "confirm"];
  // 状态请求回来发现已安装：向导淡出后「已完成」再淡入（两块都是 surface 进退场），不硬切
  return (
    <AnimatePresence mode="wait" initial={false}>
    {ready === false ? (
      <PageMotion key="install-completed" className="km-page-install flex min-h-screen items-center justify-center p-km-section">
        <Text>{t("install.completed")}</Text>
      </PageMotion>
    ) : (
    // 低密度页：上下留白窄屏 page、宽屏 hero，左右窄屏 block、宽屏 page（与数据库恢复/迁移页一致）
    <PageMotion key="install-wizard" className="km-page-install min-h-screen px-km-block py-km-page sm:px-km-page sm:py-km-hero">
      <Container size="2">
        {/* 页头、标题、步骤条、步骤卡+按钮区：彼此是不同区块，统一 section */}
        <Flex direction="column" gap="5">
        <div className="km-install-header">
          <GuideHeader />
        </div>
        <Heading size="7">
          {t("install.title")}
        </Heading>
        {/* 进度条和步骤名是同一组 */}
        <Flex direction="column" gap="2">
        <Progress value={((step + 1) / titles.length) * 100} size="2" />
        <Flex gapX="4" gapY="2" wrap="wrap">
          {titles.map((title, index) => (
            <motion.div
              key={title}
              initial={false}
              animate={{
                opacity: index === step ? 1 : 0.65,
                scale: index === step ? 1 : 0.98,
              }}
              transition={MOTION_SPRING.snappy}
            >
              <Text
                size="2"
                weight={index === step ? "bold" : "regular"}
                color={index === step ? undefined : "gray"}
              >
                {index + 1}. {t(`install.steps.${title}`)}
              </Text>
            </motion.div>
          ))}
        </Flex>
        </Flex>
        {/* feedback 层：校验失败的提示展开，下方步骤卡顺势下移（高度弹簧），而不是被顶一下；
            它在 section 栈里，GapCollapse 连同这份间距一起补间 */}
        <AnimatePresence initial={false}>
          {error && (
            <GapCollapse key="install-error" gap={SPACE.section}>
              <Callout.Root color="red" variant="surface">
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            </GapCollapse>
          )}
        </AnimatePresence>
        <form onSubmit={submit} className="km-install-form">
          <Card size="3" className="km-install-step">
            {/* 各步骤内容高度不同：卡片高度跟着弹簧过渡，不在换步时跳一下 */}
            <AutoHeight threshold={4}>
            <AnimatePresence mode="wait" initial={false} custom={stepDirection}>
              <motion.div
                key={step}
                // content 层：步骤内容沿方向滑入/滑出，卡片外壳保持不动
                initial={{ opacity: 0, x: stepDirection * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: stepDirection * -24 }}
                transition={{
                  x: MOTION_SPRING.snappy,
                  opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
                }}
              >
            {/* 各步统一：步骤标题（标题+说明 inline）→ 内容 block；字段之间 block；label → 输入框 group */}
            {step === 0 && (
              <Flex direction="column" gap="4">
                <Flex direction="column" gap="1">
                  <Heading size="6">{t("install.welcome_title")}</Heading>
                  <Text size="2" color="gray">
                    {t("install.welcome_subtitle")}
                  </Text>
                </Flex>
                <Text size="3">{t("install.welcome_description")}</Text>
              </Flex>
            )}
            {step === 1 && (
              <Flex direction="column" gap="4">
                <Flex align="center" gap="2">
                  <ShieldCheck size={24} />
                  <Heading size="5">{t("install.admin_title")}</Heading>
                </Flex>
                <label>
                  <Text as="div" size="2" weight="bold" mb="2">
                    {t("install.username")}
                  </Text>
                  <TextField.Root
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </label>
                <label>
                  <Text as="div" size="2" weight="bold" mb="2">
                    {t("install.password")}
                  </Text>
                  <TextField.Root
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  <Text as="div" size="2" weight="bold" mb="2">
                    {t("install.password_confirm")}
                  </Text>
                  <TextField.Root
                    type="password"
                    value={passwordAgain}
                    onChange={(event) => setPasswordAgain(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              </Flex>
            )}
            {step === 2 && (
              <Flex direction="column" gap="4">
                <Flex direction="column" gap="1">
                  <Heading size="5">{t("install.site_title")}</Heading>
                  <Text size="2" color="gray">
                    {t("install.site_hint")}
                  </Text>
                </Flex>
                <label>
                  <Text as="div" size="2" weight="bold" mb="2">
                    {t("install.sitename")}
                  </Text>
                  <TextField.Root
                    value={sitename}
                    onChange={(event) => setSitename(event.target.value)}
                    autoFocus
                  />
                </label>
                <label>
                  <Text as="div" size="2" weight="bold" mb="2">
                    {t("install.description")}
                  </Text>
                  <TextArea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                  />
                </label>
              </Flex>
            )}
            {step === 3 && (
              <Flex direction="column" gap="4">
                <Flex direction="column" gap="1">
                  <Heading size="5">{t("install.database_title")}</Heading>
                  <Text size="2" color="gray">
                    {t("settings.metrics.dsn_description")}
                  </Text>
                </Flex>
                <label>
                  <Text as="div" size="2" weight="bold" mb="2">
                    {t("settings.metrics.dsn_title")}
                  </Text>
                  <TextField.Root
                    value={metricDSN}
                    onChange={(event) => setMetricDSN(event.target.value)}
                    autoFocus
                  />
                </label>
                <SQLiteWarning dsn={metricDSN} motionKey="install-sqlite-warning" />
              </Flex>
            )}
            {step === 4 && (
              <Flex direction="column" gap="4">
                <Heading size="5">{t("install.confirm_title")}</Heading>
                <Card variant="surface" size="2">
                  <Flex direction="column" gap="2">
                    <Text size="2">
                      <strong>{t("install.summary_admin")}</strong>
                      {username}
                    </Text>
                    <Text size="2">
                      <strong>{t("install.summary_sitename")}</strong>
                      {sitename}
                    </Text>

                    <Text size="2" className="break-all">
                      <strong>{t("install.summary_dsn")}</strong>
                      {metricDSN}
                    </Text>
                  </Flex>
                </Card>
              </Flex>
            )}
              </motion.div>
            </AnimatePresence>
            </AutoHeight>
          </Card>
          {/* 按钮区与步骤卡之间 section，按钮之间 group */}
          <Flex justify="between" mt="5">
            <Button
              type="button"
              variant="soft"
              color="gray"
              disabled={step === 0 || busy || restoring}
              onClick={() => {
                setError("");
                goToStep(step - 1);
              }}
            >
              <ArrowLeft size={16} />
              {t("install.back")}
            </Button>
            {step < 4 ? (
              <Flex gap="2">
                {/* control 层：「恢复备份」只在第一步出现，离开/回来时缩放淡出淡入 */}
                <AnimatePresence initial={false} mode="popLayout">
                {step === 0 && (
                  <motion.span
                    key="install-restore"
                    className="inline-flex"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={MOTION_SPRING.snappy}
                  >
                  <Button
                    type="button"
                    variant="soft"
                    disabled={busy || restoring || ready === null}
                    onClick={() => setRestoreOpen(true)}
                  >
                    {restoring ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {t(
                      restoring
                        ? "install.restore_restarting"
                        : "install.restore",
                    )}
                  </Button>
                  </motion.span>
                )}
                </AnimatePresence>
                <Button type="button" disabled={restoring} onClick={next}>
                  {t(step === 0 ? "install.start" : "install.next")}
                  <ArrowRight size={16} />
                </Button>
              </Flex>
            ) : (
              <Button type="submit" disabled={busy || ready === null}>
                {busy ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {t("install.complete")}
              </Button>
            )}
          </Flex>
        </form>
        </Flex>
        <UploadDialog
          open={restoreOpen}
          onOpenChange={setRestoreOpen}
          title={t("install.restore")}
          description={error || t("install.restore_description")}
          accept=".zip"
          dragDropText={t("theme.drag_drop")}
          clickToBrowseText={t("theme.or_click_to_browse")}
          hintText={t("theme.zip_files_only")}
          uploading={restoring}
          progress={restoreProgress}
          uploadingText={t("install.restore_restarting")}
          cancelUploadLabel={t("common.cancel")}
          onCancelUpload={cancelRestore}
          onFileSelected={restoreBackup}
          closeLabel={t("common.cancel")}
        />
      </Container>
    </PageMotion>
    )}
    </AnimatePresence>
  );
}