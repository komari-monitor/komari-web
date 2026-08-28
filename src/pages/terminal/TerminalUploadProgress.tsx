import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RemoteUploadProgress, UploadChunkProgress } from "./useRemoteFileUpload";
import { formatFileSize } from "./fileManagerApi";
import { formatTransferRate } from "./transferFormat";

interface TerminalUploadProgressProps {
  progress: RemoteUploadProgress;
  onCancel: () => void;
}

export function TerminalUploadProgress({ progress, onCancel }: TerminalUploadProgressProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const totalChunks = progress.totalChunks ?? 0;
  const completedChunks = progress.completedChunks ?? 0;
  const chunks = progress.chunks ?? [];
  const activeChunks = chunks.filter((chunk) => chunk.status === "uploading" || chunk.status === "retrying");
  const chunkSummary = totalChunks > 0 ? `${completedChunks}/${totalChunks}` : undefined;

  useEffect(() => () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
  }, []);

  const handleEnter = () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(true), 350);
  };

  const handleLeave = () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHovered(false);
  };

  const statusLabel = (chunk: UploadChunkProgress) => {
    if (chunk.status === "done") return t("file_manager.upload_chunk_done", "已完成");
    if (chunk.status === "retrying") return t("file_manager.upload_chunk_retrying", "重试中");
    if (chunk.status === "uploading") return t("file_manager.upload_chunk_uploading", "上传中");
    return t("file_manager.upload_chunk_queued", "排队中");
  };

  return (
    <div
      className="relative shrink-0 border-t border-[#2b2b2b] bg-[#202020] px-2 py-1.5"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {hovered && (
        <div className="absolute bottom-full left-2 right-2 z-30 mb-1 max-h-[min(420px,60vh)] overflow-y-auto border border-[#3c3c3c] bg-[#252526] p-2 text-[10px] text-[#cccccc] shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#3a3a3a] pb-1.5">
            <div className="min-w-0">
              <div className="truncate font-medium text-[#e6e6e6]">{progress.name}</div>
              <div className="truncate text-[#858585]">{progress.destination}</div>
            </div>
            <div className="shrink-0 text-right text-[#bdbdbd]">
              <div>{chunkSummary ? `${t("file_manager.upload_chunks", "切片上传")}，${chunkSummary}` : t("file_manager.uploading", "上传中")}</div>
              <div>{formatTransferRate(progress.speed ?? 0)}</div>
            </div>
          </div>
          <div className="min-h-[160px] space-y-1.5">
            {activeChunks.slice(0, 5).map((chunk) => {
              const percent = chunk.size > 0 ? Math.min(100, Math.round((chunk.sent / chunk.size) * 100)) : 100;
              return (
                <div key={chunk.index} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-1.5">
                  <span className="text-[#a0a0a0]">{t("file_manager.upload_chunk", "区块")} {chunk.index + 1}</span>
                  <div className="min-w-0">
                    <div className="h-1 overflow-hidden bg-[#3a3a3a]">
                      <div className={`h-full transition-[width] ${chunk.status === "retrying" ? "bg-[#d7ba7d]" : "bg-[#4daafc]"}`} style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-0.5 flex justify-between gap-1 text-[#777]">
                      <span>{formatFileSize(chunk.sent)}/{formatFileSize(chunk.size)} · {percent}%</span>
                      <span>{statusLabel(chunk)}</span>
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-[#a8a8a8]">{formatTransferRate(chunk.speed)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-[#bdbdbd]">
        <span className="min-w-0 flex-1 truncate" title={progress.name}>{progress.name}</span>
        <span className="shrink-0 text-[#c8c8c8]">
          {formatFileSize(progress.uploadedBytes ?? 0)}/{formatFileSize(progress.size ?? 0)} - {progress.value}%
        </span>
        <span className="shrink-0 text-[#a8a8a8]">{formatTransferRate(progress.speed ?? 0)}</span>
        {chunkSummary && <span className="shrink-0 text-[#858585]">{chunkSummary}</span>}
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-0 bg-transparent p-0 text-[#f48771] hover:bg-[#3a3d41] hover:text-white"
          onClick={onCancel}
          title={t("common.cancel", "Cancel")}
          aria-label={t("common.cancel", "Cancel")}
        >
          <X size={12} />
        </button>
      </div>
      <div className="mt-1 h-1 overflow-hidden bg-[#3a3a3a]">
        <div
          className="h-full bg-[#007acc] transition-[width]"
          style={{ width: `${progress.value}%` }}
        />
      </div>
    </div>
  );
}

export default TerminalUploadProgress;
