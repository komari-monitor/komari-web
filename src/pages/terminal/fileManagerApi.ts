import chardet from "chardet";
export const MAX_EDITABLE_FILE_SIZE = 4 * 1024 * 1024;
export const MAX_IMAGE_PREVIEW_SIZE = 50 * 1024 * 1024;
export const MAX_AUDIO_PREVIEW_SIZE = 50 * 1024 * 1024;
export const MAX_VIDEO_PREVIEW_SIZE = 2 * 1024 * 1024 * 1024;
export const TRANSFER_CHUNK_SIZE = 6 * 1024 * 1024;

export interface RemoteFileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
  size: number;
  mode: string;
  mode_octal: string;
  uid: number;
  gid: number;
  owner: string;
  group: string;
  modified_at: string;
  target?: string;
}

export interface RemoteFileReadResult {
  data: string;
  size: number;
  modified_at: string;
  content_type: string;
  binary: boolean;
}

export const REMOTE_TEXT_ENCODINGS = [
  { value: "utf-8", label: "UTF-8" },
  { value: "gb18030", label: "GB18030 / GBK" },
  { value: "big5", label: "Big5" },
] as const;

export type RemoteTextEncoding = (typeof REMOTE_TEXT_ENCODINGS)[number]["value"];

export interface RemoteSearchMatch {
  path: string;
  line: number;
  text?: string;
  is_dir: boolean;
}

export interface RemoteSearchResult {
  matches: RemoteSearchMatch[];
  limited: boolean;
}

export const normalizeRemotePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/\/{2,}/g, "/");

export const remoteBasename = (value: string) => {
  const source = normalizeRemotePath(value);
  if (source === "/") {
    return "/";
  }
  const normalized = source.replace(/\/$/, "");
  if (/^[A-Za-z]:$/.test(normalized)) {
    return `${normalized}/`;
  }
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(index + 1) || "/" : normalized;
};

export const remoteDirname = (value: string) => {
  const normalized = normalizeRemotePath(value).replace(/\/$/, "");
  if (normalized === "" || normalized === "/") {
    return "/";
  }
  if (/^[A-Za-z]:$/.test(normalized)) {
    return `${normalized}/`;
  }
  const index = normalized.lastIndexOf("/");
  if (index < 0) {
    return ".";
  }
  if (index === 0) {
    return "/";
  }
  const parent = normalized.slice(0, index);
  return /^[A-Za-z]:$/.test(parent) ? `${parent}/` : parent;
};

export const joinRemotePath = (directory: string, name: string) => {
  const base = normalizeRemotePath(directory);
  const separator = base.endsWith("/") ? "" : "/";
  return normalizeRemotePath(`${base}${separator}${name}`);
};

export const resolveSymlinkTargetPath = (file: RemoteFileInfo) => {
  if (!file.is_symlink || !file.target) {
    return null;
  }
  const target = normalizeRemotePath(file.target);
  if (/^[A-Za-z]:\//.test(target) || target.startsWith("/")) {
    return target;
  }
  return joinRemotePath(remoteDirname(file.path), target);
};

export const sortRemoteFiles = <T extends RemoteFileInfo>(files: T[]) =>
  [...(Array.isArray(files) ? files : [])].sort((left, right) => {
    if (left.is_dir !== right.is_dir) {
      return left.is_dir ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });

export const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "-";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[index]}`;
};

export const copyTextToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
};

export const formatClipboardPath = (value: string) => {
  const normalized = normalizeRemotePath(value);
  const windowsPath = normalized.replace(/^\/([A-Za-z])(?:\/|$)/, (_match, drive: string) => `${drive}:\\`);
  const converted = windowsPath.replace(/^([A-Za-z]:\\.*)$/, (path) => path.replace(/\//g, "\\"));
  return /\s/.test(converted) ? `"${converted.replace(/"/g, '\\"')}"` : converted;
};

