import { useCallback, useMemo } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import type {
  RemoteFileReadResult,
  RemoteFileInfo,
  RemoteSearchResult,
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
  data?: string;
  mode?: string;
  owner?: string;
  group?: string;
  source?: string;
  destination?: string;
}

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
      const result = await call<RemoteFileRpc, RemoteFileReadResult>("admin:fileRead", { uuid, path });
      if (!result || typeof result.data !== "string") {
        throw new Error("Invalid file response");
      }
      return result;
    },
    [call, uuid],
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
