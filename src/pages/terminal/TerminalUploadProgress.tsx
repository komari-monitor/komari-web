import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatedNumber } from "@/components/motion";
import {
  CONTENT_MOTION,
  FEEDBACK_MOTION,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import type { RemoteUploadProgress, UploadChunkProgress } from "./useRemoteFileUpload";
import { formatFileSize } from "./fileManagerApi";
import { formatTransferRate } from "./transferFormat";

const RATE_WIDTH_CLASS = "w-[76px] min-w-[76px] shrink-0 overflow-hidden text-ellipsis text-right tabular-nums";

const formatUploadPercent = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  const clamped = Math.max(0, Math.min(100, value));
  return String(Math.round(clamped * 10) / 10);
};

interface TerminalUploadProgressProps {
  progress: RemoteUploadProgress[];
  onCancel: (id: string) => void;
}

interface UploadProgressRowProps {
  progress: RemoteUploadProgress;
  onCancel: (id: string) => void;
}

interface PopoverAnchor {
  left: number;
  bottom: number;
  width: number;
}

const UploadProgressRow = memo(function UploadProgressRow({ progress, onCancel }: UploadProgressRowProps) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const totalChunks = progress.totalChunks ?? 0;
  const completedChunks = progress.completedChunks ?? 0;
  const chunks = progress.chunks ?? [];
  const activeChunks = chunks.filter((chunk) => chunk.status === "uploading" || chunk.status === "retrying");
  const displayChunks = (
    activeChunks.length > 0
      ? [
          ...activeChunks,
          ...chunks.filter((chunk) => chunk.status !== "uploading" && chunk.status !== "retrying"),
        ]
      : chunks
  ).slice(0, 5);
  const chunkSummary = totalChunks > 0 ? `${completedChunks}/${totalChunks}` : undefined;
  const totalRate = formatTransferRate(progress.speed ?? 0);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  useEffect(() => clearHoverTimer, [clearHoverTimer]);

  const updateAnchor = useCallback(() => {
    const el = rowRef.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(
      window.innerWidth - 16,
      Math.max(300, Math.min(400, rect.width || 320)),
    );
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const bottom = Math.max(8, window.innerHeight - rect.top + 6);
    setAnchor({ left, bottom, width });
  }, []);

  useLayoutEffect(() => {
    if (!hovered) return;
    updateAnchor();
    const handleReposition = () => updateAnchor();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [hovered, updateAnchor]);

  const handleEnter = () => {
    clearHoverTimer();
    if (hovered) return;
    hoverTimer.current = window.setTimeout(() => {
      updateAnchor();
      setHovered(true);
    }, 180);
  };

  const handleLeave = () => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => {
      setHovered(false);
    }, 120);
  };

  const statusLabel = (chunk: UploadChunkProgress) => {
    if (chunk.status === "done") return t("file_manager.upload_chunk_done", "已完成");
    if (chunk.status === "retrying") return t("file_manager.upload_chunk_retrying", "重试中");
    if (chunk.status === "uploading") return t("file_manager.upload_chunk_uploading", "上传中");
    return t("file_manager.upload_chunk_queued", "排队中");
  };

  return (
    <div
      ref={rowRef}
      className="relative min-h-[48px] shrink-0 border-b border-white/[0.08] px-2 py-1.5 last:border-b-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence initial={false}>
            {hovered && anchor && (
              <motion.div
                key={`chunk-detail-${progress.id}`}
                // overlay 层：Portal 到 body 上避免被面板 overflow-hidden 裁剪
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={MOTION_SPRING.soft}
                style={{
                  left: anchor.left,
                  bottom: anchor.bottom,
                  width: anchor.width,
                }}
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
                className="fixed z-[100000] max-h-[min(420px,calc(100vh-96px))] overflow-y-auto rounded-[6px] border border-white/[0.12] bg-[#1c1c1e]/95 p-2.5 text-[10px] text-[#cccccc] shadow-[0_10px_28px_rgba(0,0,0,0.55)] backdrop-blur-md"
              >
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/[0.1] pb-1.5">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#e6e6e6]">{progress.name}</div>
                    <div className="truncate text-[#858585]">{progress.destination}</div>
                  </div>
                  <div className="w-[120px] min-w-[120px] shrink-0 text-right text-[#bdbdbd] tabular-nums">
                    <div className="whitespace-nowrap">
                      {chunkSummary ? `${t("file_manager.upload_chunks", "切片上传")}，${chunkSummary}` : t("file_manager.uploading", "上传中")}
                    </div>
                    <div className={`${RATE_WIDTH_CLASS} ml-auto`} title={totalRate}>{totalRate}</div>
                  </div>
                </div>
                {displayChunks.length > 0 && (
                  <div className="space-y-1.5">
                    {displayChunks.map((chunk) => {
                      const percent = chunk.size > 0
                        ? Math.min(100, Math.round((chunk.sent / chunk.size) * 1000) / 10)
                        : 100;
                      const chunkRate = formatTransferRate(chunk.speed);
                      return (
                        <div key={chunk.index} className="grid grid-cols-[52px_minmax(0,1fr)_76px] items-center gap-1.5">
                          <span className="text-[#a0a0a0]">{t("file_manager.upload_chunk", "区块")} {chunk.index + 1}</span>
                          <div className="min-w-0">
                            <div className="h-1 overflow-hidden rounded-full bg-white/[0.12]">
                              <div className={`h-full transition-[width] ${chunk.status === "retrying" ? "bg-[#d7ba7d]" : "bg-[#4daafc]"}`} style={{ width: `${percent}%` }} />
                            </div>
                            <div className="mt-0.5 flex justify-between gap-1 whitespace-nowrap text-[#8c8c8c]">
                              <span>{formatFileSize(chunk.sent)}/{formatFileSize(chunk.size)} · {formatUploadPercent(percent)}%</span>
                              <span>{statusLabel(chunk)}</span>
                            </div>
                          </div>
                          <span className={`${RATE_WIDTH_CLASS} whitespace-nowrap text-[#a8a8a8]`} title={chunkRate}>{chunkRate}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {totalChunks > displayChunks.length && (
                  <div className="mt-1.5 border-t border-white/[0.08] pt-1 text-[10px] text-[#8c8c8c]">
                    {t("file_manager.upload_chunk_summary", {
                      active: activeChunks.length,
                      count: totalChunks,
                      defaultValue: `Showing active chunks only (${activeChunks.length} concurrent, ${totalChunks} total)`,
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <div className="flex items-center gap-1.5 text-[10px] text-[#bdbdbd]">
        <span className="min-w-0 flex-1 truncate font-medium text-[#e2e2e2]" title={progress.name}>
          {progress.name}
        </span>
        <span className="shrink-0 tabular-nums text-[#c8c8c8]">
          <AnimatedNumber
            value={Math.max(0, Math.min(100, progress.value))}
            format={formatUploadPercent}
            className="inline-block"
          />
          %
        </span>
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-0 bg-transparent p-0 text-[#f48771] hover:bg-[#3a3d41] hover:text-white"
          onClick={() => onCancel(progress.id)}
          title={t("common.cancel", "Cancel")}
          aria-label={`${t("common.cancel", "Cancel")}: ${progress.name}`}
        >
          <X size={12} />
        </button>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] tabular-nums text-[#9a9a9a]">
        <span className="truncate">
          {formatFileSize(progress.uploadedBytes ?? 0)}/{formatFileSize(progress.size ?? 0)}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {chunkSummary && <span className="text-[#858585]">{chunkSummary}</span>}
          <span className="text-[#a8a8a8]" title={totalRate}>{totalRate}</span>
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden bg-[#3a3a3a]">
        {/* feedback 层：进度用弹簧缩放追赶，连续刷新时是「追着走」而不是硬跳 */}
        <motion.div
          className="h-full origin-left bg-[#007acc]"
          style={{ width: "100%" }}
          initial={false}
          animate={{ scaleX: Math.max(0, Math.min(100, progress.value)) / 100 }}
          transition={{
            scaleX: { ...MOTION_SPRING.soft, restDelta: 0.0005 },
            backgroundColor: FEEDBACK_MOTION.number,
          }}
        />
      </div>
    </div>
  );
});

export function TerminalUploadProgress({ progress, onCancel }: TerminalUploadProgressProps) {
  return (
    <AnimatePresence initial={false}>
      {progress.length > 0 && (
        <motion.div
          key="upload-progress-panel"
          // overlay 层：从底部边缘滑入，取消/完成后收回
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={MOTION_SPRING.soft}
          className="relative shrink-0 overflow-hidden border-t border-white/[0.08] bg-[#202020]/75 backdrop-blur-sm"
        >
          <div className="flex min-h-[48px] flex-col overflow-visible">
            <AnimatePresence initial={false}>
              {progress.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={CONTENT_MOTION.item.initial}
                  animate={CONTENT_MOTION.item.animate}
                  exit={CONTENT_MOTION.item.exit}
                  transition={{
                    layout: MOTION_SPRING.layout,
                    opacity: MOTION_TRANSITION.fade,
                  }}
                >
                  <UploadProgressRow progress={item} onCancel={onCancel} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TerminalUploadProgress;
