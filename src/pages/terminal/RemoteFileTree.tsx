import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ChevronRight,
  Copy,
  ClipboardCopy,
  Download,
  FileCode2,
  FilePlus2,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  KeyRound,
  Link2,
  Pencil,
  RefreshCw,
  Scissors,
  Trash2,
  Upload,
} from "lucide-react";
import { useRemoteFileService } from "./useRemoteFileService";
import {
  FileContextMenu,
  useContextMenu,
  type ContextMenuItemConfig,
} from "./FileContextMenu";
import {
  fileDownloadUrl,
  copyTextToClipboard,
  formatClipboardPath,
  joinRemotePath,
  normalizeRemotePath,
  remoteAncestors,
  remoteBasename,
  remoteDirname,
  sortRemoteFiles,
  type RemoteFileInfo,
} from "./fileManagerApi";
import { useRemoteFileUpload } from "./useRemoteFileUpload";
import TerminalDialog from "./TerminalDialog";
import TerminalUploadProgress from "./TerminalUploadProgress";

interface RemoteFileTreeProps {
  uuid: string;
  rootPath: string;
  activePath?: string;
  refreshToken?: number;
  revealPath?: string | null;
  onOpenFile: (file: RemoteFileInfo) => void;
  onDeleteFiles?: (files: RemoteFileInfo[]) => void;
  onFileRenamed?: (source: string, destination: string) => void;
  onChanged?: () => void;
}

type TreeAction = "permissions";

type CreatingEntry = {
  kind: "file" | "folder";
  parentPath: string;
  name: string;
};

type ClipboardState = {
  paths: string[];
  cut: boolean;
} | null;

type DragTarget =
  | { kind: "root" }
  | { kind: "directory"; path: string }
  | { kind: "file"; path: string };

const isWithinRemoteDirectory = (path: string, directory: string) => {
  const source = normalizeRemotePath(path).replace(/\/$/, "");
  const target = normalizeRemotePath(directory).replace(/\/$/, "");
  if (source.toLowerCase() === target.toLowerCase()) return false;
  return source.toLowerCase().startsWith(`${target}/`.toLowerCase());
};

const isInvalidMoveDestination = (source: string, destination: string) => {
  const normalizedSource = normalizeRemotePath(source).replace(/\/$/, "");
  const normalizedDestination = normalizeRemotePath(destination).replace(/\/$/, "");
  return normalizedSource.toLowerCase() === normalizedDestination.toLowerCase()
    || isWithinRemoteDirectory(destination, source);
};

const encodeRemoteDragPaths = (paths: string[]) =>
  `komari-remote-paths:${JSON.stringify(paths)}`;

const decodeRemoteDragPaths = (value: string): string[] | null => {
  if (!value.startsWith("komari-remote-paths:")) return null;
  try {
    const paths = JSON.parse(value.slice("komari-remote-paths:".length));
    return Array.isArray(paths) ? paths.filter((path): path is string => typeof path === "string") : null;
  } catch {
    return null;
  }
};

const TreeFileIcon = ({ file, expanded }: { file: RemoteFileInfo; expanded: boolean }) => {
  if (file.is_dir) {
    return expanded ? (
      <FolderOpen size={15} className="shrink-0 text-[#dcb67a]" />
    ) : (
      <Folder size={15} className="shrink-0 text-[#dcb67a]" />
    );
  }
  return <FileCode2 size={14} className="shrink-0 text-[#8da9c4]" />;
};

const findTreeFile = (
  rootPath: string,
  path: string,
  children: Record<string, RemoteFileInfo[]>,
): RemoteFileInfo | null => {
  if (path === rootPath) return null;
  const parent = remoteDirname(path);
  return children[parent]?.find((item) => item.path === path) ?? null;
};

