import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  TRANSFER_CHUNK_SIZE,
  joinRemotePath,
  normalizeRemotePath,
  remoteBasename,
  remoteDirname,
} from "./fileManagerApi";

export interface RemoteUploadProgress {
  name: string;
  destination: string;
  value: number;
  speed?: number;
  size?: number;
  uploadedBytes?: number;
  totalChunks?: number;
  completedChunks?: number;
  chunks?: UploadChunkProgress[];
  fileCount?: number;
  completedFiles?: number;
}

export interface UploadChunkProgress {
  index: number;
  size: number;
  sent: number;
  speed: number;
  status: "uploading" | "done" | "queued" | "retrying";
}

export interface RemoteUploadOptions {
  silent?: boolean;
}

interface UploadSessionResponse {
  upload_id: string;
  chunk_size: number;
  chunk_count: number;
  complete?: boolean;
}

const CONCURRENT_FILES = 3;
// The agent commits the upload session on the first chunk. Send chunk zero
// first, then fan out the remaining chunks so workers never race the handshake.
const CONCURRENT_CHUNKS = 5;
const MAX_RESUME_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const PROGRESS_INTERVAL_MS = 60;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Upload canceled", "AbortError"));
    }, { once: true });
  });

const makeFormData = (uploadID: string, index: number, chunk: Blob) => {
  const form = new FormData();
  form.append("upload_id", uploadID);
  form.append("chunk_index", String(index));
  form.append("chunk_data", chunk);
  return form;
};

const uploadEndpoint = (uuid: string, operation: string) =>
  `/api/admin/client/${encodeURIComponent(uuid)}/file/upload?operation=${operation}`;