export const formatFileDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const decodeRemoteBytes = (encoded: string) => {
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const isSupportedRemoteTextEncoding = (value: string): value is RemoteTextEncoding =>
  REMOTE_TEXT_ENCODINGS.some((encoding) => encoding.value === value);

export const normalizeRemoteTextEncoding = (value: string | null | undefined): RemoteTextEncoding | null => {
  const normalized = value?.trim().toLowerCase().replace(/[_\s]/g, "-") ?? "";
  if (["utf-8", "utf8", "unicode"].includes(normalized)) return "utf-8";
  if (["gb18030", "gbk", "gb2312", "gb-2312"].includes(normalized)) return "gb18030";
  if (["big5", "big-5", "big5-hkscs"].includes(normalized)) return "big5";
  return isSupportedRemoteTextEncoding(normalized) ? normalized : null;
};

export const decodeRemoteTextBytes = (bytes: Uint8Array, encoding: RemoteTextEncoding = "utf-8") =>
  new TextDecoder(encoding).decode(bytes);

const textQualityScore = (value: string) => {
  let score = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character === "\uFFFD") {
      score -= 18;
    } else if (character === "\n" || character === "\r" || character === "\t" || character === "\f") {
      score += 1;
    } else if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      score -= 14;
    } else if ((codePoint >= 0x3400 && codePoint <= 0x9fff) || (codePoint >= 0xf900 && codePoint <= 0xfaff)) {
      score += 3;
    } else {
      score += 1;
    }
  }
  return score;
};

const detectByCandidateScore = (bytes: Uint8Array): RemoteTextEncoding => {
  const candidates = REMOTE_TEXT_ENCODINGS.filter(({ value }) => value !== "utf-8");
  let best = candidates[0]?.value ?? "gb18030";
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const score = textQualityScore(decodeRemoteTextBytes(bytes, candidate.value));
    if (score > bestScore) {
      best = candidate.value;
      bestScore = score;
    }
  }
  return best;
};

export const detectRemoteTextEncoding = (bytes: Uint8Array): RemoteTextEncoding => {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "utf-8";
  } catch {
    const detected = normalizeRemoteTextEncoding(chardet.detect(bytes));
    return detected && detected !== "utf-8" ? detected : detectByCandidateScore(bytes);
  }
};

export const decodeRemoteText = (encoded: string, encoding: RemoteTextEncoding = "utf-8") =>
  decodeRemoteTextBytes(decodeRemoteBytes(encoded), encoding);

let legacyEncoderModulePromise: Promise<typeof import("@zxing/text-encoding/es2015/encoding")> | null = null;

const loadLegacyTextEncoder = async () => {
  legacyEncoderModulePromise ??= (async () => {
    const [encodingModule, indexesModule] = await Promise.all([
      import("@zxing/text-encoding/es2015/encoding"),
      import("@zxing/text-encoding/es2015/encoding-indexes"),
    ]);
    const scope = globalThis as typeof globalThis & {
      TextEncodingIndexes?: { encodingIndexes: typeof indexesModule.encodingIndexes };
    };
    scope.TextEncodingIndexes ??= { encodingIndexes: indexesModule.encodingIndexes };
    return encodingModule;
  })();
  const module = await legacyEncoderModulePromise;
  return module.TextEncoder;
};

export const encodeRemoteTextBytes = async (value: string, encoding: RemoteTextEncoding = "utf-8") => {
  if (encoding === "utf-8") {
    return new TextEncoder().encode(value);
  }
  const LegacyTextEncoder = await loadLegacyTextEncoder();
  return new LegacyTextEncoder(encoding, {
    NONSTANDARD_allowLegacyEncoding: true,
    fatal: true,
  }).encode(value);
};

export const encodeRemoteTextBlob = async (value: string, encoding: RemoteTextEncoding = "utf-8") =>
  new Blob([await encodeRemoteTextBytes(value, encoding)], { type: "application/octet-stream" });

