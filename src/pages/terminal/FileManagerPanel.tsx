import { Checkbox, DropdownMenu } from "@radix-ui/themes";
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowUp,
  Copy,
  ClipboardCopy,
  Download,
  Ellipsis,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileMusic,
  FilePlus2,
  FileVideo,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HardDrive,
  KeyRound,
  Link2,
  Pencil,
  RefreshCw,
  Scissors,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  lazy,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useRemoteFileService } from "./useRemoteFileService";
import ConfirmDialog from "./ConfirmDialog";
import { FileContextMenu, useContextMenu, type ContextMenuItemConfig } from "./FileContextMenu";
import TerminalDialog from "./TerminalDialog";
import TerminalUploadProgress from "./TerminalUploadProgress";
import {
  formatFileDate,
  formatFileSize,
  formatClipboardPath,
  fileDownloadUrl,
  copyTextToClipboard,

  joinRemotePath,
  normalizeRemotePath,
  remoteBasename,
  remoteDirname,
  resolveSymlinkTargetPath,
  sortRemoteFiles,
  type RemoteFileInfo,
  type RemoteSearchMatch,
  type RemoteSearchResult,
} from "./fileManagerApi";
import { useRemoteFileUpload } from "./useRemoteFileUpload";

  const FileEditorDialog = lazy(() => import("./FileEditorDialog"));

interface FileManagerPanelProps {
  uuid: string | null;
}

type FileAction =
  | "rename"
  | "permissions";

type CreatingEntry = {
  kind: "file" | "folder";
  name: string;
};

type DragTarget =
  | { kind: "blank" }
  | { kind: "directory"; path: string };

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

type ClipboardState = {
  paths: string[];
  cut: boolean;
} | null;

