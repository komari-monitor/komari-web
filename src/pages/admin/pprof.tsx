import { Skeletonize } from "@/components/ui/skeleton";
import {
  Button,
  Callout,
  Dialog,
  Flex,
  SegmentedControl,
  Text,
} from "@radix-ui/themes";
import { AlertTriangle, RefreshCw } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { GapCollapse, SettingCard } from "@/components/admin/SettingCard";
import PageHeader from "@/components/PageHeader";
import { formatBytes } from "@/utils/unitHelper";
import { AnimatePresence } from "motion/react";
import { AutoHeight, PresenceBox } from "@/components/motion";
import {
  HEAP_PREVIEW_PLACEHOLDER,
  PLACEHOLDER_SUMMARY,
  captureDurations,
  pprofDownloadURL,
  pprofFilename,
  type PprofPreview,
  type PprofProfile,
  type PprofSummary,
} from "./pprof/model";
import {
  parsePprofSummary,
  previewErrorMessage,
  responseError,
  summaryErrorMessage,
} from "./pprof/api";
import { useRouteQuery } from "@/lib/routeData";
import { fetchPprofPreviewText, pprofSummaryQuery } from "@/routeQueries/system";
import { MetricValue, OverviewMetric } from "./pprof/OverviewMetric";
import ProfileRow from "./pprof/ProfileRow";

