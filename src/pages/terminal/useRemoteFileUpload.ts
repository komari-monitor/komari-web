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
  id: string;
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

interface ChunkTransferState {
  actual: number;
  lastActualTime: number;
}

const createChunkProgress = (size: number, chunkSize: number): UploadChunkProgress[] =>
  Array.from(
    { length: Math.max(1, Math.ceil(size / chunkSize)) },
    (_, index): UploadChunkProgress => {
      const chunkLength = Math.min(chunkSize, size - index * chunkSize);
      return {
        index,
        size: chunkLength,
        sent: 0,
        speed: 0,
        status: size === 0 ? "done" : "queued",
      };
    },
  );

const CONCURRENT_FILES = 3;
// The agent commits the upload session on the first chunk. Send chunk zero
// first, then fan out the remaining chunks so workers never race the handshake.
const CONCURRENT_CHUNKS = 5;
const MAX_RESUME_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const PROGRESS_INTERVAL_MS = 200;

const createUploadTaskID = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Upload canceled", "AbortError"));
    }, { once: true });
  });

const uploadEndpoint = (uuid: string, operation: string) =>
  `/api/admin/client/${encodeURIComponent(uuid)}/file/upload?operation=${operation}`;

const uploadChunkEndpoint = (uuid: string, uploadID: string, index: number) => {
  const params = new URLSearchParams({
    operation: "chunk",
    upload_id: uploadID,
    chunk_index: String(index),
  });
  return `/api/admin/client/${encodeURIComponent(uuid)}/file/upload?${params.toString()}`;
};