export const useRemoteFileUpload = (
  uuid: string | null,
  onComplete: (destination: string) => void,
  options: RemoteUploadOptions = {},
) => {
  const { t } = useTranslation();
  const [uploadProgress, setUploadProgress] = useState<RemoteUploadProgress | null>(null);
  const activeUploadsRef = useRef(0);
  const completedFilesRef = useRef(0);
  const abortControllersRef = useRef(new Set<AbortController>());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const updateProgress = useCallback((progress: RemoteUploadProgress) => {
    setUploadProgress((current) => {
      if (!current) return progress;
      const smooth = current.value + (progress.value - current.value) * 0.35;
      return {
        ...progress,
        value: progress.value >= 100 ? 100 : Math.max(progress.value, Math.round(smooth)),
        speed: progress.speed ?? current.speed,
      };
    });
  }, []);

  const uploadOne = useCallback(
    async (file: Blob, destination: string, name: string, uploadOptions: RemoteUploadOptions = options): Promise<boolean> => {
      const targetDirectory = normalizeRemotePath(destination);
      const targetPath = joinRemotePath(targetDirectory, name);
      const controller = new AbortController();
      abortControllersRef.current.add(controller);
      activeUploadsRef.current += 1;
      const fileCount = activeUploadsRef.current;
      const chunks = Array.from(
        { length: Math.max(1, Math.ceil(file.size / TRANSFER_CHUNK_SIZE)) },
        (_, index): UploadChunkProgress => {
          const size = Math.min(TRANSFER_CHUNK_SIZE, file.size - index * TRANSFER_CHUNK_SIZE);
          return { index, size, sent: 0, speed: 0, status: file.size === 0 ? "done" : "queued" };
        },
      );
      let uploadID = "";
      let lastTime = performance.now();
      let lastBytes = 0;
      let lastTick = 0;
      let smoothedSpeed = 0;
      let progressTimer: number | null = null;

      const report = (force = false) => {
        const bytes = chunks.reduce((total, chunk) => total + chunk.sent, 0);
        const completedChunks = chunks.filter((chunk) => chunk.status === "done").length;
        const now = performance.now();
        if (!force && now - lastTick < PROGRESS_INTERVAL_MS) return;
        lastTick = now;
        const elapsed = Math.max(100, now - lastTime);
        if (bytes > lastBytes) {
          const instantSpeed = (bytes - lastBytes) / (elapsed / 1000);
          smoothedSpeed = smoothedSpeed > 0
            ? smoothedSpeed * 0.7 + instantSpeed * 0.3
            : instantSpeed;
        }
        lastTime = now;
        lastBytes = bytes;
        updateProgress({
          name,
          destination: targetDirectory,
          value: file.size === 0 ? 100 : Math.min(99, Math.round((bytes / file.size) * 100)),
          speed: smoothedSpeed,
          size: file.size,
          uploadedBytes: bytes,
          totalChunks: chunks.length,
          completedChunks,
          fileCount,
          completedFiles: completedFilesRef.current,
          chunks: [...chunks]
            .sort((left, right) => {
              if (left.status === "done" && right.status !== "done") return 1;
              if (left.status !== "done" && right.status === "done") return -1;
              return left.index - right.index;
            })
            .slice(0, 12)
            .map((chunk) => ({ ...chunk })),
        });
      };

      const send = async (operation: string, init?: RequestInit) => {
        const response = await fetch(uploadEndpoint(uuid!, operation), {
          ...init,
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as
          | { message?: string; data?: Record<string, unknown> }
          | null;
        if (!response.ok || !payload?.data) {
          throw new Error(payload?.message || `Upload failed (${response.status})`);
        }
        return payload.data as unknown as UploadSessionResponse;
      };

      const uploadChunkWithRetry = async (index: number) => {
        const offset = index * TRANSFER_CHUNK_SIZE;
        const chunk = file.slice(offset, Math.min(offset + TRANSFER_CHUNK_SIZE, file.size));
        const chunkItem = chunks[index];
        chunkItem.status = "uploading";
        report(true);
        const chunkStartTime = performance.now();
        let attempts = 0;
        let delay = RETRY_BASE_DELAY_MS;
        for (;;) {
          try {
            await send("chunk", {
              method: "POST",
              body: makeFormData(uploadID, index, chunk),
            });
            const chunkItem = chunks[index];
            chunkItem.sent = chunkItem.size;
            chunkItem.speed = chunkItem.size / (Math.max(100, performance.now() - chunkStartTime) / 1000);
            chunkItem.status = "done";
            report();
            return;
          } catch (error) {
            if (controller.signal.aborted) throw error;
            attempts += 1;
            chunkItem.status = "retrying";
            report(true);
            if (attempts >= MAX_RESUME_ATTEMPTS) throw error;
            await sleep(delay, controller.signal);
            delay *= 2;
          }
        }
      };

      try {
        report(true);
        progressTimer = window.setInterval(() => report(), PROGRESS_INTERVAL_MS);
        const initBody = JSON.stringify({ path: targetPath, size: file.size });
        if (file.size === 0) {
          await send("init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: initBody,
          });
        } else {
          const session = await send("init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: initBody,
          });
          uploadID = session.upload_id;
          const chunkCount = session.chunk_count;
          await uploadChunkWithRetry(0);
          let nextIndex = 1;
          const workers = Array.from(
            { length: Math.min(CONCURRENT_CHUNKS, Math.max(0, chunkCount - 1)) },
            async () => {
              while (nextIndex < chunkCount && !controller.signal.aborted) {
                const index = nextIndex;
                nextIndex += 1;
                await uploadChunkWithRetry(index);
              }
            },
          );
          await Promise.all(workers);
          report(true);
          await send("merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ upload_id: uploadID }),
          });
        }
        completedFilesRef.current += 1;
        updateProgress({
          name,
          destination: targetDirectory,
          value: 100,
          size: file.size,
          uploadedBytes: file.size,
          totalChunks: chunks.length,
          completedChunks: chunks.length,
          chunks: chunks.map((chunk) => ({ ...chunk, status: "done", sent: chunk.size })),
          fileCount,
          completedFiles: completedFilesRef.current,
        });
        if (!uploadOptions.silent) {
          toast.success(t("file_manager.upload_complete", "Upload complete"));
        }
        onCompleteRef.current(targetDirectory);
        return true;
      } catch (error) {
        const canceled = controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError");
        if (uploadID) {
          const cancelURL = `${uploadEndpoint(uuid!, "cancel")}&upload_id=${encodeURIComponent(uploadID)}`;
          void fetch(cancelURL, { method: "POST" }).catch(() => undefined);
        }
        if (canceled) {
          toast.info(t("file_manager.upload_canceled", "Upload canceled"));
          onCompleteRef.current(targetDirectory);
        } else {
          toast.error(error instanceof Error ? error.message : t("file_manager.upload_failed", "Upload failed"));
        }
        return false;
      } finally {
        if (progressTimer !== null) {
          window.clearInterval(progressTimer);
          progressTimer = null;
        }
        abortControllersRef.current.delete(controller);
        activeUploadsRef.current -= 1;
        if (activeUploadsRef.current <= 0) {
          completedFilesRef.current = 0;
          setUploadProgress(null);
        }
      }
    },
    [options, t, updateProgress, uuid],
  );

  const uploadFile = useCallback(
    async (file: File, destination: string) => {
      if (!uuid || !file) return;
      await uploadOne(file, destination, file.name);
    },
    [uploadOne, uuid],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[], destination: string) => {
      const queue = Array.from(files);
      if (!uuid || queue.length === 0) return;
      let next = 0;
      const workers = Array.from(
        { length: Math.min(CONCURRENT_FILES, queue.length) },
        async () => {
          while (next < queue.length) {
            const file = queue[next];
            next += 1;
            await uploadOne(file, destination, file.name);
          }
        },
      );
      await Promise.all(workers);
    },
    [uploadOne, uuid],
  );

  const uploadBlob = useCallback(
    async (blob: Blob, targetPath: string, uploadOptions?: RemoteUploadOptions) => {
      if (!uuid || !blob) return false;
      const normalizedPath = normalizeRemotePath(targetPath);
      return uploadOne(blob, remoteDirname(normalizedPath), remoteBasename(normalizedPath), uploadOptions);
    },
    [uploadOne, uuid],
  );

  const cancelUpload = useCallback(() => {
    for (const controller of Array.from(abortControllersRef.current)) {
      controller.abort();
    }
  }, []);

  return {
    uploadProgress,
    uploadFile,
    uploadFiles,
    uploadBlob,
    cancelUpload,
  };
};

export default useRemoteFileUpload;