export const RemoteFileTree = ({
  uuid,
  rootPath,
  activePath,
  refreshToken = 0,
  revealPath,
  onOpenFile,
  onDeleteFiles,
  onFileRenamed,
  onChanged,
}: RemoteFileTreeProps) => {
  const { t } = useTranslation();
  const fileService = useRemoteFileService(uuid);
  const [children, setChildren] = useState<Record<string, RemoteFileInfo[]>>({});
  const childrenRef = useRef<Record<string, RemoteFileInfo[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [contextTarget, setContextTarget] = useState<RemoteFileInfo | null>(null);
  const selectedPathsRef = useRef<Set<string>>(new Set());
  const [, setSelectedPath] = useState<string | null>(null);
  const lastSelectedPathRef = useRef<string | null>(null);
  const internalDragPathsRef = useRef<string[] | null>(null);
  const [clipboardSource, setClipboardSource] = useState<ClipboardState>(null);
  const [marqueeRange, setMarqueeRange] = useState<{ top: number; bottom: number } | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [internalDrag, setInternalDrag] = useState<string[] | null>(null);
  const [action, setAction] = useState<TreeAction | null>(null);
  const [actionFile, setActionFile] = useState<RemoteFileInfo | null>(null);
  const [creatingEntry, setCreatingEntry] = useState<CreatingEntry | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [modeValue, setModeValue] = useState("0755");
  const [ownerValue, setOwnerValue] = useState("");
  const [groupValue, setGroupValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef(rootPath);
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const marqueeStartRef = useRef<number | null>(null);
  const marqueeActiveRef = useRef(false);
  const { contextMenuPosition, contextMenuOpen, openContextMenu, closeContextMenu } = useContextMenu();

  const loadDirectory = useCallback(
    async (path: string, force = false) => {
      if (!force && childrenRef.current[path]) {
        return;
      }
      setLoading((current) => new Set(current).add(path));
      try {
        // "/" is the virtual root on Windows; listing it returns mounted drives.
        const items = await fileService.list(path);
        const resolvedItems = sortRemoteFiles(items);
        setChildren((current) => {
          const next = { ...current, [path]: resolvedItems };
          childrenRef.current = next;
          return next;
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load directory");
      } finally {
        setLoading((current) => {
          const next = new Set(current);
          next.delete(path);
          return next;
        });
      }
    },
    [fileService],
  );

  const { uploadProgress, uploadFiles, uploadBlob, cancelUpload } = useRemoteFileUpload(
    uuid,
    useCallback(
      (destination: string) => {
        void loadDirectory(destination, true);
        onChanged?.();
      },
      [loadDirectory, onChanged],
    ),
  );

  useEffect(() => {
    setChildren({});
    childrenRef.current = {};
    setExpanded(new Set([rootPath]));
    if (rootPath) {
      void loadDirectory(rootPath, true);
    }
  }, [loadDirectory, refreshToken, rootPath]);


  useEffect(() => {
    if (!rootPath || !revealPath) return;
    const ancestors = remoteAncestors(revealPath).filter((path) => path !== rootPath && path !== revealPath);
    if (ancestors.length === 0) return;
    setExpanded((current) => {
      const next = new Set(current);
      ancestors.forEach((path) => next.add(path));
      next.add(revealPath);
      return next;
    });
    ancestors.forEach((path) => void loadDirectory(path));
  }, [loadDirectory, refreshToken, revealPath, rootPath]);

  const setSelectedOnly = useCallback((file: RemoteFileInfo) => {
    selectedPathsRef.current = new Set([file.path]);
    setSelectedPath(file.path);
    lastSelectedPathRef.current = file.path;
  }, []);

  const updateMarqueeSelection = useCallback((clientY: number) => {
    const container = treeScrollRef.current;
    if (!container || marqueeStartRef.current === null) return;
    if (Math.abs(clientY - (marqueeStartRef.current + container.getBoundingClientRect().top - container.scrollTop)) < 3) return;
    marqueeActiveRef.current = true;
    const rect = container.getBoundingClientRect();
    const currentY = clientY - rect.top + container.scrollTop;
    const startY = marqueeStartRef.current;
    const next = new Set<string>();
    container.querySelectorAll<HTMLElement>("[data-tree-path]").forEach((element) => {
      const rowRect = element.getBoundingClientRect();
      const rowTop = rowRect.top - rect.top + container.scrollTop;
      const rowBottom = rowTop + rowRect.height;
      if (rowBottom >= Math.min(startY, currentY) && rowTop <= Math.max(startY, currentY)) {
        const path = element.dataset.treePath;
        if (path && path !== rootPath) next.add(path);
      }
    });
    selectedPathsRef.current = next;
    setSelectedPath(next.size ? String(next.values().next().value) : null);
    setMarqueeRange({ top: Math.min(startY, currentY), bottom: Math.max(startY, currentY) });
  }, [rootPath]);

  const startMarqueeSelection = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-tree-path],[data-tree-spacer]")) return;
    const container = treeScrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    marqueeStartRef.current = event.clientY - rect.top + container.scrollTop;
    marqueeActiveRef.current = false;
    setMarqueeRange(null);
    const handleMove = (moveEvent: MouseEvent) => updateMarqueeSelection(moveEvent.clientY);
    const handleUp = () => {
      marqueeStartRef.current = null;
      marqueeActiveRef.current = false;
      setMarqueeRange(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [updateMarqueeSelection]);

  const handleSelect = useCallback((file: RemoteFileInfo, event: ReactMouseEvent<HTMLElement>) => {
    const orderedPaths = Array.from(treeScrollRef.current?.querySelectorAll<HTMLElement>("[data-tree-path]") ?? [])
      .map((element) => element.dataset.treePath)
      .filter((path): path is string => Boolean(path) && path !== rootPath);
    const index = orderedPaths.indexOf(file.path);
    const toggle = event.ctrlKey || event.metaKey;
    if (event.shiftKey && lastSelectedPathRef.current) {
      const anchorIndex = orderedPaths.indexOf(lastSelectedPathRef.current);
      if (index >= 0 && anchorIndex >= 0) {
        const [start, end] = index < anchorIndex ? [index, anchorIndex] : [anchorIndex, index];
        const next = new Set(toggle ? selectedPathsRef.current : []);
        for (let pathIndex = start; pathIndex <= end; pathIndex++) {
          next.add(orderedPaths[pathIndex]);
        }
        selectedPathsRef.current = next;
        setSelectedPath(file.path);
        return;
      }
    }
    if (toggle) {
      const next = new Set(selectedPathsRef.current);
      if (!next.delete(file.path)) next.add(file.path);
      selectedPathsRef.current = next;
      setSelectedPath(next.size ? file.path : null);
      lastSelectedPathRef.current = file.path;
      return;
    }
    setSelectedOnly(file);
  }, [rootPath, setSelectedOnly]);

  const toggleDirectory = useCallback(
    (path: string) => {
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          void loadDirectory(path);
        }
        return next;
      });
    },
    [loadDirectory],
  );

  const root = useMemo<RemoteFileInfo>(
    () => ({
      name: remoteBasename(rootPath),
      path: rootPath,
      is_dir: true,
      is_symlink: false,
      size: 0,
      mode: "",
      mode_octal: "",
      uid: -1,
      gid: -1,
      owner: "",
      group: "",
      modified_at: "",
    }),
    [rootPath],
  );

  const downloadFile = useCallback(
    (file: RemoteFileInfo) => {
      if (!uuid || file.is_dir) return;
      const anchor = document.createElement("a");
      anchor.href = fileDownloadUrl(uuid, file.path);
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
    [uuid],
  );

  const openUpload = useCallback((destination: string) => {
    uploadTargetRef.current = destination;
    uploadInputRef.current?.click();
  }, []);

  const beginAction = useCallback(
    (nextAction: TreeAction, file: RemoteFileInfo | null) => {
      setAction(nextAction);
      setActionFile(file);
      if (nextAction === "permissions" && file) {
        setModeValue(file.mode_octal || "0755");
        setOwnerValue(file.owner || (file.uid >= 0 ? String(file.uid) : ""));
        setGroupValue(file.group || (file.gid >= 0 ? String(file.gid) : ""));
      }
      closeContextMenu();
    },
    [closeContextMenu],
  );

  const pasteInto = useCallback(
    async (destination: string) => {
      if (!uuid || !clipboardSource) return;
      setSubmitting(true);
      try {
        for (const source of clipboardSource.paths) {
          const target = joinRemotePath(destination, remoteBasename(source));
          if (target.toLowerCase() === source.toLowerCase()) continue;
          if (clipboardSource.cut) {
            await fileService.move(source, target);
            onFileRenamed?.(source, target);
          } else {
            await fileService.copy(source, target);
          }
        }
        setClipboardSource(null);
        await loadDirectory(destination, true);
        for (const source of clipboardSource.paths) {
          const sourceParent = remoteDirname(source);
          if (sourceParent !== destination) {
            await loadDirectory(sourceParent, true);
          }
        }
        toast.success(t("file_manager.action_success", "File operation completed"));
        onChanged?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      } finally {
        setSubmitting(false);
      }
    },
    [clipboardSource, fileService, loadDirectory, onChanged, onFileRenamed, t, uuid],
  );

  const startCreate = useCallback((kind: "file" | "folder", parentPath: string) => {
    setAction(null);
    setActionFile(null);
    setCreatingEntry({ kind, parentPath, name: "" });
    if (parentPath !== rootPath && parentPath !== "/") {
      setExpanded((current) => new Set(current).add(parentPath));
      void loadDirectory(parentPath);
    }
  }, [loadDirectory, rootPath]);

  const submitCreate = useCallback(async () => {
    const entry = creatingEntry;
    const name = entry?.name.trim();
    setCreatingEntry(null);
    if (!uuid || !entry || !name) return;
    const path = joinRemotePath(entry.parentPath, name);
    setSubmitting(true);
    try {
      if (entry.kind === "file") {
        if (!(await uploadBlob(new Blob(), path, { silent: true }))) {
          throw new Error(t("file_manager.upload_failed", "Upload failed"));
        }
      } else {
        await fileService.mkdir(path);
      }
      await loadDirectory(entry.parentPath, true);
      toast.success(t("file_manager.action_success", "File operation completed"));
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      await loadDirectory(entry.parentPath, true);
    } finally {
      setSubmitting(false);
    }
  }, [creatingEntry, fileService, loadDirectory, onChanged, t, uploadBlob, uuid]);

  const cancelCreate = useCallback(() => {
    setCreatingEntry(null);
  }, []);

  const copySelectedPaths = useCallback(async (files: RemoteFileInfo[]) => {
    const copied = await copyTextToClipboard(files.map((file) => formatClipboardPath(file.path)).join("\n"));
    if (copied) {
      toast.success(t("file_manager.copy_path_success", "Path copied"));
    } else {
      toast.error(t("file_manager.copy_path_failed", "Could not copy path"));
    }
  }, [t]);

  const runAction = useCallback(async () => {
    if (!uuid || !action) return;
    setSubmitting(true);
    try {
      if (action === "permissions" && actionFile) {
        if (modeValue.trim()) {
          await fileService.chmod(actionFile.path, modeValue.trim());
        }
        if (ownerValue.trim() || groupValue.trim()) {
          await fileService.chown(actionFile.path, ownerValue.trim(), groupValue.trim());
        }
        await loadDirectory(remoteDirname(actionFile.path), true);
      }
      toast.success(t("file_manager.action_success", "File operation completed"));
      setAction(null);
      setActionFile(null);
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
    } finally {
      setSubmitting(false);
    }
  }, [
    action,
    actionFile,
    fileService,
    groupValue,
    loadDirectory,
    modeValue,
    onChanged,
    ownerValue,
    t,
    uuid,
  ]);

  const buildContextMenuItems = useCallback(
    (file: RemoteFileInfo | null): ContextMenuItemConfig[] => {
      if (!file || file.path === rootPath) {
        return [
          { key: "new-file", label: t("file_manager.new_file", "New File"), icon: <FilePlus2 size={14} />, onSelect: () => startCreate("file", rootPath) },
          { key: "new-folder", label: t("file_manager.new_folder", "New Folder"), icon: <FolderPlus size={14} />, onSelect: () => startCreate("folder", rootPath) },
          { key: "upload", label: t("file_manager.upload", "Upload"), icon: <Upload size={14} />, onSelect: () => openUpload(rootPath) },
          { key: "paste", label: clipboardSource ? (clipboardSource.cut ? t("file_manager.move_here", "Move here") : t("file_manager.copy_here", "Copy here")) : t("file_manager.paste", "Paste"), icon: <FolderInput size={14} />, disabled: !clipboardSource, onSelect: () => void pasteInto(rootPath) },
          { key: "refresh", label: t("common.refresh", "Refresh"), icon: <RefreshCw size={14} />, separatorBefore: true, onSelect: () => void loadDirectory(rootPath, true) },
        ];
      }

      const items: ContextMenuItemConfig[] = file.is_dir
        ? [
            { key: "open-folder", label: t("file_manager.open", "Open"), icon: <FolderOpen size={14} />, onSelect: () => toggleDirectory(file.path) },
            { key: "new-file", label: t("file_manager.new_file", "New File"), icon: <FilePlus2 size={14} />, onSelect: () => startCreate("file", file.path) },
            { key: "new-folder", label: t("file_manager.new_folder", "New Folder"), icon: <FolderPlus size={14} />, onSelect: () => startCreate("folder", file.path) },
            { key: "upload", label: t("file_manager.upload", "Upload"), icon: <Upload size={14} />, onSelect: () => openUpload(file.path) },
            {
              key: "refresh-directory",
              label: t("common.refresh", "Refresh"),
              icon: <RefreshCw size={14} />,
              separatorBefore: true,
              onSelect: () => void loadDirectory(file.path, true),
            },
          ]
        : [
            { key: "open-editor", label: t("file_manager.open_in_editor", "Open in editor"), icon: <FileCode2 size={14} />, onSelect: () => onOpenFile(file) },
            { key: "download", label: t("file_manager.download", "Download"), icon: <Download size={14} />, onSelect: () => downloadFile(file) },
            { key: "upload", label: t("file_manager.upload", "Upload"), icon: <Upload size={14} />, onSelect: () => openUpload(remoteDirname(file.path)) },
          ];

      items.push(
        { key: "copy", label: t("file_manager.copy", "Copy"), icon: <ClipboardCopy size={14} />, separatorBefore: true, onSelect: () => setClipboardSource({ paths: [file.path], cut: false }) },
        { key: "copy-path", label: t("file_manager.copy_path", "Copy path"), icon: <Copy size={14} />, onSelect: () => void copySelectedPaths([file]) },
        { key: "cut", label: t("file_manager.cut", "Cut"), icon: <Scissors size={14} />, onSelect: () => setClipboardSource({ paths: [file.path], cut: true }) },
        { key: "paste", label: clipboardSource ? (clipboardSource.cut ? t("file_manager.move_here", "Move here") : t("file_manager.copy_here", "Copy here")) : t("file_manager.paste", "Paste"), icon: <FolderInput size={14} />, disabled: !clipboardSource || !file.is_dir, onSelect: () => void pasteInto(file.path) },
        { key: "rename", label: t("file_manager.rename", "Rename"), icon: <Pencil size={14} />, separatorBefore: true, onSelect: () => {
          setRenamingPath(file.path);
          setRenameValue(file.name);
        } },
        { key: "permissions", label: t("file_manager.permissions", "Permissions"), icon: <KeyRound size={14} />, onSelect: () => beginAction("permissions", file) },
        { key: "delete", label: t("file_manager.delete", "Delete"), icon: <Trash2 size={14} />, destructive: true, separatorBefore: true, onSelect: () => onDeleteFiles?.([file]) },
      );
      return items;
    },
    [beginAction, clipboardSource, copySelectedPaths, downloadFile, loadDirectory, onOpenFile, onDeleteFiles, openUpload, pasteInto, rootPath, startCreate, t, toggleDirectory],
  );

  const resolveActiveSelection = useCallback((file: RemoteFileInfo): RemoteFileInfo[] => {
    if (!selectedPathsRef.current.has(file.path)) return [file];
    const selected = Array.from(selectedPathsRef.current)
      .map((path) => findTreeFile(rootPath, path, children))
      .filter((item): item is RemoteFileInfo => Boolean(item));
    return selected.length > 0 ? selected : [file];
  }, [children, rootPath]);

  const moveSelectedPaths = useCallback(async (sourcePaths: string[], destination: string) => {
    const movedPaths = sourcePaths.filter((source) => {
      const targetPath = joinRemotePath(destination, remoteBasename(source));
      return targetPath !== source && !isInvalidMoveDestination(source, destination);
    });
    if (movedPaths.length === 0) {
      setInternalDrag(null);
      setDragTarget(null);
      internalDragPathsRef.current = null;
      return;
    }

    setSubmitting(true);
    try {
      const sourceParents = new Set<string>();
      for (const source of movedPaths) {
        const targetPath = joinRemotePath(destination, remoteBasename(source));
        await fileService.move(source, targetPath);
        sourceParents.add(remoteDirname(source));
        onFileRenamed?.(source, targetPath);
      }
      if (clipboardSource?.cut) {
        const remaining = clipboardSource.paths.filter((source) => !movedPaths.includes(source));
        setClipboardSource(remaining.length > 0 ? { ...clipboardSource, paths: remaining } : null);
      }
      await loadDirectory(destination, true);
      await Promise.all(Array.from(sourceParents).map((parent) => loadDirectory(parent, true)));
      selectedPathsRef.current = new Set();
      setSelectedPath(null);
      toast.success(t("file_manager.action_success", "File operation completed"));
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      await loadDirectory(destination, true);
    } finally {
      setSubmitting(false);
      setInternalDrag(null);
      setDragTarget(null);
    }
    internalDragPathsRef.current = null;
  }, [clipboardSource, fileService, loadDirectory, onChanged, onFileRenamed, t]);

  const buildMultipleTreeMenuItems = useCallback((activeSelection: RemoteFileInfo[]): ContextMenuItemConfig[] => {
    if (activeSelection.length <= 1) return [];
    return [
      { key: "download", label: `${t("file_manager.download", "Download")} (${activeSelection.filter((item) => !item.is_dir).length})`, icon: <Download size={14} />, disabled: !activeSelection.some((item) => !item.is_dir), onSelect: () => activeSelection.filter((item) => !item.is_dir).forEach((item, index) => window.setTimeout(() => downloadFile(item), index * 180)) },
      { key: "copy", label: `${t("file_manager.copy", "Copy")} (${activeSelection.length})`, icon: <ClipboardCopy size={14} />, separatorBefore: true, onSelect: () => setClipboardSource({ paths: activeSelection.map((item) => item.path), cut: false }) },
      { key: "cut", label: `${t("file_manager.cut", "Cut")} (${activeSelection.length})`, icon: <Scissors size={14} />, onSelect: () => setClipboardSource({ paths: activeSelection.map((item) => item.path), cut: true }) },
      { key: "delete", label: `${t("file_manager.delete", "Delete")} (${activeSelection.length})`, icon: <Trash2 size={14} />, destructive: true, separatorBefore: true, onSelect: () => onDeleteFiles?.(activeSelection) },
    ];
  }, [downloadFile, onDeleteFiles, t]);

  const buildTreeContextMenuItems = useCallback(
    (file: RemoteFileInfo | null): ContextMenuItemConfig[] => {
      if (!file) return buildContextMenuItems(file);
      const multipleItems = buildMultipleTreeMenuItems(resolveActiveSelection(file));
      return multipleItems.length > 0 ? multipleItems : buildContextMenuItems(file);
    },
    [buildContextMenuItems, buildMultipleTreeMenuItems, resolveActiveSelection],
  );

  const handleDragOver = (event: ReactDragEvent<HTMLElement>, target: DragTarget) => {
    const isBrowserUpload = event.dataTransfer.types.includes("Files");
    const isInternalMove = internalDragPathsRef.current !== null
      || event.dataTransfer.types.includes("text/plain");
    if (!isBrowserUpload && !isInternalMove && !internalDrag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isBrowserUpload ? "copy" : "move";
    setDragTarget(target);
  };

  const handleDrop = async (event: ReactDragEvent<HTMLElement>, target: DragTarget) => {
    const draggedPaths = decodeRemoteDragPaths(event.dataTransfer.getData("text/plain"));
    const sourcePaths = draggedPaths ?? (internalDragPathsRef.current !== null ? internalDragPathsRef.current : null);
    if (sourcePaths?.length) {
      event.preventDefault();
      const destination =
        target.kind === "root"
          ? rootPath
          : target.kind === "file"
            ? remoteDirname(target.path)
            : target.path;
      await moveSelectedPaths(sourcePaths, destination);
      return;
    }
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    setDragTarget(null);
    closeContextMenu();
    const destination =
      target.kind === "root"
        ? rootPath
        : target.kind === "file"
          ? remoteDirname(target.path)
          : target.path;
    await uploadFiles(event.dataTransfer.files, destination);
  };

  const startInternalDrag = (file: RemoteFileInfo) => {
    const sourcePaths =
      selectedPathsRef.current.has(file.path)
        ? resolveActiveSelection(file).map((item) => item.path)
      : [file.path];
    internalDragPathsRef.current = sourcePaths;
    setInternalDrag(sourcePaths);
    return sourcePaths;
  };

  const renameSelected = useCallback(() => {
    if (selectedPathsRef.current.size !== 1) return;
    const selectedPath = String(selectedPathsRef.current.values().next().value);
    const selectedFile = findTreeFile(rootPath, selectedPath, children);
    if (!selectedFile) return;
    setRenamingPath(selectedPath);
    setRenameValue(selectedFile.name);
  }, [children, rootPath]);

  const submitInlineRename = useCallback(async () => {
    const file = findTreeFile(rootPath, renamingPath ?? "", children);
    const name = renameValue.trim();
    setRenamingPath(null);
    if (!uuid || !file || !name || name === file.name) return;
    setSubmitting(true);
    try {
      await fileService.move(file.path, joinRemotePath(remoteDirname(file.path), name));
      await loadDirectory(remoteDirname(file.path), true);
      onFileRenamed?.(file.path, joinRemotePath(remoteDirname(file.path), name));
      toast.success(t("file_manager.action_success", "File operation completed"));
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      await loadDirectory(remoteDirname(file.path), true);
    } finally {
      setSubmitting(false);
    }
  }, [children, fileService, loadDirectory, onChanged, onFileRenamed, renameValue, renamingPath, rootPath, t, uuid]);

  const cancelInlineRename = useCallback(() => {
    setRenamingPath(null);
    setRenameValue("");
  }, []);

  const renderNode = (file: RemoteFileInfo, depth: number, ancestors = new Set<string>()) => {
    const normalizedPath = normalizeRemotePath(file.path);
    const isExpanded = expanded.has(normalizedPath);
    const isLoading = loading.has(normalizedPath);
    const nested = isExpanded ? children[file.path] ?? [] : [];
    const isContextTarget = contextTarget?.path === file.path;
    const isDropTarget =
      (dragTarget?.kind === "directory" && dragTarget.path === file.path) ||
      (dragTarget?.kind === "file" && dragTarget.path === file.path);
    return (
      <div key={file.path}>
        <button
          type="button"
          data-tree-path={normalizedPath}
          draggable={!marqueeActiveRef.current && marqueeRange === null && renamingPath !== file.path}
          className={`my-0.5 flex h-6 w-full items-center gap-1 rounded-[4px] border-0 pr-1 text-left text-xs transition-colors ${
            activePath === file.path
              ? "bg-[#37373d] text-white"
              : selectedPathsRef.current.has(file.path)
                ? "bg-[#264f78] text-white"
              : isContextTarget
                ? "bg-[#2a2d2e] text-[#eeeeee]"
                : isDropTarget
                  ? "bg-[#20364a] text-[#eeeeee]"
                  : "bg-transparent text-[#cccccc] hover:bg-[#2a2d2e]"
          }`}
          style={{ paddingLeft: `${Math.max(4, depth * 12 + 4)}px` }}
          onDragStart={(event) => {
            if (marqueeStartRef.current !== null) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.effectAllowed = "move";
            const sourcePaths = startInternalDrag(file);
            event.dataTransfer.setData("text/plain", encodeRemoteDragPaths(sourcePaths));
          }}
          onDragEnd={() => {
            internalDragPathsRef.current = null;
            setInternalDrag(null);
            setDragTarget(null);
          }}
          onClick={(event) => {
            if (renamingPath === file.path) return;
            closeContextMenu();
            handleSelect(file, event);
            const plainClick = !event.ctrlKey && !event.metaKey && !event.shiftKey;
            if (plainClick && file.is_dir) toggleDirectory(file.path);
            if (plainClick && !file.is_dir) onOpenFile(file);
          }}
          onContextMenu={(event) => {
            event.stopPropagation();
            if (!selectedPathsRef.current.has(normalizedPath)) setSelectedOnly(file);
            setContextTarget(file);
            openContextMenu(event);
          }}
          onDragOver={(event) => {
            event.stopPropagation();
            const dropTarget = file.is_dir
              ? { kind: "directory" as const, path: file.path }
              : { kind: "file" as const, path: file.path };
            handleDragOver(event, dropTarget);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null);
          }}
          onDrop={(event) => {
            event.stopPropagation();
            if (file.is_dir) {
              void handleDrop(event, { kind: "directory", path: file.path });
            } else {
              void handleDrop(event, { kind: "file", path: file.path });
            }
          }}
          title={file.path}
        >
          {file.is_dir ? (
            <ChevronRight
              size={13}
              className={`shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          ) : (
            <span className="w-[13px] shrink-0" />
          )}
          <TreeFileIcon file={file} expanded={isExpanded} />
          {renamingPath === file.path ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={submitInlineRename}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitInlineRename();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelInlineRename();
                }
              }}
              className="h-5 min-w-0 flex-1 rounded-[4px] border border-[#007acc] bg-[#1e1e1e] px-1 text-xs text-[#eeeeee] outline-none"
            />
          ) : (
            <span className="min-w-0 whitespace-nowrap">
              {file.name}
              {file.is_symlink && file.target && (
                <span className="ml-1 text-[10px] text-[#6a9955]">
                  {`-> ${file.target}`}
                </span>
              )}
            </span>
          )}
          {file.is_symlink && (
            <Link2 size={11} className="ml-auto mr-1 shrink-0 text-[#6a9955]" />
          )}
          {isLoading && <RefreshCw size={11} className="ml-auto shrink-0 animate-spin" />}
        </button>
        {file.is_dir && isExpanded &&
          nested
            .filter((child) => !ancestors.has(normalizeRemotePath(child.path)))
            .map((child) => {
              const nextAncestors = new Set(ancestors);
              nextAncestors.add(normalizedPath);
              return renderNode(child, depth + 1, nextAncestors);
            })}
        {file.is_dir && isExpanded && creatingEntry?.parentPath === file.path && (
          <div
            data-tree-spacer=""
            className="my-0.5 flex h-6 items-center gap-1"
            style={{ paddingLeft: `${Math.max(4, (depth + 1) * 12 + 4)}px` }}
          >
            <span className="w-[13px] shrink-0" />
            {creatingEntry.kind === "folder"
              ? <Folder size={15} className="shrink-0 text-[#dcb67a]" />
              : <FileCode2 size={14} className="shrink-0 text-[#8da9c4]" />}
            <input
              autoFocus
              value={creatingEntry.name}
              onChange={(event) => setCreatingEntry({ ...creatingEntry, name: event.target.value })}
              onBlur={() => void submitCreate()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitCreate();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelCreate();
                }
              }}
              className="h-5 min-w-0 flex-1 rounded-[4px] border border-[#007acc] bg-[#1e1e1e] px-1 text-xs text-[#eeeeee] outline-none"
            />
          </div>
        )}
      </div>
    );
  };

  if (!rootPath) {
    return null;
  }

  const actionTitle =
    action === "permissions"
            ? t("file_manager.permissions", "Permissions")
            : t("file_manager.new_file", "New File");

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onClick={closeContextMenu}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "F2") {
          event.preventDefault();
          renameSelected();
        }
      }}
    >
      <div
        ref={treeScrollRef}
        className={`min-h-0 flex-1 select-none overflow-auto py-1 ${
          dragTarget?.kind === "root" ? "ring-1 ring-inset ring-[#55a7e0]" : ""
        }`}
        onDragOver={(event) => handleDragOver(event, { kind: "root" })}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null);
        }}
        onDrop={(event) => void handleDrop(event, { kind: "root" })}
        onMouseDown={startMarqueeSelection}
        onContextMenu={(event) => {
          setContextTarget(null);
          openContextMenu(event);
        }}
      >
        <div className="relative w-max min-w-full" style={{ width: "max-content", minWidth: "100%" }}>
          {renderNode(root, 0)}
          {marqueeRange && (
            <div
              aria-hidden
              className="pointer-events-none absolute z-10 border border-[#55a7e0] bg-[#55a7e0]/12"
              style={{
                left: 0,
                right: 0,
                top: `${marqueeRange.top - 4}px`,
                height: `${Math.max(1, marqueeRange.bottom - marqueeRange.top)}px`,
              }}
            />
          )}
        </div>
      </div>
      <input
		ref={uploadInputRef}
		type="file"
		className="hidden"
		multiple
		onChange={(event) => {
		  const files = Array.from(event.currentTarget.files ?? []);
		  event.currentTarget.value = "";
		  if (files.length) void uploadFiles(files, uploadTargetRef.current || rootPath);
		}}
	  />
      {uploadProgress && (
        <TerminalUploadProgress progress={uploadProgress} onCancel={cancelUpload} />
      )}

      <FileContextMenu
        open={contextMenuOpen}
        position={contextMenuPosition}
        items={buildTreeContextMenuItems(contextTarget)}
        onOpenChange={(open) => {
          if (!open) {
            closeContextMenu();
            setContextTarget(null);
          }
        }}
      />

      <TerminalDialog
        open={action !== null}
        title={actionTitle}
        description={actionFile ? `${t("file_manager.path", "Path")}: ${actionFile.path}` : undefined}
        fields={action === "permissions" ? [
          { key: "mode", label: t("file_manager.mode", "Mode"), value: modeValue, onChange: setModeValue },
          { key: "owner", label: t("file_manager.owner", "Owner"), value: ownerValue, onChange: setOwnerValue },
          { key: "group", label: t("file_manager.group", "Group"), value: groupValue, onChange: setGroupValue },
        ] : []}
        confirmLabel={t("common.confirm", "Confirm")}
        submitting={submitting}
        onSubmit={() => void runAction()}
        onCancel={() => {
          setAction(null);
          setActionFile(null);
        }}
      />
    </div>
  );
};

export default RemoteFileTree;