export const useRemoteFileUpload = (
  uuid: string | null,
  onComplete: (destination: string) => void,
  options: RemoteUploadOptions = {},
) => {
  const { t } = useTranslation();
  const [uploadProgress, setUploadProgress] = useState<RemoteUploadProgress[]>([]);
  const activeUploadsRef = useRef(0);
  const completedFilesRef = useRef(0);
  const abortControllersRef = useRef(new Map<string, AbortController>());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const updateProgress = useCallback((progress: RemoteUploadProgress) => {
    setUploadProgress((current) => {
      const existingIndex = current.findIndex((item) => item.id === progress.id);
      if (existingIndex < 0) {
        return [...current, progress];
      }
      const next = [...current];
      next[existingIndex] = progress;
      return next;
    });
  }, []);

  const removeProgress = useCallback((id: string) => {
    setUploadProgress((current) => current.filter((item) => item.id !== id));
  }, []);

  const uploadOne = useCallback(
    async (file: Blob, destination: string, name: string, uploadOptions: RemoteUploadOptions = options): Promise<boolean> => {
      const targetDirectory = normalizeRemotePath(destination);
      const targetPath = joinRemotePath(targetDirectory, name);
      const taskID = createUploadTaskID();
      const controller = new AbortController();
      abortControllersRef.current.set(taskID, controller);
      activeUploadsRef.current += 1;
      const fileCount = activeUploadsRef.current;
      let chunkSize = TRANSFER_CHUNK_SIZE;
      let chunks = createChunkProgress(file.size, chunkSize);
      let uploadID = "";
      let lastReportTime = performance.now();
      let lastSpeedTime = lastReportTime;
      let lastSpeedBytes = 0;
      let smoothedSpeed = 0;
      const chunkSpeedState = new Map<number, { time: number; sent: number; speed: number }>();
      const chunkTransferState = new Map<number, ChunkTransferState>();
      let progressTimer: number | null = null;

      const report = (force = false) => {
        const now = performance.now();
        if (!force && now - lastReportTime < PROGRESS_INTERVAL_MS) return;
        lastReportTime = now;

        for (const chunk of chunks) {
          const transfer = chunkTransferState.get(chunk.index);
          if (!transfer) continue;
          chunk.sent = Math.max(0, Math.min(chunk.size, transfer.actual));
        }

        const bytes = chunks.reduce((total, chunk) => total + chunk.sent, 0);
        const completedChunks = chunks.filter((chunk) => chunk.status === "done").length;

        const speedElapsed = now - lastSpeedTime;
        if (speedElapsed >= PROGRESS_INTERVAL_MS) {
          const instantSpeed = Math.max(0, (bytes - lastSpeedBytes) / (speedElapsed / 1000));
          smoothedSpeed = bytes > lastSpeedBytes
            ? smoothedSpeed > 0
              ? smoothedSpeed * 0.7 + instantSpeed * 0.3
              : instantSpeed
            : smoothedSpeed * 0.75;
          if (smoothedSpeed < 1024) smoothedSpeed = 0;
          lastSpeedTime = now;
          lastSpeedBytes = bytes;
        }

        for (const chunk of chunks) {
          const previous = chunkSpeedState.get(chunk.index) ?? {
            time: now,
            sent: chunk.sent,
            speed: 0,
          };
          const chunkElapsed = now - previous.time;
          if (chunkElapsed >= PROGRESS_INTERVAL_MS) {
            const chunkDelta = Math.max(0, chunk.sent - previous.sent);
            if (chunkDelta > 0) {
              const instantSpeed = chunkDelta / (chunkElapsed / 1000);
              previous.speed = previous.speed > 0
                ? previous.speed * 0.7 + instantSpeed * 0.3
                : instantSpeed;
            } else if (chunk.status === "uploading" || chunk.status === "retrying") {
              previous.speed *= 0.75;
              if (previous.speed < 1024) previous.speed = 0;
            }
            previous.time = now;
            previous.sent = chunk.sent;
          }
          chunk.speed = previous.speed;
          chunkSpeedState.set(chunk.index, previous);
        }

        updateProgress({
          id: taskID,
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

      const sendChunk = (index: number, chunk: Blob, onProgress: (sent: number) => void) =>
        new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          let settled = false;
          const cleanup = () => {
            controller.signal.removeEventListener("abort", handleAbort);
          };
          const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            cleanup();
            callback();
          };
          const handleAbort = () => {
            xhr.abort();
          };

          if (controller.signal.aborted) {
            reject(new DOMException("Upload canceled", "AbortError"));
            return;
          }

          // Keep the data body raw; Server relays it to the Agent over the
          // matching binary transfer stream instead of embedding it in RPC JSON.
          xhr.open("POST", uploadChunkEndpoint(uuid!, uploadID, index), true);
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.responseType = "json";
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              onProgress(Math.min(chunk.size, event.loaded));
            }
          });
          xhr.onload = () => {
            let payload: { message?: string; data?: Record<string, unknown> } | null = null;
            if (xhr.response && typeof xhr.response === "object") {
              payload = xhr.response as { message?: string; data?: Record<string, unknown> };
            } else {
              try {
                payload = JSON.parse(xhr.responseText) as { message?: string; data?: Record<string, unknown> };
              } catch {
                payload = null;
              }
            }
            if (xhr.status < 200 || xhr.status >= 300 || !payload?.data) {
              finish(() => reject(new Error(payload?.message || `Upload failed (${xhr.status})`)));
              return;
            }
            finish(resolve);
          };
          xhr.onerror = () => finish(() => reject(new Error("Upload failed (network error)")));
          xhr.ontimeout = () => finish(() => reject(new Error("Upload timed out")));
          xhr.onabort = () => finish(() => reject(new DOMException("Upload canceled", "AbortError")));
          controller.signal.addEventListener("abort", handleAbort, { once: true });
          xhr.send(chunk);
        });

      const uploadChunkWithRetry = async (index: number) => {
        const offset = index * chunkSize;
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        const chunkItem = chunks[index];
        chunkItem.status = "uploading";
        chunkItem.sent = 0;
        chunkItem.speed = 0;
        chunkTransferState.set(index, { actual: 0, lastActualTime: performance.now() });
        chunkSpeedState.set(index, { time: performance.now(), sent: 0, speed: 0 });
        report(true);
        let attempts = 0;
        let delay = RETRY_BASE_DELAY_MS;
        for (;;) {
          try {
            await sendChunk(index, chunk, (sent) => {
              const transfer = chunkTransferState.get(index);
              if (transfer && sent > transfer.actual) {
                transfer.actual = sent;
                transfer.lastActualTime = performance.now();
              }
            });
            const chunkItem = chunks[index];
            chunkItem.sent = chunkItem.size;
            chunkItem.status = "done";
            chunkTransferState.set(index, {
              actual: chunkItem.size,
              lastActualTime: performance.now(),
            });
            report(true);
            return;
          } catch (error) {
            if (controller.signal.aborted) throw error;
            attempts += 1;
            chunkItem.status = "retrying";
            const retryTime = performance.now();
            chunkItem.sent = 0;
            chunkTransferState.set(index, {
              actual: 0,
              lastActualTime: retryTime,
            });
            chunkSpeedState.set(index, { time: retryTime, sent: 0, speed: 0 });
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
        const initBody = JSON.stringify({ path: targetPath, size: file.size, chunk_size: TRANSFER_CHUNK_SIZE });
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
          if (Number.isFinite(session.chunk_size) && session.chunk_size > 0) {
            chunkSize = session.chunk_size;
            chunks = createChunkProgress(file.size, chunkSize);
          }
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
          id: taskID,
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
          await fetch(cancelURL, { method: "POST" }).catch(() => undefined);
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
        abortControllersRef.current.delete(taskID);
        activeUploadsRef.current -= 1;
        if (activeUploadsRef.current <= 0) {
          completedFilesRef.current = 0;
        }
        removeProgress(taskID);
      }
    },
    [options, removeProgress, t, updateProgress, uuid],
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

  const cancelUpload = useCallback((taskID?: string) => {
    if (taskID) {
      abortControllersRef.current.get(taskID)?.abort();
      return;
    }
    for (const controller of abortControllersRef.current.values()) {
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
