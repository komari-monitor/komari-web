import { useCallback, useMemo } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import {
  cacheTransferChunkSize,
  fileDownloadUrl,
  getCachedTransferChunkSize,
  MAX_EDITABLE_FILE_SIZE,
  type RemoteFileReadResult,
  type RemoteFileInfo,
  type RemoteSearchResult,
} from "./fileManagerApi";

export interface RemoteFileService {
  list: (path: string) => Promise<RemoteFileInfo[]>;
  roots: () => Promise<RemoteFileInfo[]>;
  stat: (path: string) => Promise<RemoteFileInfo>;
  read: (path: string) => Promise<RemoteFileReadResult>;
  mkdir: (path: string, mode?: string) => Promise<void>;
  search: (path: string, query: string, content: boolean) => Promise<RemoteSearchResult>;
  remove: (path: string) => Promise<void>;
  move: (source: string, destination: string) => Promise<void>;
  copy: (source: string, destination: string) => Promise<void>;
  chmod: (path: string, mode: string) => Promise<void>;
  chown: (path: string, owner: string, group: string) => Promise<void>;
}

interface RemoteFileRpc {
  uuid: string;
  path?: string;
  query?: string;
  content?: boolean;
  mode?: string;
  owner?: string;
  group?: string;
  source?: string;
  destination?: string;
}

const readHTTPError = async (response: Response) => {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  return payload?.message || `Failed to read file (${response.status})`;
};

const editableFileLimitError = () =>
  new Error(`file exceeds the ${MAX_EDITABLE_FILE_SIZE} byte edit limit`);

const readResponseBytes = async (response: Response, limit: number) => {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > limit) throw editableFileLimitError();
    return new Uint8Array(buffer);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        try {
          await reader.cancel();
        } catch {
          // The body is already over the editor limit; preserve that error.
        }
        throw editableFileLimitError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

export const useRemoteFileService = (uuid: string): RemoteFileService => {
  const { call } = useRPC2Call();

  const list = useCallback(
    async (path: string) => {
      const items = await call<RemoteFileRpc, RemoteFileInfo[]>("admin:fileList", { uuid, path });
      if (!Array.isArray(items)) {
        throw new Error("Invalid directory response");
      }
      return items;
    },
    [call, uuid],
  );

  const roots = useCallback(
    async () => {
      const items = await call<RemoteFileRpc, RemoteFileInfo[]>("admin:fileListRoots", { uuid });
      if (!Array.isArray(items)) {
        throw new Error("Invalid roots response");
      }
      return items;
    },
    [call, uuid],
  );

  const stat = useCallback(
    async (path: string) => {
      const file = await call<RemoteFileRpc, RemoteFileInfo>("admin:fileStat", { uuid, path });
      if (!file || typeof file.path !== "string") {
        throw new Error("Invalid file response");
      }
      return file;
    },
    [call, uuid],
  );

  const read = useCallback(
    async (path: string) => {
      // File contents travel over the binary HTTP transfer endpoint. RPC is
      // reserved for metadata and filesystem control operations.
      const response = await fetch(fileDownloadUrl(uuid, path, true), {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/octet-stream" },
      });
      if (!response.ok) {
        throw new Error(await readHTTPError(response));
      }
      const advertisedChunkSize = Number(response.headers.get("X-Komari-Transfer-Chunk-Size"));
      const cachedChunkSize = getCachedTransferChunkSize(uuid, "download");
      if (Number.isFinite(advertisedChunkSize) &&
        (!cachedChunkSize || advertisedChunkSize <= cachedChunkSize)) {
        cacheTransferChunkSize(uuid, "download", advertisedChunkSize);
      }
      const advertisedSize = Number(response.headers.get("Content-Length"));
      if (Number.isFinite(advertisedSize) && advertisedSize > MAX_EDITABLE_FILE_SIZE) {
        try {
          await response.body?.cancel();
        } catch {
          // Preserve the size-limit error even if the network body is closing.
        }
        throw editableFileLimitError();
      }
      const bytes = await readResponseBytes(response, MAX_EDITABLE_FILE_SIZE);
      const lastModified = response.headers.get("Last-Modified");
      const modifiedTimestamp = lastModified ? Date.parse(lastModified) : Number.NaN;
      const modifiedAt = Number.isFinite(modifiedTimestamp)
        ? new Date(modifiedTimestamp).toISOString()
        : "";
      return {
        bytes,
        size: bytes.byteLength,
        modified_at: modifiedAt,
        content_type: response.headers.get("Content-Type") || "",
      } satisfies RemoteFileReadResult;
    },
    [uuid],
  );

  const mkdir = useCallback(
    async (path: string, mode = "0755") => {
      await call("admin:fileMkdir", { uuid, path, mode });
    },
    [call, uuid],
  );

  const search = useCallback(
    async (path: string, query: string, content: boolean) => {
      return call<RemoteFileRpc, RemoteSearchResult>("admin:fileSearch", {
        uuid,
        path,
        query,
        content,
      });
    },
    [call, uuid],
  );

  const remove = useCallback(
    async (path: string) => {
      await call("admin:fileDelete", { uuid, path });
    },
    [call, uuid],
  );

  const move = useCallback(
    async (source: string, destination: string) => {
      await call("admin:fileMove", { uuid, source, destination });
    },
    [call, uuid],
  );

  const copy = useCallback(
    async (source: string, destination: string) => {
      await call("admin:fileCopy", { uuid, source, destination });
    },
    [call, uuid],
  );

  const chmod = useCallback(
    async (path: string, mode: string) => {
      await call("admin:fileChmod", { uuid, path, mode });
    },
    [call, uuid],
  );

  const chown = useCallback(
    async (path: string, owner: string, group: string) => {
      await call("admin:fileChown", { uuid, path, owner, group });
    },
    [call, uuid],
  );

  return useMemo(
    () => ({
      search,
      list,
      roots,
      stat,
      read,
      mkdir,
      remove,
      move,
      copy,
      chmod,
      chown,
    }),
    [search, list, roots, stat, read, mkdir, remove, move, copy, chmod, chown],
  );
};

export default useRemoteFileService;