export const remoteAncestors = (path: string) => {
  const normalizedPath = normalizeRemotePath(path);
  const segments: string[] = [];
  const driveMatch = normalizedPath.match(/^([A-Za-z]:)(?:\/|$)/);
  let rest = driveMatch ? normalizedPath.slice(driveMatch[0].length) : normalizedPath.replace(/^\//, "");
  let current = driveMatch ? `${driveMatch[1]}/` : "/";
  segments.push(current);
  for (const segment of rest.split("/")) {
    if (!segment) continue;
    current = current.endsWith("/") ? `${current}${segment}` : `${current}/${segment}`;
    segments.push(current);
  }
  return segments;
};

export const languageFromPath = (path: string) => {
  const name = remoteBasename(path).toLowerCase();
  if (name === "dockerfile") return "dockerfile";
  if (name === "makefile") return "shell";
  const extension = name.includes(".") ? name.split(".").pop() ?? "" : "";
  const languages: Record<string, string> = {
    bash: "shell",
    c: "c",
    cc: "cpp",
    conf: "ini",
    cpp: "cpp",
    cs: "csharp",
    css: "css",
    csv: "plaintext",
    env: "ini",
    go: "go",
    h: "c",
    hpp: "cpp",
    html: "html",
    ini: "ini",
    java: "java",
    js: "javascript",
    json: "json",
    jsonc: "json",
    jsx: "javascript",
    log: "plaintext",
    lua: "lua",
    md: "markdown",
    php: "php",
    ps1: "powershell",
    py: "python",
    rb: "ruby",
    rs: "rust",
    sh: "shell",
    sql: "sql",
    toml: "ini",
    ts: "typescript",
    tsx: "typescript",
    txt: "plaintext",
    vue: "html",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
  };
  return languages[extension] ?? "plaintext";
};

export type FilePreviewKind = "image" | "audio" | "video" | "pdf" | "office" | "text";

export const previewKindForFile = (
  path: string,
  contentType = "",
): FilePreviewKind => {
  const extension = remoteBasename(path).toLowerCase().split(".").pop() ?? "";
  if (
    contentType.startsWith("image/") ||
    ["avif", "bmp", "gif", "heic", "heif", "ico", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"].includes(extension)
  ) {
    return "image";
  }
  if (contentType.startsWith("audio/") || ["aac", "flac", "m4a", "mp3", "ogg", "wav"].includes(extension)) {
    return "audio";
  }
  if (
    contentType.startsWith("video/") ||
    ["3gp", "avi", "flv", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "ts", "webm", "wmv"].includes(extension)
  ) {
    return "video";
  }
  if (contentType === "application/pdf" || extension === "pdf") {
    return "pdf";
  }
  if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension)) {
    return "office";
  }
  return "text";
};

export const maxPreviewSizeForFile = (path: string) => {
  const kind = previewKindForFile(path);
  if (kind === "image") return MAX_IMAGE_PREVIEW_SIZE;
  if (kind === "audio") return MAX_AUDIO_PREVIEW_SIZE;
  if (kind === "video") return MAX_VIDEO_PREVIEW_SIZE;
  if (kind === "office") return Number.MAX_SAFE_INTEGER;
  return MAX_EDITABLE_FILE_SIZE;
};

export const fileDownloadUrl = (uuid: string, path: string, inline = false) => {
  const params = new URLSearchParams({ path });
  if (inline) {
    params.set("inline", "1");
  }
  return `/api/admin/client/${encodeURIComponent(uuid)}/file/download?${params.toString()}`;
};

export const fetchOfficePreviewUrl = async (uuid: string, path: string) => {
  const tokenParams = new URLSearchParams({ path });
  const tokenResponse = await fetch(
    `/api/admin/client/${encodeURIComponent(uuid)}/file/preview-token?${tokenParams.toString()}`,
    { credentials: "include" },
  );
  const tokenPayload = await tokenResponse.json().catch(() => null) as
    | { message?: string; data?: { token?: string } }
    | null;
  if (!tokenResponse.ok || !tokenPayload?.data?.token) {
    throw new Error(tokenPayload?.message || "Failed to create preview token");
  }
  // Keep the externally fetched URL opaque. Office Online has to decode the
  // `src` parameter before requesting it, so embedding a percent-encoded file
  // path here makes non-ASCII paths prone to double-decoding issues. The
  // preview token already binds the client and path on the server.
  const downloadParams = new URLSearchParams({
    inline: "1",
    preview_token: tokenPayload.data.token,
  });
  const source = `${window.location.origin}/api/preview/client/${encodeURIComponent(uuid)}/file/download?${downloadParams.toString()}`;
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(source)}`;
};
