import Editor, { type OnMount } from "@monaco-editor/react";
import { DropdownMenu } from "@radix-ui/themes";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Clipboard,
  Download,
  FileText,
  ListTree,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  RotateCcw,
  Save,
  SaveAll,
  Scissors,
  SquareStack,
  Check,
  Undo2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useRemoteFileService } from "./useRemoteFileService";
import { DEFAULT_FONT_FAMILY } from "@/hooks/useXtermjsSettings";
import EditorResourceMonitor from "./EditorResourceMonitor";
import EditorTerminalPanel from "./EditorTerminalPanel";
import TerminalDialog from "./TerminalDialog";
import {
  FileContextMenu,
  useContextMenu,
  type ContextMenuItemConfig,
} from "./FileContextMenu";
import RemoteFileTree from "./RemoteFileTree";
import ConfirmDialog from "./ConfirmDialog";
import { normalizeRemotePath } from "./fileManagerApi";
import { useRemoteFileUpload } from "./useRemoteFileUpload";
import type { ContextMenuPosition } from "./terminalTypes";
import {
  decodeRemoteTextBytes,
  detectRemoteTextEncoding,
  encodeRemoteTextBytes,
  copyTextToClipboard,
  fileDownloadUrl,
  formatClipboardPath,
  fetchOfficePreviewUrl,
  formatFileSize,
  languageFromPath,
  maxPreviewSizeForFile,
  previewKindForFile,
  remoteDirname,
  remoteBasename,
  REMOTE_TEXT_ENCODINGS,
  resolveSymlinkTargetPath,
  type FilePreviewKind,
  type RemoteFileInfo,
  type RemoteTextEncoding,
} from "./fileManagerApi";
import { monaco } from "./monacoSetup";

type DocumentKind = FilePreviewKind | "binary" | "too-large" | "error";

interface EditorDocument {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  language: string;
  contentType: string;
  encoding: RemoteTextEncoding;
  sourceBytes?: Uint8Array;
  kind: DocumentKind;
  size: number;
  loading?: boolean;
  errorMessage?: string;
}

interface OutlineItem {
  label: string;
  detail: string;
  line: number;
  level: number;
}

interface FileEditorDialogProps {
  open: boolean;
  uuid: string;
  initialFile: RemoteFileInfo | null;
  initialLine?: number;
  refreshToken?: number;
  fontFamily?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  onChanged?: () => void;
}

interface OutlineNode {
  item: OutlineItem;
  key: string;
  children: OutlineNode[];
}

interface PendingTreeDelete {
  files: RemoteFileInfo[];
}

type PendingClose =
  | { kind: "dialog" }
  | { kind: "tab"; path: string }
  | { kind: "tabs"; paths: string[] }
  | null;

interface PendingEncodingReopen {
  path: string;
  encoding: RemoteTextEncoding;
}

const editorIconButton =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center border-0 bg-transparent text-[#bdbdbd] transition-colors hover:bg-[#3a3d41] hover:text-white disabled:opacity-40";

const MIN_DOCK_WIDTH = 180;
const MAX_DOCK_WIDTH = 560;
const MIN_EDITOR_WIDTH = 420;

const supportedLanguages = [
  "plaintext",
  "shell",
  "powershell",
  "javascript",
  "typescript",
  "json",
  "html",
  "css",
  "markdown",
  "go",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "php",
  "ruby",
  "rust",
  "sql",
  "yaml",
  "xml",
];

interface EditorTabItemProps {
  document: EditorDocument;
  active: boolean;
  onActivate: (path: string) => void;
  onRequestClose: (path: string) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>, path: string) => void;
}