const toolbarButton =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border-0 bg-transparent text-[#b8b8b8] transition-colors hover:bg-[#343434] hover:text-white disabled:cursor-default disabled:opacity-35";

const fileIcon = (file: RemoteFileInfo) => {
  if (file.is_dir) {
    return <Folder size={17} className="text-[#dcb67a]" />;
  }
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (["avif", "bmp", "gif", "heic", "heif", "ico", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"].includes(extension)) {
    return <FileImage size={17} className="text-[#b58ad7]" />;
  }
  if (["aac", "flac", "m4a", "mp3", "ogg", "wav"].includes(extension)) {
    return <FileMusic size={17} className="text-[#d19a66]" />;
  }
  if (["3gp", "avi", "flv", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "ts", "webm", "wmv"].includes(extension)) {
    return <FileVideo size={17} className="text-[#e06c75]" />;
  }
  if (["7z", "bz2", "gz", "rar", "tar", "tgz", "xz", "zip"].includes(extension)) {
    return <FileArchive size={17} className="text-[#c6b569]" />;
  }
  if (["c", "cc", "conf", "cpp", "css", "go", "h", "html", "ini", "java", "js", "json", "jsx", "lua", "md", "php", "ps1", "py", "rb", "rs", "sh", "sql", "toml", "ts", "tsx", "vue", "xml", "yaml", "yml"].includes(extension)) {
    return <FileCode2 size={17} className="text-[#6fa8dc]" />;
  }
  return <File size={17} className="text-[#a7a7a7]" />;
};

const FileManagerPanel = ({ uuid }: FileManagerPanelProps) => {
  const { t } = useTranslation();
  const fileService = useRemoteFileService(uuid ?? "");
  const [currentPath, setCurrentPath] = useState("");
  const [pathDraft, setPathDraft] = useState("");
  const [files, setFiles] = useState<RemoteFileInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selectedPathsRef = useRef<Set<string>>(new Set());
  const lastSelectedIndexRef = useRef(-1);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<FileAction | null>(null);
  const [actionFile, setActionFile] = useState<RemoteFileInfo | null>(null);
  const [pendingDeleteFiles, setPendingDeleteFiles] = useState<RemoteFileInfo[]>([]);
  const [creatingEntry, setCreatingEntry] = useState<CreatingEntry | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [modeValue, setModeValue] = useState("0755");
  const [ownerValue, setOwnerValue] = useState("");
  const [groupValue, setGroupValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchContent, setSearchContent] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<RemoteSearchResult | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFile, setEditorFile] = useState<RemoteFileInfo | null>(null);
  const [editorLine, setEditorLine] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const pathCacheRef = useRef<Map<string, string>>(new Map());
  const [contextTarget, setContextTarget] = useState<RemoteFileInfo | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [marqueeRange, setMarqueeRange] = useState<{ start: number; end: number } | null>(null);
  const marqueeActiveRef = useRef(false);
  const [internalDrag, setInternalDrag] = useState<string[] | null>(null);
  const internalDragPathsRef = useRef<string[] | null>(null);

  const { contextMenuPosition, contextMenuOpen, openContextMenu, closeContextMenu } = useContextMenu();
  const [clipboardSource, setClipboardSource] = useState<ClipboardState>(null);

  const requestVersionRef = useRef(0);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const marqueeStartRef = useRef<number | null>(null);

  const selectedFiles = files.filter((file) => selectedPathsRef.current.has(file.path));
  const selectedFile = selectedFiles.length === 1 ? selectedFiles[0] : null;

  const setSelectedOnly = useCallback((path: string | null) => {
    selectedPathsRef.current = new Set(path ? [path] : []);
    setSelectedPath(path);
    lastSelectedIndexRef.current = path ? files.findIndex((file) => file.path === path) : -1;
  }, [files]);

  const handleSelect = useCallback((file: RemoteFileInfo, event: ReactMouseEvent<HTMLDivElement>) => {
    const index = files.findIndex((item) => item.path === file.path);
    const toggle = event.ctrlKey || event.metaKey;
    if (event.shiftKey && selectedPath && lastSelectedIndexRef.current >= 0) {
      const [start, end] = index < lastSelectedIndexRef.current
        ? [index, lastSelectedIndexRef.current]
        : [lastSelectedIndexRef.current, index];
      const next = new Set(toggle ? selectedPathsRef.current : []);
      for (let i = start; i <= end; i++) next.add(files[i].path);
      selectedPathsRef.current = next;
      setSelectedPath(file.path);
      return;
    }
    if (toggle) {
      const next = new Set(selectedPathsRef.current);
      if (!next.delete(file.path)) next.add(file.path);
      selectedPathsRef.current = next;
      setSelectedPath(next.size ? file.path : null);
      lastSelectedIndexRef.current = index;
      return;
    }
    setSelectedOnly(file.path);
  }, [files, selectedPath, setSelectedOnly]);

  const updateMarqueeSelection = useCallback((clientY: number) => {
    const container = listRef.current;
    if (!container || marqueeStartRef.current === null) return;
    const rect = container.getBoundingClientRect();
    const currentY = clientY - rect.top + container.scrollTop;
    const startIndex = marqueeStartRef.current;
    if (Math.abs(currentY - startIndex) < 3) return;
    marqueeActiveRef.current = true;
    const endIndex = currentY;
    const next = new Set<string>();
    container.querySelectorAll<HTMLElement>("[data-file-path]").forEach((element) => {
      const rowRect = element.getBoundingClientRect();
      const rowTop = rowRect.top - rect.top + container.scrollTop;
      const rowBottom = rowTop + rowRect.height;
      if (rowBottom >= Math.min(startIndex, endIndex) && rowTop <= Math.max(startIndex, endIndex)) {
        const path = element.dataset.filePath;
        if (path) next.add(path);
      }
    });
    selectedPathsRef.current = next;
    setSelectedPath(next.size ? String(next.values().next().value) : null);
    setMarqueeRange({ start: Math.min(startIndex, endIndex), end: Math.max(startIndex, endIndex) });
  }, []);

  const startMarqueeSelection = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-file-path],[data-parent-entry]")) return;
    const container = listRef.current;
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

  const loadDirectory = useCallback(
    async (path: string) => {
      if (!uuid) return;
      const version = ++requestVersionRef.current;
      setLoading(true);
      let items: RemoteFileInfo[] = [];
      try {
        items = await fileService.list(path);
        if (requestVersionRef.current !== version) return;
        const normalized = normalizeRemotePath(path);
        setFiles(sortRemoteFiles(items));
        setCurrentPath(normalized);
        setPathDraft(normalized);
        if (uuid) pathCacheRef.current.set(uuid, normalized);
        selectedPathsRef.current = new Set();
        setSelectedPath(null);
        setSearchResult(null);
      } catch (error) {
        if (requestVersionRef.current === version) {
          toast.error(error instanceof Error ? error.message : t("file_manager.load_failed", "Failed to load directory"));
        }
      } finally {
        if (requestVersionRef.current === version) setLoading(false);
      }
    },
    [fileService, t, uuid],
  );
  useEffect(() => {
    requestVersionRef.current += 1;
    const cachedPath = uuid ? pathCacheRef.current.get(uuid) : null;
    if (cachedPath) {
      setCurrentPath(cachedPath);
      setPathDraft(cachedPath);
      setFiles([]);
      selectedPathsRef.current = new Set();
      setSelectedPath(null);
      setSearchResult(null);
      void loadDirectory(cachedPath);
      return;
    }
    setCurrentPath("");
    setPathDraft("");
    setFiles([]);
    selectedPathsRef.current = new Set();
    setSelectedPath(null);
    setSearchResult(null);
    void loadDirectory("/");
  }, [loadDirectory, uuid]);

  const refresh = useCallback(async () => {
    const targetPath = normalizeRemotePath(currentPath || "/");
    await loadDirectory(targetPath);
    setRefreshToken((value) => value + 1);
  }, [currentPath, loadDirectory]);

  const { uploadProgress, uploadFiles, uploadBlob, cancelUpload } = useRemoteFileUpload(
    uuid,
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const openFile = useCallback(async (file: RemoteFileInfo, line = 1, depth = 0) => {
    if (!uuid) return;
    if (depth > 4) return;
    if (file.is_symlink && file.target) {
      const targetPath = resolveSymlinkTargetPath(file);
      if (!targetPath) return;
      try {
        const target = await fileService.stat(targetPath);
        await openFile(target, line, depth + 1);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("file_manager.load_failed", "Failed to load file"));
      }
      return;
    }
    if (file.is_dir) {
      await loadDirectory(file.path);
      return;
    }
    setEditorFile(file);
    setEditorLine(line);
    setEditorOpen(true);
  }, [fileService, loadDirectory, t, uuid]);

  const beginAction = useCallback((nextAction: FileAction, explicitFile: RemoteFileInfo | null = selectedFile) => {
    setAction(nextAction);
    setActionFile(
      nextAction === "permissions" ? explicitFile : null,
    );
    if (nextAction === "permissions" && explicitFile) {
      setModeValue(explicitFile.mode_octal || "0755");
      setOwnerValue(explicitFile.owner || (explicitFile.uid >= 0 ? String(explicitFile.uid) : ""));
      setGroupValue(explicitFile.group || (explicitFile.gid >= 0 ? String(explicitFile.gid) : ""));
    }
  }, [selectedFile]);

  const beginClipboard = useCallback((filesToCopy: RemoteFileInfo[], cut: boolean) => {
    if (filesToCopy.length === 0) return;
    setClipboardSource({ paths: filesToCopy.map((file) => file.path), cut });
  }, []);

  const downloadFiles = useCallback((filesToDownload: RemoteFileInfo[]) => {
    filesToDownload
      .filter((file) => !file.is_dir)
      .forEach((file, index) => {
        window.setTimeout(() => downloadFile(file), index * 180);
      });
  }, [downloadFile]);

  const moveSelectedPaths = useCallback(async (sourcePaths: string[], destination: string) => {
    const movedPaths = sourcePaths.filter((source) => {
      const targetPath = joinRemotePath(destination, remoteBasename(source));
      return targetPath !== source && !isInvalidMoveDestination(source, destination);
    });
    if (movedPaths.length === 0) {
      setInternalDrag(null);
      setDragTarget(null);
      return;
    }

    setSubmitting(true);
    try {
      for (const source of movedPaths) {
        const targetPath = joinRemotePath(destination, remoteBasename(source));
        await fileService.move(source, targetPath);
      }
      if (clipboardSource?.cut) {
        const remaining = clipboardSource.paths.filter((source) => !movedPaths.includes(source));
        setClipboardSource(remaining.length > 0 ? { ...clipboardSource, paths: remaining } : null);
      }
      await refresh();
      selectedPathsRef.current = new Set();
      setSelectedPath(null);
      toast.success(t("file_manager.action_success", "File operation completed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      await refresh();
    } finally {
      setSubmitting(false);
      setInternalDrag(null);
      setDragTarget(null);
    }
    internalDragPathsRef.current = null;
  }, [clipboardSource, fileService, refresh, t]);

  const renameSelected = useCallback(() => {
    if (!selectedFile) return;
    setRenamingPath(selectedFile.path);
    setRenameValue(selectedFile.name);
  }, [selectedFile]);

  const submitInlineRename = useCallback(async () => {
    const file = files.find((item) => item.path === renamingPath);
    const name = renameValue.trim();
    setRenamingPath(null);
    if (!uuid || !file || !name || name === file.name) return;
    setSubmitting(true);
    try {
      await fileService.move(file.path, joinRemotePath(remoteDirname(file.path), name));
      await refresh();
      toast.success(t("file_manager.action_success", "File operation completed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }, [fileService, files, refresh, renameValue, renamingPath, t, uuid]);

  const cancelInlineRename = useCallback(() => {
    setRenamingPath(null);
    setRenameValue("");
  }, []);

  const pasteClipboard = useCallback(async () => {
    if (!uuid || !clipboardSource) return;
    setSubmitting(true);
    try {
      for (const source of clipboardSource.paths) {
        const target = joinRemotePath(currentPath, remoteBasename(source));
        if (target.toLowerCase() === source.toLowerCase()) continue;
        if (clipboardSource.cut) {
          await fileService.move(source, target);
        } else {
          await fileService.copy(source, target);
        }
      }
      if (clipboardSource.cut) setClipboardSource(null);
      await refresh();
      toast.success(t("file_manager.action_success", "File operation completed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }, [clipboardSource, currentPath, fileService, refresh, t, uuid]);

  const startCreate = useCallback((kind: "file" | "folder") => {
    setAction(null);
    setActionFile(null);
    setCreatingEntry({ kind, name: "" });
  }, []);

  const submitCreate = useCallback(async () => {
    const entry = creatingEntry;
    const name = entry?.name.trim();
    setCreatingEntry(null);
    if (!uuid || !entry || !name || !currentPath) return;
    const path = joinRemotePath(currentPath, name);
    setSubmitting(true);
    try {
      if (entry.kind === "file") {
        if (!(await uploadBlob(new Blob(), path, { silent: true }))) {
          throw new Error(t("file_manager.upload_failed", "Upload failed"));
        }
      } else {
        await fileService.mkdir(path);
      }
      await refresh();
      selectedPathsRef.current = new Set([path]);
      setSelectedPath(path);
      toast.success(t("file_manager.action_success", "File operation completed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }, [creatingEntry, currentPath, fileService, refresh, t, uploadBlob, uuid]);

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

  const buildContextMenuItems = useCallback(
    (file: RemoteFileInfo | null): ContextMenuItemConfig[] => {
      if (!file) {
        return [
          { key: "new-file", label: t("file_manager.new_file", "New File"), icon: <FilePlus2 size={14} />, onSelect: () => startCreate("file") },
          { key: "new-folder", label: t("file_manager.new_folder", "New Folder"), icon: <FolderPlus size={14} />, onSelect: () => startCreate("folder") },
          { key: "upload", label: t("file_manager.upload", "Upload"), icon: <Upload size={14} />, onSelect: () => uploadInputRef.current?.click() },
          { key: "paste", label: clipboardSource ? (clipboardSource.cut ? t("file_manager.move_here", "Move here") : t("file_manager.copy_here", "Copy here")) : t("file_manager.paste", "Paste"), icon: <ClipboardCopy size={14} />, disabled: !clipboardSource, onSelect: () => void pasteClipboard() },
          { key: "refresh", label: t("common.refresh", "Refresh"), icon: <RefreshCw size={14} />, separatorBefore: true, onSelect: () => void refresh() },
        ];
      }
      const activeSelection = selectedPathsRef.current.has(file.path)
        ? selectedFiles
        : [file];
      const multiple = activeSelection.length > 1;
      return [
        ...(file.is_dir
          ? [
              { key: "open-folder", label: t("file_manager.open", "Open"), icon: <FolderOpen size={14} />, onSelect: () => void loadDirectory(file.path) },
              { key: "refresh-directory", label: t("common.refresh", "Refresh"), icon: <RefreshCw size={14} />, separatorBefore: true, onSelect: () => void loadDirectory(file.path) },
            ]
          : [
              ...(multiple ? [] : [
                { key: "open-editor", label: t("file_manager.open_in_editor", "Open in editor"), icon: <FileCode2 size={14} />, onSelect: () => openFile(file) },
              ]),
              { key: "download", label: multiple ? `${t("file_manager.download", "Download")} (${activeSelection.filter((item) => !item.is_dir).length})` : t("file_manager.download", "Download"), icon: <Download size={14} />, disabled: !activeSelection.some((item) => !item.is_dir), onSelect: () => downloadFiles(activeSelection) },
            ]),
        { key: "copy", label: multiple ? `${t("file_manager.copy", "Copy")} (${activeSelection.length})` : t("file_manager.copy", "Copy"), icon: <ClipboardCopy size={14} />, separatorBefore: true, onSelect: () => beginClipboard(activeSelection, false) },
        { key: "copy-path", label: multiple ? t("file_manager.copy_paths", "Copy paths") : t("file_manager.copy_path", "Copy path"), icon: <Copy size={14} />, onSelect: () => void copySelectedPaths(activeSelection) },
        { key: "cut", label: multiple ? `${t("file_manager.cut", "Cut")} (${activeSelection.length})` : t("file_manager.cut", "Cut"), icon: <Scissors size={14} />, onSelect: () => beginClipboard(activeSelection, true) },
        ...(!file.is_dir ? [] : [
          { key: "paste", label: clipboardSource ? (clipboardSource.cut ? t("file_manager.move_here", "Move here") : t("file_manager.copy_here", "Copy here")) : t("file_manager.paste", "Paste"), icon: <FolderInput size={14} />, disabled: !clipboardSource, onSelect: () => void pasteClipboard() },
        ]),
        ...(multiple ? [] : [
          { key: "rename", label: t("file_manager.rename", "Rename"), icon: <Pencil size={14} />, separatorBefore: true, onSelect: () => {
            setRenamingPath(file.path);
            setRenameValue(file.name);
          } },
          { key: "permissions", label: t("file_manager.permissions", "Permissions"), icon: <KeyRound size={14} />, onSelect: () => beginAction("permissions", file) },
        ]),
        { key: "delete", label: multiple ? `${t("file_manager.delete", "Delete")} (${activeSelection.length})` : t("file_manager.delete", "Delete"), icon: <Trash2 size={14} />, destructive: true, separatorBefore: true, onSelect: () => setPendingDeleteFiles(activeSelection) },
      ];
    },
    [beginAction, beginClipboard, clipboardSource, copySelectedPaths, downloadFiles, loadDirectory, openFile, pasteClipboard, refresh, selectedFiles, startCreate, t]);

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
        await refresh();
      }
      toast.success(t("file_manager.action_success", "File operation completed"));
      setAction(null);
      setActionFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }, [
    action,
    actionFile,
    fileService,
    groupValue,
    modeValue,
    ownerValue,
    refresh,
    t,
    uuid,
  ]);

  const runPendingDelete = useCallback(async () => {
    if (!uuid || pendingDeleteFiles.length === 0) return;
    setSubmitting(true);
    try {
      await Promise.all(pendingDeleteFiles.map((file) => fileService.remove(file.path)));
      await refresh();
      toast.success(t("file_manager.action_success", "File operation completed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
      await refresh();
    } finally {
      setPendingDeleteFiles([]);
      setSubmitting(false);
    }
  }, [fileService, pendingDeleteFiles, refresh, t, uuid]);

  const runSearch = useCallback(async () => {
    if (!uuid || !searchQuery.trim()) {
      setSearchResult(null);
      return;
    }
    setSearching(true);
    try {
      const result = await fileService.search(currentPath, searchQuery.trim(), searchContent);
      setSearchResult(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.search_failed", "Search failed"));
    } finally {
      setSearching(false);
    }
  }, [currentPath, fileService, searchContent, searchQuery, t, uuid]);

  const openSearchMatch = useCallback(
    async (match: RemoteSearchMatch) => {
      if (!uuid) return;
      if (match.is_dir) {
        await loadDirectory(match.path);
        return;
      }
      try {
        const file = await fileService.stat(match.path);
        openFile(file, Math.max(match.line, 1));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("file_manager.load_failed", "Failed to load file"));
      }
    },
    [fileService, loadDirectory, openFile, t, uuid],
  );

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>, target: DragTarget) => {
    const isBrowserUpload = event.dataTransfer.types.includes("Files");
    const isInternalMove = internalDragPathsRef.current !== null
      || event.dataTransfer.types.includes("text/plain");
    if (!isBrowserUpload && !isInternalMove && !internalDrag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isBrowserUpload ? "copy" : "move";
    setDragTarget(target);
  };

  const handleDrop = async (event: ReactDragEvent<HTMLDivElement>, target: DragTarget) => {
    const draggedPaths = decodeRemoteDragPaths(event.dataTransfer.getData("text/plain"));
    const sourcePaths = draggedPaths ?? (internalDragPathsRef.current !== null ? internalDragPathsRef.current : null);
    if (sourcePaths?.length) {
      event.preventDefault();
      await moveSelectedPaths(sourcePaths, target.kind === "directory" ? target.path : currentPath);
      return;
    }
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    setDragTarget(null);
    closeContextMenu();
    await uploadFiles(event.dataTransfer.files, target.kind === "directory" ? target.path : currentPath);
  };

  const startInternalDrag = (file: RemoteFileInfo): string[] => {
    const sourcePaths =
      selectedPathsRef.current.has(file.path)
        ? selectedFiles.map((item) => item.path)
        : [file.path];
    internalDragPathsRef.current = sourcePaths;
    setInternalDrag(sourcePaths);
    return sourcePaths;
  };

  const clearInternalDrag = () => {
    internalDragPathsRef.current = null;
    setInternalDrag(null);
    setDragTarget(null);
  };

  const actionTitle =
    action === "rename"
          ? t("file_manager.rename", "Rename")
          : action === "permissions"
            ? t("file_manager.permissions", "Permissions")
            : t("file_manager.delete", "Delete");

  if (!uuid) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-[#777]">
        <HardDrive size={34} strokeWidth={1.25} />
        <span className="text-xs">{t("file_manager.no_server", "Open a terminal tab to browse its files")}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col bg-[#181818] text-[#cccccc] ${uploadProgress.length > 0 ? "select-none opacity-90" : ""}`}
      onClick={closeContextMenu}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "F2" && selectedFile) {
          event.preventDefault();
          renameSelected();
        }
      }}
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[#2b2b2b] px-1.5">
        <button
          type="button"
          onClick={() => void loadDirectory(remoteDirname(currentPath))}
          title={t("file_manager.parent", "Parent directory")}
          className={toolbarButton}
          disabled={!currentPath || currentPath === "/"}
        >
          <ArrowUp size={15} />
        </button>
        <input
          value={pathDraft}
          onChange={(event) => setPathDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && pathDraft.trim()) {
              void loadDirectory(pathDraft.trim());
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-[4px] border border-[#3c3c3c] bg-[#1e1e1e] px-2 text-xs text-neutral-100 placeholder-neutral-500 outline-none focus:border-[#007acc]"
          aria-label={t("file_manager.path", "Path")}
        />
        <button type="button" className={toolbarButton} onClick={() => void refresh()} title={t("common.refresh", "Refresh")}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-[#2b2b2b] px-1.5">
        <button type="button" className={toolbarButton} onClick={() => startCreate("file")} title={t("file_manager.new_file", "New File")}>
          <FilePlus2 size={15} />
        </button>
        <button type="button" className={toolbarButton} onClick={() => startCreate("folder")} title={t("file_manager.new_folder", "New Folder")}>
          <FolderPlus size={15} />
        </button>
        <button type="button" className={toolbarButton} onClick={() => uploadInputRef.current?.click()} title={t("file_manager.upload", "Upload")}>
          <Upload size={15} />
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={!selectedFile || selectedFile.is_dir}
          onClick={() => {
            if (selectedFile) downloadFile(selectedFile);
          }}
          title={t("file_manager.download", "Download")}
        >
          <Download size={15} />
        </button>
        <div className="mx-1 h-4 w-px bg-[#353535]" />
        <button type="button" className={toolbarButton} disabled={!selectedFile} onClick={renameSelected} title={t("file_manager.rename", "Rename")}>
          <Pencil size={14} />
        </button>
        <button type="button" className={toolbarButton} disabled={!selectedFile} onClick={() => beginAction("permissions")} title={t("file_manager.permissions", "Permissions")}>
          <KeyRound size={14} />
        </button>
        <button type="button" className={`${toolbarButton} hover:!text-[#f48771]`} disabled={!selectedFile} onClick={() => setPendingDeleteFiles(selectedFiles)} title={t("file_manager.delete", "Delete")}>
          <Trash2 size={14} />
        </button>
        <input
          ref={uploadInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length) void uploadFiles(files, currentPath);
          }}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-b border-[#2b2b2b] px-2 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#777]" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runSearch();
            }}
            placeholder={t("file_manager.search_placeholder", "Search files")}
            className="h-7 w-full rounded-[4px] border border-[#3c3c3c] bg-[#1e1e1e] pl-7 pr-7 text-xs text-neutral-100 outline-none focus:border-[#007acc]"
          />
          {(searchQuery || searchResult) && (
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-[#888] hover:text-white"
              onClick={() => {
                setSearchQuery("");
                setSearchResult(null);
              }}
              title={t("common.close", "Close")}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <label className="flex shrink-0 items-center gap-1 text-[10px] text-[#999]" title={t("file_manager.search_content", "Search file contents")}>
          <Checkbox size="1" checked={searchContent} onCheckedChange={(checked) => setSearchContent(checked === true)} />
          {t("file_manager.content", "Content")}
        </label>
        <button type="button" className={toolbarButton} onClick={() => void runSearch()} disabled={searching || !searchQuery.trim()} title={t("file_manager.search", "Search")}>
          <Search size={14} className={searching ? "animate-pulse" : ""} />
        </button>
      </div>

      <div
        ref={listRef}
        onDragOver={(event) => handleDragOver(event, { kind: "blank" })}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null); }}
        onDrop={(event) => { void handleDrop(event, { kind: "blank" }); }}
        className={dragTarget?.kind === "blank" ? "relative min-h-0 flex-1 overflow-auto ring-1 ring-inset ring-[#55a7e0]" : "relative min-h-0 flex-1 overflow-auto"}
        onMouseDown={startMarqueeSelection}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextTarget(null);
          openContextMenu(event);
        }}
      >
        {searchResult ? (
          <div className="py-1">
            <div className="px-3 py-1 text-[10px] uppercase text-[#777]">
              {t("file_manager.search_results", {
                count: searchResult.matches.length,
                defaultValue: `${searchResult.matches.length} results`,
              })}
              {searchResult.limited ? " +" : ""}
            </div>
            {searchResult.matches.map((match) => (
              <button
                type="button"
                key={`${match.path}:${match.line}`}
                className="flex w-full min-w-0 flex-col gap-0.5 border-0 bg-transparent px-3 py-2 text-left hover:bg-[#2a2d2e]"
                onClick={() => void openSearchMatch(match)}
                title={match.path}
              >
                <span className="w-full truncate text-xs text-[#d7d7d7]">{remoteBasename(match.path)}</span>
                <span className="w-full truncate text-[10px] text-[#777]">
                  {match.path}{match.line > 0 ? `:${match.line}` : ""}
                </span>
                {match.text && <span className="line-clamp-2 text-[10px] text-[#a6a6a6]">{match.text}</span>}
              </button>
            ))}
            {searchResult.matches.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-[#777]">{t("file_manager.no_results", "No results")}</div>
            )}
          </div>
        ) : (
          <div className="py-1">
            {creatingEntry && (
              <div
                data-create-entry=""
                className="my-0.5 flex h-11 min-w-0 items-center gap-2 rounded-[4px] bg-[#37373d] px-2"
              >
                <span className="shrink-0">
                  {creatingEntry.kind === "folder" ? <Folder size={17} className="text-[#dcb67a]" /> : <FilePlus2 size={17} className="text-[#a7a7a7]" />}
                </span>
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
                  className="h-6 min-w-0 flex-1 rounded-[4px] border border-[#007acc] bg-[#1e1e1e] px-1 text-xs text-[#eeeeee] outline-none"
                />
              </div>
            )}
            {currentPath && remoteDirname(currentPath) !== currentPath && (
              <div
                data-parent-entry=""
                className={`my-0.5 flex h-8 min-w-0 items-center gap-2 rounded-[4px] px-2 text-xs ${
                  dragTarget?.kind === "blank" && internalDrag ? "bg-[#20364a] text-[#eeeeee]" : "text-[#bbbbbb] hover:bg-[#2a2d2e]"
                }`}
                onClick={() => void loadDirectory(remoteDirname(currentPath))}
                onDragOver={(event) => {
                  const isInternalMove = internalDragPathsRef.current !== null
                    || event.dataTransfer.types.includes("text/plain");
                  if (!isInternalMove && !internalDrag) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "move";
                  setDragTarget({ kind: "blank" });
                }}
                onDrop={(event) => {
                  const draggedPaths = decodeRemoteDragPaths(event.dataTransfer.getData("text/plain"));
                  const sourcePaths = draggedPaths ?? (internalDragPathsRef.current !== null ? internalDragPathsRef.current : null);
                  if (!sourcePaths?.length) return;
                  event.preventDefault();
                  event.stopPropagation();
                  void moveSelectedPaths(sourcePaths, remoteDirname(currentPath));
                }}
                title={remoteDirname(currentPath)}
              >
                <ArrowUp size={15} className="shrink-0" />
                <span className="min-w-0 truncate">..</span>
              </div>
            )}
            {files.map((file) => {
              const selected = selectedPathsRef.current.has(file.path);
              return (
                <div
                  key={file.path}
                  data-file-path={file.path}
                  draggable={!marqueeActiveRef.current && marqueeRange === null && renamingPath !== file.path}
                  className={`group my-0.5 flex h-11 min-w-0 items-center gap-2 rounded-[4px] px-2 ${
                    selected ? "bg-[#37373d]" : dragTarget?.kind === "directory" && dragTarget.path === file.path ? "bg-[#20364a]" : "hover:bg-[#2a2d2e]"
                  }`}
                  onDragStart={(event) => {
                    if (marqueeStartRef.current !== null) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.effectAllowed = "move";
                    const sourcePaths = startInternalDrag(file);
                    event.dataTransfer.setData("text/plain", encodeRemoteDragPaths(sourcePaths));
                  }}
                  onDragOver={(event) => {
                    if (file.is_dir) {
                      event.stopPropagation();
                      handleDragOver(event, { kind: "directory", path: file.path });
                    }
                  }}
                  onDragEnd={() => {
                    clearInternalDrag();
                  }}
                  onDoubleClick={() => openFile(file)}
                  onClick={(event) => { handleSelect(file, event); closeContextMenu(); }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null); }}
                  onDrop={(event) => {
                    if (file.is_dir) {
                      event.stopPropagation();
                      void handleDrop(event, { kind: "directory", path: file.path });
                    } else if (internalDragPathsRef.current || event.dataTransfer.types.includes("text/plain")) {
                      event.preventDefault();
                    }
                  }}
                  onContextMenu={(event) => {
                    event.stopPropagation();
                    if (!selectedPathsRef.current.has(file.path)) setSelectedOnly(file.path);
                    setContextTarget(file);
                    openContextMenu(event);
                  }}
                  title={file.path}
                >
                  <span className="shrink-0">{fileIcon(file)}</span>
                  <div className="min-w-0 flex-1">
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
                      className="h-6 min-w-0 flex-1 rounded-[4px] border border-[#007acc] bg-[#1e1e1e] px-1 text-xs text-[#eeeeee] outline-none"
                    />
                  ) : (
                    <div className="flex min-w-0 items-center gap-1 truncate text-xs text-[#dddddd]">
                      <span className="min-w-0 truncate">{file.name}</span>
                      {file.is_symlink && file.target && (
                        <span className="shrink-0 text-[10px] text-[#6a9955]">
                          {`-> ${file.target}`}
                        </span>
                      )}
                    </div>
                  )}
                    <div className="flex min-w-0 gap-2 text-[10px] text-[#777]">
                      <span className="shrink-0">{file.is_dir ? file.mode_octal : formatFileSize(file.size)}</span>
                      <span className="shrink-0">{file.is_dir ? "" : file.mode_octal}</span>
                      <span className="min-w-0 truncate">{formatFileDate(file.modified_at)}</span>
                    </div>
                  </div>
                  {file.is_symlink && (
                    <Link2 size={12} className="shrink-0 text-[#6a9955]" />
                  )}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <button
                        type="button"
                        className={`${toolbarButton} opacity-0 group-hover:opacity-100 ${selected ? "opacity-100" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedOnly(file.path);
                        }}
                        title={t("common.more", "More")}
                      >
                        <Ellipsis size={15} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content size="1" color="gray" highContrast>
                      {!file.is_dir && (
                        <DropdownMenu.Item onSelect={() => openFile(file)}>
                          <FileCode2 size={14} /> {t("file_manager.open", "Open")}
                        </DropdownMenu.Item>
                      )}
                      {file.is_dir && (
                        <DropdownMenu.Item onSelect={() => void loadDirectory(file.path)}>
                          <Folder size={14} /> {t("file_manager.open", "Open")}
                        </DropdownMenu.Item>
                      )}
                      {!file.is_dir && (
                        <DropdownMenu.Item onSelect={() => downloadFile(file)}>
                          <Download size={14} /> {t("file_manager.download", "Download")}
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item onSelect={() => {
                        setRenamingPath(file.path);
                        setRenameValue(file.name);
                      }}>
                        <Pencil size={14} /> {t("file_manager.rename", "Rename")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={() => beginAction("permissions", file)}>
                        <KeyRound size={14} /> {t("file_manager.permissions", "Permissions")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item color="red" onSelect={() => setPendingDeleteFiles([file])}>
                        <Trash2 size={14} /> {t("file_manager.delete", "Delete")}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </div>
              );
            })}
            {!loading && files.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-[#777]">{t("file_manager.empty", "This directory is empty")}</div>
            )}
          </div>
        )}
        {marqueeRange && (
          <div
            className="pointer-events-none absolute left-0 z-10 border border-[#55a7e0] bg-[#55a7e0]/15"
            style={{
              top: `${marqueeRange.start}px`,
              height: `${Math.max(1, marqueeRange.end - marqueeRange.start)}px`,
              right: 0,
            }}
          />
        )}
      </div>

      {loading && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[#333]">
          <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] bg-[#007acc]" />
        </div>
      )}
      {uploadProgress.length > 0 && (
        <TerminalUploadProgress progress={uploadProgress} onCancel={cancelUpload} />
      )}

      <TerminalDialog
        open={action !== null}
        title={actionTitle}
        description={undefined}
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
      <ConfirmDialog
        open={pendingDeleteFiles.length > 0}
        title={t("file_manager.delete", "Delete")}
        description={pendingDeleteFiles.length > 1
          ? t("file_manager.confirm_delete_multiple", {
              count: pendingDeleteFiles.length,
              defaultValue: `Delete ${pendingDeleteFiles.length} items?`,
            })
          : t("file_manager.confirm_delete", {
              name: pendingDeleteFiles[0]?.name ?? "",
              defaultValue: `Delete ${pendingDeleteFiles[0]?.name ?? "this item"}?`,
            })}
        confirmLabel={t("common.delete", "Delete")}
        cancelLabel={t("common.cancel", "Cancel")}
        destructive
        submitting={submitting}
        onConfirm={() => void runPendingDelete()}
        onCancel={() => {
          setPendingDeleteFiles([]);
        }}
      />
      {editorOpen && (
        <FileEditorDialog
          open
          uuid={uuid}
          initialFile={editorFile}
          initialLine={editorLine}
          refreshToken={refreshToken}
          onOpenChange={setEditorOpen}
          onSaved={() => void refresh()}
          onChanged={() => void refresh()}
        />
      )}
      <FileContextMenu
        open={contextMenuOpen}
        position={contextMenuPosition}
        items={buildContextMenuItems(contextTarget)}
        onOpenChange={(open) => {
          if (!open) closeContextMenu();
        }}
      />
    </div>
  );
};

export default FileManagerPanel;