export default function PprofPage() {
  const { t } = useTranslation();
  const [captureSeconds, setCaptureSeconds] = React.useState(10);
  const [activeAction, setActiveAction] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PprofPreview | null>(null);

  // 概要与堆预览：切换页面时已由 routePreload 提前请求（堆预览在概要到达后接着请求）；
  // 等待预算内到达直接显示，否则数据区显示骨架
  const summaryResult = useRouteQuery(pprofSummaryQuery);
  const summaryLoading = summaryResult.loading;
  const parsed = React.useMemo(() => {
    if (summaryResult.error) {
      return { summary: null, error: summaryErrorMessage(summaryResult.error, t) };
    }
    if (!summaryResult.data) return { summary: null, error: null };
    try {
      return { summary: parsePprofSummary(summaryResult.data.payload, t), error: null };
    } catch (cause) {
      return { summary: null, error: cause instanceof Error ? cause.message : String(cause) };
    }
  }, [summaryResult.data, summaryResult.error, t]);
  const summary = parsed.summary;
  // 刷新开始时先清掉旧错误（与原来一致），结果出来再显示
  const summaryError = summaryLoading ? null : parsed.error;

  // 只有概要通过校验且带堆预览地址时才读堆预览
  const hasHeapPreview = Boolean(
    summary?.profiles.find((profile) => profile.name === "heap")?.preview,
  );
  const heapResult = useRouteQuery(
    hasHeapPreview ? (summaryResult.data?.heapPreview ?? null) : null,
  );
  const heapPreview = hasHeapPreview && !heapResult.error ? (heapResult.data ?? null) : null;
  const heapPreviewLoading = hasHeapPreview && heapResult.loading;
  const heapPreviewError =
    hasHeapPreview && heapResult.error
      ? previewErrorMessage(heapResult.error, t("pprof.request_failed"))
      : null;

  // 每次拿到新概要：当前采集时长不在可选项里就换成默认值
  const [syncedSummary, setSyncedSummary] = React.useState<PprofSummary | null>(null);
  if (summary && summary !== syncedSummary) {
    setSyncedSummary(summary);
    const options = captureDurations(summary);
    if (!options.includes(captureSeconds)) setCaptureSeconds(summary.duration.default_seconds);
  }

  const readProfilePreview = React.useCallback(
    async (profile: PprofProfile): Promise<string> => {
      if (!profile.preview) {
        throw new Error(t("pprof.preview_unavailable"));
      }
      try {
        return await fetchPprofPreviewText(profile.preview);
      } catch (cause) {
        throw new Error(previewErrorMessage(cause, t("pprof.request_failed")));
      }
    },
    [t],
  );

  const downloadProfile = async (profile: PprofProfile) => {
    setActiveAction(`${profile.name}:download`);
    setActionError(null);
    try {
      const response = await fetch(pprofDownloadURL(profile, captureSeconds), {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/octet-stream" },
      });
      if (!response.ok) {
        throw new Error(await responseError(response, t("pprof.request_failed")));
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = pprofFilename(profile);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setActiveAction(null);
    }
  };

  const previewProfile = async (profile: PprofProfile) => {
    if (profile.name === "heap" && heapPreview !== null) {
      setActionError(null);
      setPreview({ profile, text: heapPreview });
      return;
    }

    setActiveAction(`${profile.name}:preview`);
    setActionError(null);
    try {
      setPreview({ profile, text: await readProfilePreview(profile) });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setActiveAction(null);
    }
  };

  const busy = activeAction !== null;
  // 首次加载（还没有概要）：用占位概要渲染同结构的卡片；卡片标题、说明直接显示，只有数据区是骨架；
  // 刷新时保留旧数据并淡成骨架（Skeletonize 延迟期内保持可见）
  const firstLoading = summaryLoading && !summary;
  const shownSummary = summary ?? (summaryLoading ? PLACEHOLDER_SUMMARY : null);
  const durationOptions = shownSummary ? captureDurations(shownSummary) : [];

  return (
    <div className="km-page km-page-admin-pprof">
      <PageHeader
        title={t("pprof.title")}
        actions={
          <Button
            variant="soft"
            disabled={summaryLoading}
            onClick={() => void summaryResult.reload()}
          >
            <RefreshCw size={16} className={summaryLoading ? "animate-spin" : undefined} />
            {t("common.refresh")}
          </Button>
        }
      />

      {/* 警告、错误提示与三张卡片是同一区块：彼此之间 block（GapCollapse 默认 gap 就是 SPACE.block） */}
      <div className="flex flex-col gap-km-block">
      <Callout.Root color="orange" variant="surface">
        <Callout.Icon>
          <AlertTriangle size={16} />
        </Callout.Icon>
        <Callout.Text>{t("pprof.warning")}</Callout.Text>
      </Callout.Root>

      {/* feedback 层：错误提示出现/消失时高度展开/收起，下方卡片被平滑推开 */}
      <GapCollapse show={Boolean(summaryError)}>
        <Callout.Root color="red" variant="surface">
          <Callout.Icon>
            <AlertTriangle size={16} />
          </Callout.Icon>
          <Callout.Text>{summaryError}</Callout.Text>
        </Callout.Root>
      </GapCollapse>
      <GapCollapse show={Boolean(actionError)}>
        <Callout.Root color="red" variant="surface">
          <Callout.Icon>
            <AlertTriangle size={16} />
          </Callout.Icon>
          <Callout.Text>{actionError}</Callout.Text>
        </Callout.Root>
      </GapCollapse>

      <div className="flex flex-col gap-km-block">
      <SettingCard
        title={t("pprof.runtime_overview_title")}
        description={t("pprof.runtime_overview_description")}
      >
        {shownSummary ? (
          <div className="grid w-full grid-cols-1 gap-x-km-section sm:grid-cols-2 lg:grid-cols-5">
            {/* feedback 层：刷新后数值滚动，不整块重画 */}
            <OverviewMetric
              label={t("pprof.goroutines")}
              loading={summaryLoading}
              value={<MetricValue placeholder={!summary} value={shownSummary.runtime.goroutines} />}
            />
            <OverviewMetric
              label={t("pprof.heap_alloc")}
              loading={summaryLoading}
              value={<MetricValue placeholder={!summary} value={shownSummary.runtime.memory.heap_alloc} format={formatBytes} />}
            />
            <OverviewMetric
              label={t("pprof.heap_inuse")}
              loading={summaryLoading}
              value={<MetricValue placeholder={!summary} value={shownSummary.runtime.memory.heap_inuse} format={formatBytes} />}
            />
            <OverviewMetric
              label={t("pprof.heap_objects")}
              loading={summaryLoading}
              value={<MetricValue placeholder={!summary} value={shownSummary.runtime.memory.heap_objects} />}
            />
            <OverviewMetric
              label={t("pprof.runtime_sys")}
              loading={summaryLoading}
              value={<MetricValue placeholder={!summary} value={shownSummary.runtime.memory.sys} format={formatBytes} />}
            />
          </div>
        ) : (
          <Text size="2" color="gray" className="w-full py-3">
            {t("pprof.summary_unavailable")}
          </Text>
        )}
      </SettingCard>

      {shownSummary ? (
        <SettingCard
          title={t("pprof.heap_preview_title")}
          description={t("pprof.heap_preview_description")}
          className="km-pprof-output"
        >
          {/*
            content 层：堆预览加载中是同一个 pre 里的几行骨架，到达后原地淡入；
            预览 <-> 空/错误 之间才做交叉淡入，高度由 AutoHeight 弹簧跟随。
          */}
          <AutoHeight className="w-full mt-km-group">
          <AnimatePresence mode="popLayout" initial={false}>
            {heapPreviewLoading || firstLoading || heapPreview !== null ? (
              <PresenceBox key="preview" className="w-full">
                <Skeletonize loading={heapPreviewLoading || summaryLoading}>
                  <pre className="max-h-[32vh] w-full overflow-auto rounded-md border border-[var(--gray-a5)] p-3 text-xs">
                    {heapPreview ?? HEAP_PREVIEW_PLACEHOLDER}
                  </pre>
                </Skeletonize>
              </PresenceBox>
            ) : (
              <PresenceBox key="empty" className="w-full">
                <Skeletonize loading={summaryLoading}>
                  <Text
                    size="2"
                    color={heapPreviewError ? "red" : "gray"}
                    className="w-full py-3 break-words"
                  >
                    {heapPreviewError ?? t("pprof.preview_unavailable")}
                  </Text>
                </Skeletonize>
              </PresenceBox>
            )}
          </AnimatePresence>
          </AutoHeight>
        </SettingCard>
      ) : null}

      {shownSummary ? (
        <SettingCard
          title={t("pprof.profiles_title")}
          description={t("pprof.profiles_description")}
          className="km-pprof-form"
        >
          <Flex direction="column" gap="4" className="w-full mt-km-group">
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                {t("pprof.capture_duration")}
              </Text>
              {/* 列方向 flex：控件与原来一样被拉伸，色块与控件同宽 */}
              <Skeletonize loading={summaryLoading} className="flex flex-col">
              <SegmentedControl.Root
                value={String(captureSeconds)}
                onValueChange={(value) => {
                  const seconds = Number(value);
                  if (durationOptions.includes(seconds)) {
                    setCaptureSeconds(seconds);
                  }
                }}
                size="1"
              >
                {durationOptions.map((seconds) => (
                  <SegmentedControl.Item key={seconds} value={String(seconds)}>
                    {t("pprof.duration_option", { seconds })}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
              </Skeletonize>
            </Flex>

            <Skeletonize loading={summaryLoading}>
            <Flex direction="column" gap="0">
              {/* content 层：分析项逐条淡入，行间用 layout 跟随 */}
              <AnimatePresence initial={false}>
              {shownSummary.profiles.map((profile, index) => (
                <ProfileRow
                  key={profile.name}
                  index={index}
                  profile={profile}
                  busy={busy}
                  activeAction={activeAction}
                  onPreview={previewProfile}
                  onDownload={downloadProfile}
                />
              ))}
              </AnimatePresence>
            </Flex>
            </Skeletonize>
          </Flex>
        </SettingCard>
      ) : null}
      </div>
      </div>

      <Dialog.Root
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <Dialog.Content maxWidth="960px">
          <Dialog.Title>
            {preview
              ? t("pprof.preview_title", {
                  profile: t(`pprof.profiles.${preview.profile.name}.title`),
                })
              : t("pprof.title")}
          </Dialog.Title>
          <Dialog.Description size="2">
            {t("pprof.preview_description")}
          </Dialog.Description>
            <pre className="mt-km-block max-h-[65vh] overflow-auto rounded-md border border-[var(--gray-a5)] p-3 text-xs">
              {preview?.text}
            </pre>
          <Flex gap="2" justify="end" mt="5">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t("common.close")}
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