const EditorTabItem = ({
  document,
  active,
  onActivate,
  onRequestClose,
  onContextMenu,
}: EditorTabItemProps) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: document.path,
  });
  const dirty = document.content !== document.savedContent;
  const loading = document.loading === true;
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : active ? 3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex h-9 min-w-[120px] max-w-[240px] shrink-0 cursor-pointer items-center gap-2 border-r border-[#2b2b2b] px-3 text-xs ${
        active
          ? "border-t border-t-[#55a7e0] bg-[#1e1e1e] text-white"
          : "bg-[#181818] text-[#969696] hover:bg-[#202020]"
      }`}
      {...attributes}
      {...listeners}
      onClick={() => onActivate(document.path)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event, document.path);
      }}
      title={document.path}
    >
      {loading ? (
        <RotateCcw size={14} className="shrink-0 animate-spin text-[#8da9c4]" />
      ) : document.kind === "error" ? (
        <Braces size={14} className="shrink-0 text-[#f48771]" />
      ) : document.kind === "too-large" ? (
        <Braces size={14} className="shrink-0 text-[#d19a66]" />
      ) : document.kind === "binary" ? (
        <FileText size={14} className="shrink-0 text-[#d19a66]" />
      ) : (
        <FileText size={14} className="shrink-0 text-[#8da9c4]" />
      )}
      <span className="min-w-0 flex-1 truncate">{document.name}</span>
      <button
        type="button"
        className="flex h-5 w-5 shrink-0 items-center justify-center hover:bg-[#3a3d41]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRequestClose(document.path);
        }}
        title={t("file_manager.editor.close_file", "Close File")}
      >
        {dirty ? <span className="h-2 w-2 rounded-full bg-[#d7d7d7]" /> : <X size={13} />}
      </button>
    </div>
  );
};

type DockSide = "left" | "right";

const buildOutline = (content: string, language: string): OutlineItem[] => {
  const items: OutlineItem[] = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length && items.length < 300; index += 1) {
    const line = lines[index];
    let match: RegExpMatchArray | null = null;
    let detail = "symbol";
    let level = 0;
    const indent = line.match(/^\s*/)?.[0] ?? "";
    if (language === "markdown") {
      match = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*$/);
      if (match) {
        level = match[1].length - 1;
        items.push({ label: match[2], detail: "heading", line: index + 1, level });
        continue;
      }
    }
    if (language === "go") {
      match = line.match(/^\s*(?:func|type)\s+(?:\([^)]*\)\s*)?([A-Za-z_$][\w$]*)/);
      detail = line.trimStart().startsWith("type") ? "type" : "function";
    } else if (language === "python") {
      match = line.match(/^\s*(?:async\s+)?(def|class)\s+([A-Za-z_$][\w$]*)/);
      detail = match?.[1] === "class" ? "class" : "function";
    } else if (["javascript", "typescript"].includes(language)) {
      match = line.match(
        /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)|^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
      );
      detail = line.includes("class ") ? "class" : "symbol";
    } else if (["c", "cpp", "csharp", "java", "php", "rust"].includes(language)) {
      match = line.match(/^\s*(?:pub\s+|public\s+|private\s+|protected\s+|static\s+|async\s+)*(?:class|struct|enum|interface|fn|function|[\w:<>,[\]*&?]+)\s+([A-Za-z_$][\w$]*)\s*(?:\(|\{|<)/);
      detail = /\b(class|struct|enum|interface)\b/.test(line) ? "type" : "function";
    }
    if (match) {
      const label = match[2] ?? match[1];
      if (label && !["if", "for", "while", "switch", "catch"].includes(label)) {
        level = Math.min(6, Math.floor(indent.replace(/\t/g, "    ").length / 2));
        items.push({ label, detail, line: index + 1, level });
      }
    }
  }
  return items;
};

const buildOutlineTree = (items: OutlineItem[]): OutlineNode[] => {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  items.forEach((item, index) => {
    const node: OutlineNode = {
      item,
      key: `${index}-${item.line}-${item.label}`,
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1].item.level >= item.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  });

  return roots;
};

const FileEditorDialog = ({
  open,
  uuid,
  initialFile,
  initialLine = 1,
  refreshToken = 0,
  fontFamily = DEFAULT_FONT_FAMILY,
  onOpenChange,
  onSaved,
  onChanged,
}: FileEditorDialogProps) => {
  const { t } = useTranslation();
  const fileService = useRemoteFileService(uuid);
  const { uploadBlob: uploadEditorBlob } = useRemoteFileUpload(uuid, () => undefined, { silent: true });
  const [documents, setDocuments] = useState<EditorDocument[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<PendingClose>(null);
  const [pendingEncodingReopen, setPendingEncodingReopen] = useState<PendingEncodingReopen | null>(null);
  const [pendingTreeDelete, setPendingTreeDelete] = useState<PendingTreeDelete | null>(null);
  const [savingPaths, setSavingPaths] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const [showExplorer, setShowExplorer] = useState(true);
  const [showOutline, setShowOutline] = useState(true);
  const [outlineCollapsed, setOutlineCollapsed] = useState<Set<string>>(new Set());
  const [showMinimap, setShowMinimap] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [tabSize, setTabSize] = useState(2);
  const [tabContextPath, setTabContextPath] = useState<string | null>(null);
  const [textContextMenu, setTextContextMenu] = useState<ContextMenuPosition | null>(null);
  const [statusMenuKind, setStatusMenuKind] = useState<"spaces" | "language" | "encoding" | null>(null);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [quickOpenSuggestions, setQuickOpenSuggestions] = useState<string[]>([]);
  const [positionOpen, setPositionOpen] = useState(false);
  const [positionLine, setPositionLine] = useState("1");
  const [positionColumn, setPositionColumn] = useState("1");
  const quickOpenTokenRef = useRef(0);
  const [officePreviewSrc, setOfficePreviewSrc] = useState<string | null>(null);
  const [officePreviewError, setOfficePreviewError] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState(230);
  const [outlineWidth, setOutlineWidth] = useState(220);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const programmaticEditorValueRef = useRef<string | null>(null);
  const documentsRef = useRef<EditorDocument[]>([]);
  const activePathRef = useRef<string | null>(null);
  const openingPathsRef = useRef<Set<string>>(new Set());
  const savingPathsRef = useRef<Set<string>>(new Set());
  const openedInitialRef = useRef("");
  const openChangeRef = useRef(onOpenChange);
  const saveActiveRef = useRef<() => void>(() => {});
  const saveAllRef = useRef<() => void>(() => {});
  documentsRef.current = documents;
  activePathRef.current = activePath;
  openChangeRef.current = onOpenChange;
  const dockRowRef = useRef<HTMLDivElement | null>(null);
  const tabStripRef = useRef<HTMLDivElement | null>(null);
  const dockResizeRef = useRef<{
    side: DockSide;
    pointerId: number;
    startX: number;
    startWidth: number;
    maxWidth: number;
  } | null>(null);
  const { contextMenuPosition, contextMenuOpen, openContextMenu, closeContextMenu } = useContextMenu();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const activeDocument = useMemo(
    () => documents.find((document) => document.path === activePath) ?? null,
    [activePath, documents],
  );
  const dirtyDocuments = useMemo(
    () => documents.filter((document) => document.content !== document.savedContent),
    [documents],
  );
  const outline = useMemo(
    () =>
      activeDocument?.kind === "text"
        ? buildOutline(activeDocument.content, activeDocument.language)
        : [],
    [activeDocument],
  );
  const outlineTree = useMemo(() => buildOutlineTree(outline), [outline]);
  useEffect(() => {
    if (!open || !quickOpenOpen) {
      setQuickOpenSuggestions([]);
      return;
    }
    const normalized = normalizeRemotePath(quickOpenQuery || "/");
    const directory = normalized.endsWith("/")
      ? normalized
      : remoteDirname(normalized);
    const token = ++quickOpenTokenRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const items = await fileService.list(directory);
        if (token !== quickOpenTokenRef.current) return;
        const fragment = normalized.endsWith("/")
          ? ""
          : remoteBasename(normalized).toLowerCase();
        const filtered = items
          .filter((item) => !fragment || item.name.toLowerCase().includes(fragment))
          .sort((left, right) => Number(right.is_dir) - Number(left.is_dir) || left.name.localeCompare(right.name));
        const directories = filtered.filter((item) => item.is_dir);
        const files = filtered.filter((item) => !item.is_dir);
        const candidates = fragment
          ? [...files, ...directories].slice(0, 24)
          : [...directories.slice(0, 16), ...files.slice(0, 8)].slice(0, 24);
        setQuickOpenSuggestions(candidates.map((item) => (item.is_dir ? `${item.path}/` : item.path)));
      } catch {
        if (token === quickOpenTokenRef.current) {
          setQuickOpenSuggestions([]);
        }
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [fileService, open, quickOpenOpen, quickOpenQuery, uuid]);

  useEffect(() => {
    setOutlineCollapsed(new Set());
  }, [activePath]);

  const openFile = useCallback(
    async (file: RemoteFileInfo, line = 1, depth = 0) => {
      if (file.is_dir) return;
      if (file.is_symlink && file.target) {
        const targetPath = resolveSymlinkTargetPath(file);
        if (!targetPath || openingPathsRef.current.has(targetPath)) return;
        if (depth > 4) return;
        try {
          const target = await fileService.stat(targetPath);
          await openFile(target, line, depth + 1);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t("file_manager.load_failed", "Failed to load file"));
        }
        return;
      }
      if (openingPathsRef.current.has(file.path)) return;
      const existing = documentsRef.current.find((document) => document.path === file.path);
      if (existing) {
        setActivePath(file.path);
        window.setTimeout(() => {
          editorRef.current?.revealLineInCenter(line);
          editorRef.current?.setPosition({ lineNumber: line, column: 1 });
        }, 0);
        return;
      }
      const maxPreviewSize = maxPreviewSizeForFile(file.path);
      if (file.size > maxPreviewSize) {
        const document: EditorDocument = {
          path: file.path,
          name: file.name || remoteBasename(file.path),
          content: "",
          savedContent: "",
          language: "plaintext",
          contentType: "",
          encoding: "utf-8",
          kind: "too-large",
          size: file.size,
        };
        setDocuments((current) => [...current, document]);
        setActivePath(document.path);
        return;
      }

      openingPathsRef.current.add(file.path);
      try {
        const extensionKind = previewKindForFile(file.path);
        if (extensionKind !== "text") {
          const document: EditorDocument = {
            path: file.path,
            name: file.name || remoteBasename(file.path),
            content: "",
            savedContent: "",
            language: "plaintext",
            contentType: "",
            encoding: "utf-8",
            kind: extensionKind,
            size: file.size,
          };
          setDocuments((current) => [...current, document]);
          setActivePath(document.path);
          return;
        }

        const placeholder: EditorDocument = {
          path: file.path,
          name: file.name || remoteBasename(file.path),
          content: "",
          savedContent: "",
          language: languageFromPath(file.path),
          contentType: "",
          encoding: "utf-8",
          kind: "text",
          size: file.size,
          loading: true,
        };
        setDocuments((current) => [...current, placeholder]);
        setActivePath(placeholder.path);

        const result = await fileService.read(file.path);
        const detectedKind = previewKindForFile(file.path, result.content_type);
        const binary = result.binary === true;
        const sourceBytes = binary ? undefined : result.bytes;
        const encoding = sourceBytes ? detectRemoteTextEncoding(sourceBytes) : "utf-8";
        const content = sourceBytes ? decodeRemoteTextBytes(sourceBytes, encoding) : "";
        const document: EditorDocument = {
          ...placeholder,
          content,
          savedContent: content,
          contentType: result.content_type,
          encoding,
          sourceBytes,
          kind: binary ? "binary" : detectedKind,
          size: result.size,
          loading: false,
        };
        setDocuments((current) =>
          current.map((item) => (item.path === file.path ? document : item)),
        );
        window.setTimeout(() => {
          editorRef.current?.revealLineInCenter(line);
          editorRef.current?.setPosition({ lineNumber: line, column: 1 });
        }, 60);
      } catch (error) {
        const message = error instanceof Error ? error.message : t("file_manager.load_failed", "Failed to load file");
        const sizeLimitError = /exceeds.*limit|too large|too_big/i.test(message);
        setDocuments((current) =>
          current.map((item) =>
            item.path === file.path
              ? {
                  ...item,
                  kind: sizeLimitError ? "too-large" : "error",
                  loading: false,
                  errorMessage: message,
                }
              : item,
          ),
        );
        toast.error(message);
      } finally {
        openingPathsRef.current.delete(file.path);
      }
    },
    [fileService, t],
  );

  useEffect(() => {
    if (!open || !initialFile) return;
    const key = `${uuid}:${initialFile.path}:${initialLine}`;
    if (openedInitialRef.current === key) return;
    openedInitialRef.current = key;
    void openFile(initialFile, initialLine);
  }, [initialFile, initialLine, open, openFile, uuid]);

  useEffect(() => {
    if (!open) {
      openedInitialRef.current = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const root = window.document.documentElement;
    root.style.setProperty("--km-editor-font-family", fontFamily);
    return () => {
      root.style.removeProperty("--km-editor-font-family");
    };
  }, [open, fontFamily]);

  const saveDocument = useCallback(
    async (path: string, encodingOverride?: RemoteTextEncoding) => {
      const document = documentsRef.current.find((item) => item.path === path);
      if (!document || document.kind !== "text") {
        return true;
      }
      const targetEncoding = encodingOverride ?? document.encoding;
      const dirty = document.content !== document.savedContent;
      if (!dirty && encodingOverride === undefined) return true;
      if (savingPathsRef.current.has(path)) {
        return false;
      }
      const contentToSave = document.content;
      savingPathsRef.current.add(path);
      setSavingPaths((current) => new Set(current).add(path));
      try {
        const encodedBytes = await encodeRemoteTextBytes(contentToSave, targetEncoding);
        const uploaded = await uploadEditorBlob(
          new Blob([encodedBytes], { type: "application/octet-stream" }),
          path,
          { silent: true },
        );
        if (!uploaded) return false;
        setDocuments((current) =>
          current.map((item) =>
            item.path === path
              ? {
                  ...item,
                  encoding: targetEncoding,
                  sourceBytes: encodedBytes,
                  size: encodedBytes.byteLength,
                  ...(item.content === contentToSave ? { savedContent: contentToSave } : {}),
                }
              : item,
          ),
        );
        onSaved?.();
        toast.success(t("file_manager.editor.saved", "File saved"));
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("file_manager.save_failed", "Failed to save file"));
        return false;
      } finally {
        savingPathsRef.current.delete(path);
        setSavingPaths((current) => {
          const next = new Set(current);
          next.delete(path);
          return next;
        });
      }
    },
    [onSaved, t, uploadEditorBlob],
  );

  const saveActive = useCallback(async () => {
    if (activePathRef.current) {
      await saveDocument(activePathRef.current);
    }
  }, [saveDocument]);

  const saveAll = useCallback(async () => {
    for (const document of documentsRef.current) {
      if (document.content !== document.savedContent) {
        const saved = await saveDocument(document.path);
        if (!saved) return false;
      }
    }
    return true;
  }, [saveDocument]);

  const disposeDocumentModels = useCallback(
    (paths: string[]) => {
      for (const path of paths) {
        const model = monaco.editor.getModel(monaco.Uri.parse(`${uuid}:${path}`));
        model?.dispose();
      }
    },
    [uuid],
  );

  const closeDocumentsNow = useCallback((paths: string[]) => {
    const pathSet = new Set(paths);
    const current = documentsRef.current;
    const next = current.filter((document) => !pathSet.has(document.path));
    setDocuments(next);
    const active = activePathRef.current;
    if (next.length > 0 && active && pathSet.has(active)) {
      const index = current.findIndex((document) => document.path === active);
      setActivePath(next[Math.min(index, next.length - 1)]?.path ?? null);
    } else if (next.length === 0) {
      setActivePath(null);
      setPendingClose(null);
      setTabContextPath(null);
      closeContextMenu();
    }
    window.setTimeout(() => disposeDocumentModels(paths), 0);
  }, [closeContextMenu, disposeDocumentModels]);

  const closeDocumentNow = useCallback(
    (path: string) => closeDocumentsNow([path]),
    [closeDocumentsNow],
  );

  const handleFileRenamed = useCallback((source: string, destination: string) => {
    const normalizedSource = normalizeRemotePath(source);
    const sourcePrefix = normalizedSource.endsWith("/") ? normalizedSource : `${normalizedSource}/`;
    const affectedPaths = documentsRef.current
      .filter((document) => {
        const normalizedPath = normalizeRemotePath(document.path);
        return normalizedPath === normalizedSource || normalizedPath.startsWith(sourcePrefix);
      })
      .map((document) => document.path);
    setDocuments((current) =>
      current.map((document) => {
        const normalizedPath = normalizeRemotePath(document.path);
        if (normalizedPath === normalizedSource || normalizedPath.startsWith(sourcePrefix)) {
          const suffix = normalizedPath.slice(normalizedSource.length);
          const nextPath = normalizeRemotePath(`${destination}${suffix}`);
          return { ...document, path: nextPath, name: remoteBasename(nextPath) };
        }
        return document;
      }),
    );
    const active = activePathRef.current;
    if (active) {
      const normalizedActive = normalizeRemotePath(active);
      if (normalizedActive === normalizedSource || normalizedActive.startsWith(sourcePrefix)) {
        const suffix = normalizedActive.slice(normalizedSource.length);
        setActivePath(normalizeRemotePath(`${destination}${suffix}`));
      }
    }
    if (affectedPaths.length > 0) {
      window.setTimeout(() => disposeDocumentModels(affectedPaths), 0);
    }
  }, [disposeDocumentModels]);

  const handleFilesRemoved = useCallback((paths: string[]) => {
    const normalizedPaths = paths.map(normalizeRemotePath);
    const pathSet = new Set(normalizedPaths);
    const prefixes = normalizedPaths.map((path) => (path.endsWith("/") ? path : `${path}/`));
    const current = documentsRef.current;
    const next = current.filter((document) => {
      const normalizedPath = normalizeRemotePath(document.path);
      return !pathSet.has(normalizedPath) && !prefixes.some((prefix) => normalizedPath.startsWith(prefix));
    });
    setDocuments(next);
    const active = activePathRef.current;
    if (active && !next.some((document) => document.path === active)) {
      const removedIndex = current.findIndex((document) => document.path === active);
      setActivePath(next[Math.min(Math.max(removedIndex, 0), next.length - 1)]?.path ?? null);
    }
    window.setTimeout(() => disposeDocumentModels(paths), 0);
  }, [disposeDocumentModels]);

  const requestCloseDocument = useCallback((path: string) => {
    const document = documentsRef.current.find((item) => item.path === path);
    if (document && document.content !== document.savedContent) {
      setPendingClose({ kind: "tab", path });
      return;
    }
    closeDocumentNow(path);
  }, [closeDocumentNow]);

  const requestCloseDocuments = useCallback(
    (paths: string[]) => {
      const targets = paths.filter((path) =>
        documentsRef.current.some((document) => document.path === path),
      );
      if (targets.length === 0) return;
      const dirty = targets.some((path) => {
        const document = documentsRef.current.find((item) => item.path === path);
        return document ? document.content !== document.savedContent : false;
      });
      if (dirty) {
        setPendingClose({ kind: "tabs", paths: targets });
        return;
      }
      closeDocumentsNow(targets);
    },
    [closeDocumentsNow],
  );

  const closeDialogNow = useCallback(() => {
    const paths = documentsRef.current.map((document) => document.path);
    setDocuments([]);
    setActivePath(null);
    setPendingClose(null);
    setFullscreen(false);
    setTabContextPath(null);
    setTerminalOpen(false);
    closeContextMenu();
    window.setTimeout(() => disposeDocumentModels(paths), 0);
    openChangeRef.current(false);
  }, [closeContextMenu, disposeDocumentModels]);

  const requestCloseDialog = useCallback(() => {
    if (documentsRef.current.some((document) => document.content !== document.savedContent)) {
      setPendingClose({ kind: "dialog" });
      return;
    }
    closeDialogNow();
  }, [closeDialogNow]);

  const confirmSaveAndClose = useCallback(async () => {
    if (!pendingClose) return;
    if (pendingClose.kind === "tab") {
      if (await saveDocument(pendingClose.path)) {
        closeDocumentNow(pendingClose.path);
        setPendingClose(null);
      }
      return;
    }
    if (pendingClose.kind === "tabs") {
      for (const path of pendingClose.paths) {
        if (!(await saveDocument(path))) return;
      }
      closeDocumentsNow(pendingClose.paths);
      setPendingClose(null);
      return;
    }
    if (await saveAll()) {
      closeDialogNow();
    }
  }, [closeDialogNow, closeDocumentNow, closeDocumentsNow, pendingClose, saveAll, saveDocument]);

  const confirmDiscardAndClose = useCallback(() => {
    if (!pendingClose) return;
    if (pendingClose.kind === "tab") {
      closeDocumentNow(pendingClose.path);
      setPendingClose(null);
      return;
    }
    if (pendingClose.kind === "tabs") {
      closeDocumentsNow(pendingClose.paths);
      setPendingClose(null);
      return;
    }
    closeDialogNow();
  }, [closeDialogNow, closeDocumentNow, closeDocumentsNow, pendingClose]);

  const downloadDocument = useCallback(
    (path: string) => {
      const editorDocument = documentsRef.current.find((item) => item.path === path);
      if (!editorDocument) return;
      const anchor = window.document.createElement("a");
      anchor.href = fileDownloadUrl(uuid, path);
      anchor.download = editorDocument.name;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
    [uuid],
  );

  const closeModePaths = useCallback((path: string, mode: "current" | "others" | "left" | "right") => {
    const current = documentsRef.current;
    const index = current.findIndex((document) => document.path === path);
    if (index < 0) return [];
    if (mode === "current") return [path];
    if (mode === "others") {
      return current.filter((_, itemIndex) => itemIndex !== index).map((document) => document.path);
    }
    if (mode === "left") {
      return current.slice(0, index).map((document) => document.path);
    }
    return current.slice(index + 1).map((document) => document.path);
  }, []);

  const requestCloseMode = useCallback(
    (path: string, mode: "current" | "others" | "left" | "right") => {
      requestCloseDocuments(closeModePaths(path, mode));
    },
    [closeModePaths, requestCloseDocuments],
  );

  const handleDocumentDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDocuments((current) => {
      const from = current.findIndex((document) => document.path === active.id);
      const to = current.findIndex((document) => document.path === over.id);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const copyDocumentPath = useCallback(async (path: string) => {
    const copied = await copyTextToClipboard(formatClipboardPath(path));
    if (copied) {
      toast.success(t("file_manager.copy_path_success", "Path copied"));
    } else {
      toast.error(t("file_manager.copy_path_failed", "Could not copy path"));
    }
  }, [t]);

  const buildTabContextMenuItems = useCallback(
    (path: string | null): ContextMenuItemConfig[] => {
      if (!path) return [];
      const current = documentsRef.current;
      const document = current.find((item) => item.path === path);
      const index = current.findIndex((item) => item.path === path);
      if (!document || index < 0) return [];
      const dirty = document.content !== document.savedContent;
      return [
        {
          key: "save",
          label: t("file_manager.editor.save", "Save"),
          icon: <Save size={14} />,
          disabled: document.kind !== "text" || !dirty,
          onSelect: () => void saveDocument(path),
        },
        {
          key: "download",
          label: t("file_manager.download", "Download"),
          icon: <Download size={14} />,
          onSelect: () => downloadDocument(path),
        },
        {
          key: "copy-path",
          label: t("file_manager.copy_path", "Copy path"),
          icon: <Copy size={14} />,
          onSelect: () => void copyDocumentPath(path),
        },
        {
          key: "close-others",
          label: t("file_manager.editor.close_others", "Close Others"),
          separatorBefore: true,
          disabled: current.length <= 1,
          submenu: [
            {
              key: "close-others",
              label: t("file_manager.editor.close_others", "Close Others"),
              disabled: current.length <= 1,
              onSelect: () => requestCloseMode(path, "others"),
            },
            {
              key: "close-left",
              label: t("file_manager.editor.close_left", "Close Left"),
              disabled: index === 0,
              onSelect: () => requestCloseMode(path, "left"),
            },
            {
              key: "close-right",
              label: t("file_manager.editor.close_right", "Close Right"),
              disabled: index === current.length - 1,
              onSelect: () => requestCloseMode(path, "right"),
            },
          ],
        },
        {
          key: "close-current",
          label: t("file_manager.editor.close_tab", "Close Tab"),
          icon: <X size={14} />,
          destructive: true,
          onSelect: () => requestCloseDocument(path),
        },
      ];
    },
    [copyDocumentPath, downloadDocument, requestCloseDocument, requestCloseMode, saveDocument, t],
  );

  const switchDocument = useCallback((direction: number) => {
    const current = documentsRef.current;
    if (current.length < 2) return;
    const index = current.findIndex((document) => document.path === activePathRef.current);
    const next = (Math.max(index, 0) + direction + current.length) % current.length;
    setActivePath(current[next].path);
  }, []);

  const switchDocumentRef = useRef<(direction: number) => void>(() => {});
  const editorStateRef = useRef({ hasSelection: false, canUndo: false, canRedo: false });
  saveActiveRef.current = () => void saveActive();
  saveAllRef.current = () => void saveAll();
  switchDocumentRef.current = switchDocument;

  const updateEditorState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    editorStateRef.current = {
      hasSelection: !editor.getSelection()?.isEmpty(),
      canUndo: typeof model?.canUndo === "function" ? model.canUndo() : false,
      canRedo: typeof model?.canRedo === "function" ? model.canRedo() : false,
    };
  }, []);

  const handleEditorMount = useCallback<OnMount>((editor) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveActiveRef.current());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => saveAllRef.current());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Tab, () => switchDocumentRef.current(1));
    editor.onDidChangeCursorPosition((event) => {
      setCursor({ line: event.position.lineNumber, column: event.position.column });
    });
    editor.onDidChangeCursorSelection(updateEditorState);
    editor.onDidChangeModelContent(updateEditorState);
    updateEditorState();
    const editorDom = editor.getDomNode();
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      updateEditorState();
      setTextContextMenu({ x: event.clientX, y: event.clientY });
    };
    editorDom?.addEventListener("contextmenu", handleContextMenu);
    editor.onDidDispose(() => {
      editorDom?.removeEventListener("contextmenu", handleContextMenu);
    });
  }, [updateEditorState]);

  const runEditorCommand = useCallback((commandId: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    editor.trigger("context-menu", commandId, null);
    setTextContextMenu(null);
  }, []);

  const openQuickPath = useCallback(async (path: string) => {
    const normalized = normalizeRemotePath(path.trim());
    if (!normalized || normalized === "/") return;
    try {
      const file = await fileService.stat(normalized);
      await openFile(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.load_failed", "Failed to load file"));
    }
  }, [fileService, openFile, t]);

  const openPositionDialog = useCallback(() => {
    setPositionLine(String(cursor.line));
    setPositionColumn(String(cursor.column));
    setPositionOpen(true);
  }, [cursor.column, cursor.line]);

  const submitPosition = useCallback(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const requestedLine = Number.parseInt(positionLine, 10);
    const requestedColumn = Number.parseInt(positionColumn, 10);
    if (!Number.isFinite(requestedLine) || !Number.isFinite(requestedColumn)) return;
    const lineNumber = Math.min(Math.max(1, requestedLine), model.getLineCount());
    const column = Math.min(Math.max(1, requestedColumn), model.getLineMaxColumn(lineNumber));
    editor.setPosition({ lineNumber, column });
    editor.revealPositionInCenter({ lineNumber, column });
    editor.focus();
    setCursor({ line: lineNumber, column });
    setPositionOpen(false);
  }, [positionColumn, positionLine]);

  const buildTextContextMenuItems = useCallback((): ContextMenuItemConfig[] => {
    const { hasSelection, canUndo, canRedo } = editorStateRef.current;
    return [
      {
        key: "cut",
        label: t("file_manager.editor.cut", "Cut"),
        icon: <Scissors size={14} />,
        disabled: !hasSelection,
        onSelect: () => runEditorCommand("editor.action.clipboardCutAction"),
      },
      {
        key: "copy",
        label: t("file_manager.editor.copy", "Copy"),
        icon: <Clipboard size={14} />,
        disabled: !hasSelection,
        onSelect: () => runEditorCommand("editor.action.clipboardCopyAction"),
      },
      {
        key: "paste",
        label: t("file_manager.editor.paste", "Paste"),
        icon: <SquareStack size={14} />,
        onSelect: () => runEditorCommand("editor.action.clipboardPasteAction"),
      },
      {
        key: "undo",
        label: t("file_manager.editor.undo", "Undo"),
        icon: <Undo2 size={14} />,
        disabled: !canUndo,
        separatorBefore: true,
        onSelect: () => runEditorCommand("undo"),
      },
      {
        key: "redo",
        label: t("file_manager.editor.redo", "Redo"),
        icon: <Redo2 size={14} />,
        disabled: !canRedo,
        onSelect: () => runEditorCommand("redo"),
      },
      {
        key: "select-all",
        label: t("file_manager.editor.select_all", "Select All"),
        icon: <FileText size={14} />,
        separatorBefore: true,
        onSelect: () => runEditorCommand("editor.action.selectAll"),
      },
    ];
  }, [runEditorCommand, t]);

  const openStatusMenu = useCallback((kind: "spaces" | "language" | "encoding", event: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    openContextMenu({
      clientX: rect.left,
      clientY: rect.bottom + 2,
      preventDefault: () => {},
    });
    setStatusMenuKind(kind);
  }, [openContextMenu]);

  const setActiveLanguage = useCallback((language: string) => {
    const path = activePathRef.current;
    if (!path) return;
    setDocuments((current) =>
      current.map((document) => (document.path === path ? { ...document, language } : document)),
    );
    const model = editorRef.current?.getModel();
    if (model) monaco.editor.setModelLanguage(model, language);
  }, []);

  const reopenDocumentWithEncoding = useCallback((path: string, encoding: RemoteTextEncoding) => {
    const document = documentsRef.current.find((item) => item.path === path);
    if (!document || document.kind !== "text" || !document.sourceBytes) return;
    try {
      const content = decodeRemoteTextBytes(document.sourceBytes, encoding);
      setDocuments((current) =>
        current.map((item) =>
          item.path === path
            ? { ...item, content, savedContent: content, encoding }
            : item,
        ),
      );
      if (activePathRef.current === path) {
        programmaticEditorValueRef.current = content;
        editorRef.current?.getModel()?.setValue(content);
        window.queueMicrotask(() => {
          if (programmaticEditorValueRef.current === content) {
            programmaticEditorValueRef.current = null;
          }
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("file_manager.editor.encoding_failed", "Unable to decode with this encoding"));
    }
  }, [t]);

  const requestReopenWithEncoding = useCallback((encoding: RemoteTextEncoding) => {
    const path = activePathRef.current;
    if (!path) return;
    const document = documentsRef.current.find((item) => item.path === path);
    if (!document || document.kind !== "text") return;
    if (document.content !== document.savedContent) {
      setPendingEncodingReopen({ path, encoding });
      return;
    }
    reopenDocumentWithEncoding(path, encoding);
  }, [reopenDocumentWithEncoding]);

  const saveWithEncoding = useCallback(async (encoding: RemoteTextEncoding) => {
    const path = activePathRef.current;
    if (!path) return;
    await saveDocument(path, encoding);
  }, [saveDocument]);

  const confirmReopenWithEncoding = useCallback(() => {
    const pending = pendingEncodingReopen;
    if (!pending) return;
    setPendingEncodingReopen(null);
    reopenDocumentWithEncoding(pending.path, pending.encoding);
  }, [pendingEncodingReopen, reopenDocumentWithEncoding]);

  const buildStatusContextMenuItems = useCallback((): ContextMenuItemConfig[] => {
    if (statusMenuKind === "spaces") {
      return [2, 4, 8].map((size) => ({
        key: `spaces-${size}`,
        label: `${size} spaces`,
        icon: tabSize === size ? <Check size={14} /> : <span className="inline-block w-[14px]" />,
        onSelect: () => setTabSize(size),
      }));
    }
    if (statusMenuKind === "language") {
      return supportedLanguages.map((language) => ({
        key: language,
        label: language,
        icon: activeDocument?.language === language
          ? <Check size={14} />
          : <span className="inline-block w-[14px]" />,
        onSelect: () => setActiveLanguage(language),
      }));
    }
    if (statusMenuKind === "encoding") {
      const encodingChoices = (action: "reopen" | "save"): ContextMenuItemConfig[] =>
        REMOTE_TEXT_ENCODINGS.map((encoding) => ({
          key: `${action}-${encoding.value}`,
          label: encoding.label,
          icon: activeDocument?.encoding === encoding.value
            ? <Check size={14} />
            : <span className="inline-block w-[14px]" />,
          onSelect: () => {
            if (action === "reopen") {
              requestReopenWithEncoding(encoding.value);
            } else {
              void saveWithEncoding(encoding.value);
            }
          },
        }));
      const encodingDisabled = !activeDocument || activeDocument.kind !== "text";
      return [
        {
          key: "encoding-reopen",
          label: t("file_manager.editor.reopen_with_encoding", "Reopen with Encoding"),
          icon: <RotateCcw size={14} />,
          disabled: encodingDisabled,
          submenu: encodingChoices("reopen"),
        },
        {
          key: "encoding-save",
          label: t("file_manager.editor.save_with_encoding", "Save with Encoding"),
          icon: <Save size={14} />,
          disabled: encodingDisabled,
          separatorBefore: true,
          submenu: encodingChoices("save"),
        },
      ];
    }
    return [];
  }, [activeDocument, activeDocument?.encoding, activeDocument?.language, requestReopenWithEncoding, saveWithEncoding, statusMenuKind, setActiveLanguage, tabSize, t]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (documentsRef.current.some((document) => document.content !== document.savedContent)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "`") {
        event.preventDefault();
        setTerminalOpen((value) => !value);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setQuickOpenQuery(activePathRef.current ?? "");
        setQuickOpenOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);


  const revealOutlineItem = useCallback((item: OutlineItem) => {
    editorRef.current?.revealLineInCenter(item.line);
    editorRef.current?.setPosition({ lineNumber: item.line, column: 1 });
    editorRef.current?.focus();
  }, []);

  const toggleOutlineNode = useCallback((key: string) => {
    setOutlineCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const triggerEditorAction = (action: "undo" | "redo") => {
    editorRef.current?.trigger("toolbar", action, null);
    editorRef.current?.focus();
  };

  const getDockMaxWidth = useCallback((side: DockSide) => {
    const rowWidth = dockRowRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const otherWidth =
      side === "left"
        ? Math.min(MAX_DOCK_WIDTH, outlineWidth)
        : Math.min(MAX_DOCK_WIDTH, explorerWidth);
    return Math.max(
      MIN_DOCK_WIDTH,
      Math.min(MAX_DOCK_WIDTH, rowWidth - otherWidth - MIN_EDITOR_WIDTH),
    );
  }, [explorerWidth, outlineWidth]);

  const handleDockResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, side: DockSide) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dockResizeRef.current = {
        side,
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: side === "left" ? explorerWidth : outlineWidth,
        maxWidth: getDockMaxWidth(side),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [explorerWidth, getDockMaxWidth, outlineWidth],
  );

  const handleDockResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeState = dockResizeRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    const delta = event.clientX - resizeState.startX;
    const nextWidth = Math.round(
      Math.max(
        MIN_DOCK_WIDTH,
        Math.min(
          resizeState.maxWidth,
          resizeState.side === "left"
            ? resizeState.startWidth + delta
            : resizeState.startWidth - delta,
        ),
      ),
    );
    if (resizeState.side === "left") {
      setExplorerWidth(nextWidth);
    } else {
      setOutlineWidth(nextWidth);
    }
  };

  const handleDockResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeState = dockResizeRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    dockResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(resizeState.pointerId)) {
      event.currentTarget.releasePointerCapture(resizeState.pointerId);
    }
  };

  const mediaUrl = activeDocument
    ? fileDownloadUrl(uuid, activeDocument.path, true)
    : "";

  const renderOutlineNode = (node: OutlineNode, depth: number): ReactNode => {
    const expanded = !outlineCollapsed.has(node.key);
    return (
      <div key={node.key} style={{ paddingLeft: `${depth * 10}px` }}>
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            className={`mr-0.5 inline-flex h-6 w-4 shrink-0 items-center justify-center border-0 bg-transparent ${
              node.children.length > 0 ? "text-[#969696] hover:text-white" : "opacity-0 pointer-events-none"
            }`}
            onClick={() => toggleOutlineNode(node.key)}
            disabled={node.children.length === 0}
            aria-expanded={node.children.length > 0 ? expanded : undefined}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          <button
            type="button"
            className="min-w-0 flex-1 truncate border-0 bg-transparent pr-2 py-1 text-left text-xs text-[#c5c5c5] hover:bg-[#2a2d2e]"
            onClick={() => revealOutlineItem(node.item)}
            title={`${node.item.label} - ${node.item.detail}`}
          >
            {node.item.label}
          </button>
          <span className="pr-2 text-[10px] text-[#666]">{node.item.line}</span>
        </div>
        {expanded &&
          node.children.map((child) => renderOutlineNode(child, depth + 1))}
      </div>
    );
  };

  useEffect(() => {
    if (!open || activeDocument?.kind !== "office") {
      setOfficePreviewSrc(null);
      setOfficePreviewError(null);
      return;
    }
    let cancelled = false;
    setOfficePreviewSrc(null);
    setOfficePreviewError(null);
    void fetchOfficePreviewUrl(uuid, activeDocument.path)
      .then((url) => {
        if (!cancelled) setOfficePreviewSrc(url);
      })
      .catch((error) => {
        if (!cancelled) {
          setOfficePreviewSrc(null);
          setOfficePreviewError(error instanceof Error ? error.message : "Failed to create Office preview");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeDocument?.kind, activeDocument?.path, open, uuid]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="km-file-editor !fixed !m-0 !max-w-none overflow-hidden !rounded-[6px] !border !border-[#555] !bg-[#181818] !p-0 !shadow-2xl"
        style={
          fullscreen
            ? {
                inset: 0,
                width: "100vw",
                height: "100vh",
                maxWidth: "none",
                maxHeight: "none",
                transform: "none",
                fontFamily,
              }
            : {
                inset: "3vh 2vw",
                width: "96vw",
                height: "94vh",
                maxWidth: "none",
                maxHeight: "none",
                transform: "none",
                fontFamily,
              }
        }
      role="dialog"
      aria-modal="false"
      aria-label={activeDocument?.path ?? t("file_manager.editor.title", "File editor")}
    >
      <div className="sr-only">
          {t("file_manager.editor.title", "File editor")}
      </div>
      <div className="sr-only">
          {activeDocument?.path ?? t("file_manager.editor.title", "File editor")}
      </div>

        <div className="flex h-full min-h-0 flex-col bg-[#181818] text-[#cccccc]">
          <div className="flex h-9 shrink-0 items-center border-b border-[#2b2b2b] bg-[#202020] pl-3">
            <Code2 size={16} className="mr-2 text-[#55a7e0]" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#eeeeee]">
              {activeDocument?.path ?? t("file_manager.editor.title", "File editor")}
              {activeDocument && activeDocument.content !== activeDocument.savedContent ? " *" : ""}
            </span>
            <button
              type="button"
              className={editorIconButton}
              onClick={() => setFullscreen((value) => !value)}
              title={fullscreen ? t("file_manager.editor.restore", "Restore") : t("file_manager.editor.maximize", "Maximize")}
            >
              {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              className={`${editorIconButton} hover:bg-[#c42b1c]`}
              onClick={requestCloseDialog}
              title={t("common.close", "Close")}
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-[#2b2b2b] bg-[#181818] px-1">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button className="h-7 px-2 text-xs text-[#cccccc] hover:bg-[#333333]">
                  {t("file_manager.editor.menu.file", "File")}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content size="1" color="gray" highContrast>
                <DropdownMenu.Item onSelect={() => void saveActive()} shortcut="Ctrl+S">
                  <Save size={14} /> {t("file_manager.editor.save", "Save")}
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => void saveAll()} shortcut="Ctrl+Shift+S">
                  <SaveAll size={14} /> {t("file_manager.editor.save_all", "Save All")}
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onSelect={() => activePath && requestCloseDocument(activePath)}>
                  {t("file_manager.editor.close_file", "Close File")}
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => {
                  setQuickOpenQuery(activePath ?? "");
                  setQuickOpenOpen(true);
                }}>
                  {t("file_manager.editor.go_to", "Go to File")}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button className="h-7 px-2 text-xs text-[#cccccc] hover:bg-[#333333]">
                  {t("file_manager.editor.menu.edit", "Edit")}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content size="1" color="gray" highContrast>
                <DropdownMenu.Item onSelect={() => triggerEditorAction("undo")} shortcut="Ctrl+Z">
                  <Undo2 size={14} /> {t("file_manager.editor.undo", "Undo")}
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => triggerEditorAction("redo")} shortcut="Ctrl+Y">
                  <Redo2 size={14} /> {t("file_manager.editor.redo", "Redo")}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button className="h-7 px-2 text-xs text-[#cccccc] hover:bg-[#333333]">
                  {t("file_manager.editor.menu.view", "View")}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content size="1" color="gray" highContrast>
                <DropdownMenu.CheckboxItem checked={showExplorer} onCheckedChange={setShowExplorer}>
                  {t("file_manager.editor.explorer", "Explorer")}
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem checked={showOutline} onCheckedChange={setShowOutline}>
                  {t("file_manager.editor.outline", "Outline")}
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem checked={showMinimap} onCheckedChange={setShowMinimap}>
                  {t("file_manager.editor.minimap", "Minimap")}
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem
                  checked={terminalOpen}
                  onCheckedChange={(checked) => setTerminalOpen(checked === true)}
                >
                  {t("terminal.title", "Terminal")}
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem checked={wordWrap} onCheckedChange={setWordWrap}>
                  {t("file_manager.editor.word_wrap", "Word Wrap")}
                </DropdownMenu.CheckboxItem>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <div className="mx-1 h-4 w-px bg-[#3a3a3a]" />
            <button
              className={editorIconButton}
              disabled={!activeDocument || activeDocument.kind !== "text" || activeDocument.content === activeDocument.savedContent || savingPaths.has(activeDocument.path)}
              onClick={() => void saveActive()}
              title={t("file_manager.editor.save", "Save")}
            >
              <Save size={15} />
            </button>
            <button className={editorIconButton} onClick={() => triggerEditorAction("undo")} title={t("file_manager.editor.undo", "Undo")}>
              <Undo2 size={15} />
            </button>
            <button className={editorIconButton} onClick={() => triggerEditorAction("redo")} title={t("file_manager.editor.redo", "Redo")}>
              <Redo2 size={15} />
            </button>
            <div className="ml-auto flex items-center">
              <button className={editorIconButton} onClick={() => setShowExplorer((value) => !value)} title={t("file_manager.editor.explorer", "Explorer")}>
                {showExplorer ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
              </button>
              <button className={editorIconButton} onClick={() => setShowOutline((value) => !value)} title={t("file_manager.editor.outline", "Outline")}>
                {showOutline ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              </button>
            </div>
          </div>

          <div ref={dockRowRef} className="relative flex min-h-0 flex-1">
            {showExplorer && (
              <aside
                className="relative z-20 flex shrink-0 flex-col border-r border-[#2b2b2b] bg-[#181818] shadow-2xl md:static md:z-auto md:shadow-none max-md:absolute max-md:inset-y-0 max-md:left-0"
                style={{ width: explorerWidth }}
              >
                <div className="flex h-8 items-center px-3 text-[11px] font-semibold uppercase text-[#bbbbbb]">
                  {t("file_manager.editor.explorer", "Explorer")}
                </div>
                <div className="min-h-0 flex-1">
                  <RemoteFileTree
                    uuid={uuid}
                    rootPath="/"
                    activePath={activePath ?? undefined}
                    refreshToken={refreshToken}
                    revealPath={activePath ?? initialFile?.path ?? null}
                    onOpenFile={(file) => void openFile(file)}
                    onDeleteFiles={(files) => setPendingTreeDelete({ files })}
                    onFileRenamed={handleFileRenamed}
                    onChanged={onChanged}
                  />
                </div>
              </aside>
            )}

            {showExplorer && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t("file_manager.editor.explorer", "Explorer")}
                className="hidden h-full w-1 shrink-0 cursor-col-resize bg-[#2b2b2b] transition-colors hover:bg-[#55a7e0] focus-visible:bg-[#55a7e0] focus-visible:outline-none md:block"
                onPointerDown={(event) => handleDockResizeStart(event, "left")}
                onPointerMove={handleDockResizeMove}
                onPointerUp={handleDockResizeEnd}
                onPointerCancel={handleDockResizeEnd}
              />
            )}

            <main className="flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToHorizontalAxis]}
                onDragEnd={handleDocumentDragEnd}
              >
                <SortableContext
                  items={documents.map((document) => document.path)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div
                    ref={tabStripRef}
                    className="flex h-9 shrink-0 overflow-x-auto overflow-y-hidden border-b border-[#2b2b2b] bg-[#181818]"
                    onWheel={(event) => {
                      if (!event.deltaY) return;
                      event.preventDefault();
                      tabStripRef.current?.scrollBy({ left: event.deltaY });
                    }}
                  >
                    {documents.map((document) => (
                      <EditorTabItem
                        key={document.path}
                        document={document}
                        active={document.path === activePath}
                        onActivate={setActivePath}
                        onRequestClose={requestCloseDocument}
                        onContextMenu={(event, path) => {
                          setTabContextPath(path);
                          openContextMenu(event);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

        <FileContextMenu
                open={contextMenuOpen}
                position={contextMenuPosition}
                items={buildTabContextMenuItems(tabContextPath)}
                onOpenChange={(open) => {
                  if (!open) {
                    closeContextMenu();
                    setTabContextPath(null);
                  }
                }}
              />

              <FileContextMenu
                open={textContextMenu !== null}
                position={textContextMenu}
                items={buildTextContextMenuItems()}
                onOpenChange={(open) => {
                  if (!open) setTextContextMenu(null);
                }}
              />

              <FileContextMenu
                open={statusMenuKind !== null}
                position={contextMenuOpen ? contextMenuPosition : null}
                items={buildStatusContextMenuItems()}
                onOpenChange={(open) => {
                  if (!open) {
                    closeContextMenu();
                    setStatusMenuKind(null);
                  }
                }}
              />

              <TerminalDialog
                open={quickOpenOpen}
                title={t("file_manager.editor.go_to", "Go to File")}
                fields={[{
                  key: "path",
                  placeholder: t("file_manager.editor.go_to_placeholder", "Enter a file path"),
                  value: quickOpenQuery,
                  suggestions: quickOpenSuggestions,
                  onChange: setQuickOpenQuery,
                  onSelectSuggestion: (value) => {
                    if (value.endsWith("/")) {
                      setQuickOpenQuery(value);
                    } else {
                      void openQuickPath(value);
                      setQuickOpenOpen(false);
                    }
                  },
                }]}
                autoHighlight
                onSubmit={() => {
                  const value = quickOpenQuery.trim();
                  if (!value || value.endsWith("/")) return;
                  void openQuickPath(value);
                  setQuickOpenOpen(false);
                }}
                onCancel={() => setQuickOpenOpen(false)}
              />

              <TerminalDialog
                open={positionOpen}
                title={t("file_manager.editor.go_to_position", "Go to Line/Column")}
                fields={[
                  {
                    key: "line",
                    label: t("file_manager.editor.line", "Line"),
                    value: positionLine,
                    onChange: setPositionLine,
                  },
                  {
                    key: "column",
                    label: t("file_manager.editor.column", "Column"),
                    value: positionColumn,
                    onChange: setPositionColumn,
                  },
                ]}
                confirmLabel={t("common.confirm", "Confirm")}
                onSubmit={submitPosition}
                onCancel={() => setPositionOpen(false)}
              />

              <div className="relative min-h-0 flex-1">
                {activeDocument?.loading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1e1e1e]/90 text-xs text-[#bbbbbb]">
                    <RotateCcw size={16} className="mr-2 animate-spin" />
                    {t("file_manager.editor.loading_agent", "Fetching file from agent...")}
                  </div>
                )}
                {!activeDocument && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-[#737373]">
                    <Code2 size={52} strokeWidth={1} />
                    <span className="text-sm">{t("file_manager.editor.empty", "Open a file from Explorer")}</span>
                  </div>
                )}
                {activeDocument && !activeDocument.loading && activeDocument.kind === "text" && (
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    path={`${uuid}:${activeDocument.path}`}
                    language={activeDocument.language}
                    value={activeDocument.content}
                    keepCurrentModel
                    onMount={handleEditorMount}
                    onChange={(value) => {
                      const path = activeDocument.path;
                      if (programmaticEditorValueRef.current === (value ?? "")) {
                        programmaticEditorValueRef.current = null;
                        return;
                      }
                      setDocuments((current) =>
                        current.map((document) =>
                          document.path === path ? { ...document, content: value ?? "" } : document,
                        ),
                      );
                    }}
                    options={{
                      automaticLayout: true,
                      fontFamily,
                      fontSize: 14,
                      lineHeight: 21,
                      minimap: { enabled: showMinimap, renderCharacters: false, maxColumn: 100 },
                      overviewRulerBorder: false,
                      padding: { top: 8 },
                      renderWhitespace: "selection",
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      tabSize,
                      wordWrap: wordWrap ? "on" : "off",
                      contextmenu: false,
                    }}
                  />
                )}
                {activeDocument?.kind === "image" && (
                  <div className="flex h-full items-center justify-center overflow-auto bg-[#1e1e1e] p-6">
                    <img
                      key={activeDocument.path}
                      src={mediaUrl}
                      alt={activeDocument.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
                {activeDocument?.kind === "audio" && (
                  <div className="flex h-full items-center justify-center bg-[#1e1e1e] p-6">
                    <audio key={activeDocument.path} controls src={mediaUrl} className="w-full max-w-2xl" />
                  </div>
                )}
                {activeDocument?.kind === "video" && (
                  <div className="flex h-full items-center justify-center bg-black p-4">
                    <video key={activeDocument.path} controls src={mediaUrl} className="max-h-full max-w-full" />
                  </div>
                )}
                {activeDocument?.kind === "pdf" && (
                  <iframe key={activeDocument.path} title={activeDocument.name} src={mediaUrl} className="h-full w-full border-0 bg-white" />
                )}
                {activeDocument?.kind === "office" && (
                  officePreviewError ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#1e1e1e] text-xs text-[#a7a7a7]">
                      <Braces size={36} strokeWidth={1.25} />
                      <span>{t("file_manager.editor.preview_failed", "Unable to preview this file")}</span>
                      <a href={fileDownloadUrl(uuid, activeDocument.path)} className="text-xs text-[#75beff] hover:underline">
                        {t("file_manager.download", "Download")}
                      </a>
                    </div>
                  ) : officePreviewSrc ? (
                    <iframe
                      key={activeDocument.path}
                      title={activeDocument.name}
                      src={officePreviewSrc}
                      className="h-full w-full border-0 bg-white"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-xs text-[#bbbbbb]">
                      <RotateCcw size={16} className="mr-2 animate-spin" />
                      {t("file_manager.loading", "Loading...")}
                    </div>
                  )
                )}
                {activeDocument?.kind === "binary" && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#1e1e1e] px-6 text-center text-[#a7a7a7]">
                    <FileText size={40} strokeWidth={1.25} className="text-[#d19a66]" />
                    <span className="text-sm">{t("file_manager.editor.binary", "Binary file preview")}</span>
                    <span className="text-xs text-[#777]">{formatFileSize(activeDocument.size)}</span>
                    <a href={fileDownloadUrl(uuid, activeDocument.path)} className="text-xs text-[#75beff] hover:underline">
                      {t("file_manager.download", "Download")}
                    </a>
                  </div>
                )}
                {activeDocument?.kind === "too-large" && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-[#a7a7a7]">
                    <Braces size={40} strokeWidth={1.25} />
                    <span className="text-sm">{t("file_manager.editor.too_large_preview", "File is too large to preview")}</span>
                    <span className="text-xs text-[#777]">{formatFileSize(activeDocument.size)}</span>
                    <a href={fileDownloadUrl(uuid, activeDocument.path)} className="text-xs text-[#75beff] hover:underline">
                      {t("file_manager.download", "Download")}
                    </a>
                  </div>
                )}
                {activeDocument?.kind === "error" && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#a7a7a7]">
                    <Braces size={40} strokeWidth={1.25} />
                    <span className="text-sm">{t("file_manager.editor.preview_failed", "Unable to preview this file")}</span>
                    {activeDocument.errorMessage && (
                      <span className="max-w-full truncate text-xs text-[#777]" title={activeDocument.errorMessage}>
                        {activeDocument.errorMessage}
                      </span>
                    )}
                    <a href={fileDownloadUrl(uuid, activeDocument.path)} className="text-xs text-[#75beff] hover:underline">
                      {t("file_manager.download", "Download")}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex h-6 shrink-0 items-center bg-[#007acc] px-2 text-[11px] text-white">
                <button
                  type="button"
                  className="mr-2 h-6 border-0 bg-transparent px-1 text-[11px] text-white hover:bg-black/25"
                  onClick={openPositionDialog}
                  title={t("file_manager.editor.go_to_position", "Go to Line/Column")}
                >
                  Ln {cursor.line}, Col {cursor.column}
                </button>
                <button
                  type="button"
                  className="h-6 border-0 bg-transparent px-2 text-[11px] text-white hover:bg-black/25"
                  onClick={(event) => openStatusMenu("spaces", event)}
                >
                  Spaces: {tabSize}
                </button>
                <button
                  type="button"
                  className="h-6 px-2 text-[11px] text-white hover:bg-black/20"
                  onClick={(event) => openStatusMenu("encoding", event)}
                  title={t("file_manager.editor.encoding_hint", "Text encoding")}
                >
                  {REMOTE_TEXT_ENCODINGS.find((encoding) => encoding.value === activeDocument?.encoding)?.label ?? "UTF-8"}
                </button>
                <span className="px-2">{activeDocument?.content.includes("\r\n") ? "CRLF" : "LF"}</span>
                <button
                  className="h-6 px-2 text-[11px] text-white hover:bg-black/20"
                  onClick={(event) => openStatusMenu("language", event)}
                >
                  {activeDocument?.language ?? "plaintext"}
                </button>
                <span className="ml-auto px-2">
                  {activeDocument ? formatFileSize(activeDocument.size) : ""}
                </span>
              </div>
            </main>

            {showOutline && (
              <aside
                className="hidden shrink-0 flex-col border-l border-[#2b2b2b] bg-[#181818] lg:flex"
                style={{ width: outlineWidth }}
              >
                <div className="flex h-8 items-center gap-2 px-3 text-[11px] font-semibold uppercase text-[#bbbbbb]">
                  <ListTree size={14} />
                  {t("file_manager.editor.outline", "Outline")}
                </div>
                <div className="min-h-0 flex-1 overflow-auto pb-2">
                  {outline.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-[#777]">
                      {t("file_manager.editor.no_symbols", "No symbols found")}
                    </div>
                  ) : (
                    outlineTree.map((node) => renderOutlineNode(node, 0))
                  )}
                </div>
                <EditorResourceMonitor uuid={uuid} />
              </aside>
            )}
            {showOutline && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t("file_manager.editor.outline", "Outline")}
                className="hidden h-full w-1 shrink-0 cursor-col-resize bg-[#2b2b2b] transition-colors hover:bg-[#55a7e0] focus-visible:bg-[#55a7e0] focus-visible:outline-none lg:block"
                onPointerDown={(event) => handleDockResizeStart(event, "right")}
                onPointerMove={handleDockResizeMove}
                onPointerUp={handleDockResizeEnd}
                onPointerCancel={handleDockResizeEnd}
              />
            )}
          </div>
          {terminalOpen && (
            <EditorTerminalPanel
              uuid={uuid}
              onClose={() => setTerminalOpen(false)}
            />
          )}
        </div>

        <ConfirmDialog
          open={pendingClose !== null}
          title={t("file_manager.editor.unsaved_title", "Save changes?")}
          description={pendingClose?.kind === "tab"
            ? t("file_manager.editor.unsaved_file", {
                name: remoteBasename(pendingClose.path),
                defaultValue: `Save changes to ${remoteBasename(pendingClose.path)}?`,
              })
            : pendingClose?.kind === "tabs"
              ? t("file_manager.editor.unsaved_all", {
                  count: pendingClose.paths.filter((path) =>
                    documentsRef.current.some(
                      (document) =>
                        document.path === path &&
                        document.content !== document.savedContent,
                    ),
                  ).length,
                  defaultValue: `${pendingClose.paths.length} files have unsaved changes.`,
                })
              : pendingClose
                ? t("file_manager.editor.unsaved_all", {
                    count: dirtyDocuments.length,
                    defaultValue: `${dirtyDocuments.length} files have unsaved changes.`,
                  })
                : undefined}
          secondaryLabel={pendingClose
            ? t("file_manager.editor.dont_save", "Don't Save")
            : undefined}
          confirmLabel={pendingClose?.kind === "dialog" || pendingClose?.kind === "tabs"
            ? t("file_manager.editor.save_all", "Save All")
            : t("file_manager.editor.save", "Save")}
          cancelLabel={t("common.cancel", "Cancel")}
          submitting={savingPaths.size > 0}
          onSecondary={confirmDiscardAndClose}
          onConfirm={() => void confirmSaveAndClose()}
          onCancel={() => setPendingClose(null)}
        />

        <ConfirmDialog
          open={pendingEncodingReopen !== null}
          title={t("file_manager.editor.reopen_with_encoding_title", "Reopen with Encoding?")}
          description={pendingEncodingReopen
            ? t("file_manager.editor.reopen_with_encoding_description", {
                name: remoteBasename(pendingEncodingReopen.path),
                encoding: REMOTE_TEXT_ENCODINGS.find((item) => item.value === pendingEncodingReopen.encoding)?.label
                  ?? pendingEncodingReopen.encoding,
                defaultValue: `Reopen "${remoteBasename(pendingEncodingReopen.path)}" as ${REMOTE_TEXT_ENCODINGS.find((item) => item.value === pendingEncodingReopen.encoding)?.label ?? pendingEncodingReopen.encoding}? Unsaved changes will be discarded.`,
              })
            : undefined}
          confirmLabel={t("file_manager.editor.reopen", "Reopen")}
          cancelLabel={t("common.cancel", "Cancel")}
          destructive
          onConfirm={confirmReopenWithEncoding}
          onCancel={() => setPendingEncodingReopen(null)}
        />

        <ConfirmDialog
          open={pendingTreeDelete !== null}
          title={t("file_manager.delete", "Delete")}
          description={pendingTreeDelete && pendingTreeDelete.files.length > 1
            ? t("file_manager.confirm_delete_multiple", {
                count: pendingTreeDelete.files.length,
                defaultValue: `Delete ${pendingTreeDelete.files.length} items?`,
              })
            : t("file_manager.confirm_delete", {
                name: pendingTreeDelete?.files[0]?.name ?? "",
                defaultValue: `Delete ${pendingTreeDelete?.files[0]?.name ?? "this item"}?`,
              })}
          confirmLabel={t("common.delete", "Delete")}
          cancelLabel={t("common.cancel", "Cancel")}
          destructive
          onConfirm={() => {
            if (!pendingTreeDelete) return;
            const files = pendingTreeDelete.files;
            setPendingTreeDelete(null);
            void (async () => {
              try {
                await Promise.all(files.map((file) => fileService.remove(file.path)));
                handleFilesRemoved(files.map((file) => file.path));
                onChanged?.();
                toast.success(t("file_manager.action_success", "File operation completed"));
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t("file_manager.action_failed", "File operation failed"));
                onChanged?.();
              }
            })();
          }}
          onCancel={() => setPendingTreeDelete(null)}
        />
    </div>,
    document.body,
  );
};

export default FileEditorDialog;
