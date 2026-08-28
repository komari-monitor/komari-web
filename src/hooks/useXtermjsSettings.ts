import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { ITerminalOptions, ITheme } from "@xterm/xterm";

export const DEFAULT_FONT_FAMILY = "'Cascadia Mono', 'Noto Sans SC', monospace";
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_SCROLLBACK = 5000;
const DEFAULT_CURSOR_BLINK = true;
const DEFAULT_CONVERT_EOL = true;
const DEFAULT_MAC_OPTION_IS_META = true;
const DEFAULT_TERMINAL_PADDING = 16;
const DEFAULT_TRANSPARENT_BACKGROUND = false;
const DEFAULT_CUSTOM_CSS = "";

type XtermStringThemeKey = Exclude<keyof ITheme, "extendedAnsi">;

export const xtermThemeWhitelist: (keyof ITheme)[] = [
  "foreground",
  "background",
  "cursor",
  "cursorAccent",
  "selectionForeground",
  "selectionBackground",
  "selectionInactiveBackground",
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
  "extendedAnsi",
];

export interface ParsedXtermThemeJson {
  theme: Partial<ITheme> | undefined;
  filtered: boolean;
}

export type XtermThemeJsonParseResult =
  | { status: "invalid_json" }
  | { status: "non_object" }
  | ({ status: "ok" } & ParsedXtermThemeJson);

export interface XtermjsTerminalOptions
  extends Pick<
    ITerminalOptions,
    | "cursorBlink"
    | "convertEol"
    | "fontFamily"
    | "fontSize"
    | "macOptionIsMeta"
    | "scrollback"
  > {
  theme?: Partial<ITheme>;
}

export interface XtermjsTerminalOptionsDto {
  cursorBlink: boolean;
  convertEol: boolean;
  fontFamily: string;
  fontSize: number;
  macOptionIsMeta: boolean;
  scrollback: number;
  theme: Record<string, unknown> | null;
}

export interface XtermjsSettingsDto {
  terminalOptions: XtermjsTerminalOptionsDto;
  terminalPadding: number;
  transparentBackground: boolean;
  customCss: string;
}

export interface XtermjsSettings {
  terminalOptions: XtermjsTerminalOptions;
  terminalPadding: number;
  transparentBackground: boolean;
  customCss: string;
}

export const defaultXtermjsSettings: XtermjsSettings = {
  terminalOptions: {
    cursorBlink: DEFAULT_CURSOR_BLINK,
    convertEol: DEFAULT_CONVERT_EOL,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE,
    macOptionIsMeta: DEFAULT_MAC_OPTION_IS_META,
    scrollback: DEFAULT_SCROLLBACK,
    theme: undefined,
  },
  terminalPadding: DEFAULT_TERMINAL_PADDING,
  transparentBackground: DEFAULT_TRANSPARENT_BACKGROUND,
  customCss: DEFAULT_CUSTOM_CSS,
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function createDefaultXtermjsSettings(): XtermjsSettings {
  return {
    terminalOptions: {
      ...defaultXtermjsSettings.terminalOptions,
      theme: undefined,
    },
    terminalPadding: defaultXtermjsSettings.terminalPadding,
    transparentBackground: defaultXtermjsSettings.transparentBackground,
    customCss: defaultXtermjsSettings.customCss,
  };
}

function normalizeNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  minimum: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.trunc(value));
}

function sanitizeThemeObject(value: Record<string, unknown>): ParsedXtermThemeJson {
  const theme: Partial<ITheme> = {};
  let filtered = false;

  for (const [key, rawValue] of Object.entries(value)) {
    if (!xtermThemeWhitelist.includes(key as keyof ITheme)) {
      filtered = true;
      continue;
    }

    if (key === "extendedAnsi") {
      if (
        Array.isArray(rawValue) &&
        rawValue.every(
          (color) => typeof color === "string" && color.trim().length > 0
        )
      ) {
        theme.extendedAnsi = rawValue;
      } else if (rawValue !== undefined) {
        filtered = true;
      }
      continue;
    }

    if (typeof rawValue === "string" && rawValue.trim().length > 0) {
      theme[key as XtermStringThemeKey] = rawValue;
    } else if (rawValue !== undefined) {
      filtered = true;
    }
  }

  return {
    theme: Object.keys(theme).length > 0 ? theme : undefined,
    filtered,
  };
}

export function parseXtermThemeJson(
  rawValue: string
): XtermThemeJsonParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return { status: "invalid_json" };
  }

  if (!isPlainObject(parsed)) {
    return { status: "non_object" };
  }

  return { status: "ok", ...sanitizeThemeObject(parsed) };
}

export function formatXtermThemeJson(value: Partial<ITheme> | undefined): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function sanitizeThemeValue(value: unknown): Partial<ITheme> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  return sanitizeThemeObject(value).theme;
}

export function sanitizeXtermjsSettings(value: unknown): XtermjsSettings {
  const fallback = createDefaultXtermjsSettings();

  if (!isPlainObject(value)) {
    return fallback;
  }

  const terminalOptions = isPlainObject(value.terminalOptions)
    ? value.terminalOptions
    : {};

  return {
    terminalOptions: {
      cursorBlink:
        typeof terminalOptions.cursorBlink === "boolean"
          ? terminalOptions.cursorBlink
          : fallback.terminalOptions.cursorBlink,
      convertEol:
        typeof terminalOptions.convertEol === "boolean"
          ? terminalOptions.convertEol
          : fallback.terminalOptions.convertEol,
      fontFamily: normalizeNonEmptyString(
        terminalOptions.fontFamily,
        fallback.terminalOptions.fontFamily!
      ),
      fontSize: normalizeNumber(
        terminalOptions.fontSize,
        fallback.terminalOptions.fontSize!,
        1
      ),
      macOptionIsMeta:
        typeof terminalOptions.macOptionIsMeta === "boolean"
          ? terminalOptions.macOptionIsMeta
          : fallback.terminalOptions.macOptionIsMeta,
      scrollback: normalizeNumber(
        terminalOptions.scrollback,
        fallback.terminalOptions.scrollback!,
        0
      ),
      theme: sanitizeThemeValue(terminalOptions.theme),
    },
    terminalPadding: normalizeNumber(
      value.terminalPadding,
      fallback.terminalPadding,
      0
    ),
    transparentBackground:
      typeof value.transparentBackground === "boolean"
        ? value.transparentBackground
        : fallback.transparentBackground,
    customCss:
      typeof value.customCss === "string"
        ? value.customCss
        : fallback.customCss,
  };
}

function deserializeXtermTheme(value: unknown): Partial<ITheme> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  return sanitizeThemeObject(value).theme;
}

function getXtermjsErrorMessage(
  message: unknown,
  fallback: string
): string {
  return typeof message === "string" && message.trim().length > 0
    ? message
    : fallback;
}

export function serializeXtermjsSettings(
  settings: XtermjsSettings
): XtermjsSettingsDto {
  const sanitized = sanitizeXtermjsSettings(settings);
  const terminalOptions = sanitized.terminalOptions;

  return {
    terminalOptions: {
      cursorBlink: terminalOptions.cursorBlink ?? DEFAULT_CURSOR_BLINK,
      convertEol: terminalOptions.convertEol ?? DEFAULT_CONVERT_EOL,
      fontFamily: terminalOptions.fontFamily ?? DEFAULT_FONT_FAMILY,
      fontSize: terminalOptions.fontSize ?? DEFAULT_FONT_SIZE,
      macOptionIsMeta: terminalOptions.macOptionIsMeta ?? DEFAULT_MAC_OPTION_IS_META,
      scrollback: terminalOptions.scrollback ?? DEFAULT_SCROLLBACK,
      theme:
        terminalOptions.theme === undefined
          ? null
          : { ...terminalOptions.theme },
    },
    terminalPadding: sanitized.terminalPadding ?? DEFAULT_TERMINAL_PADDING,
    transparentBackground:
      sanitized.transparentBackground ?? DEFAULT_TRANSPARENT_BACKGROUND,
    customCss: sanitized.customCss ?? DEFAULT_CUSTOM_CSS,
  };
}

export function deserializeXtermjsSettings(value: unknown): XtermjsSettings {
  if (!isPlainObject(value)) {
    return createDefaultXtermjsSettings();
  }

  const terminalOptions = isPlainObject(value.terminalOptions)
    ? value.terminalOptions
    : {};

  return sanitizeXtermjsSettings({
    terminalOptions: {
      cursorBlink:
        typeof terminalOptions.cursorBlink === "boolean"
          ? terminalOptions.cursorBlink
          : DEFAULT_CURSOR_BLINK,
      convertEol:
        typeof terminalOptions.convertEol === "boolean"
          ? terminalOptions.convertEol
          : DEFAULT_CONVERT_EOL,
      fontFamily:
        typeof terminalOptions.fontFamily === "string"
          ? terminalOptions.fontFamily
          : DEFAULT_FONT_FAMILY,
      fontSize:
        typeof terminalOptions.fontSize === "number"
          ? terminalOptions.fontSize
          : DEFAULT_FONT_SIZE,
      macOptionIsMeta:
        typeof terminalOptions.macOptionIsMeta === "boolean"
          ? terminalOptions.macOptionIsMeta
          : DEFAULT_MAC_OPTION_IS_META,
      scrollback:
        typeof terminalOptions.scrollback === "number"
          ? terminalOptions.scrollback
          : DEFAULT_SCROLLBACK,
      theme: deserializeXtermTheme(terminalOptions.theme),
    },
    terminalPadding:
      typeof value.terminalPadding === "number"
        ? value.terminalPadding
        : DEFAULT_TERMINAL_PADDING,
    transparentBackground:
      typeof value.transparentBackground === "boolean"
        ? value.transparentBackground
        : DEFAULT_TRANSPARENT_BACKGROUND,
    customCss:
      typeof value.customCss === "string"
        ? value.customCss
        : DEFAULT_CUSTOM_CSS,
  });
}

function parseXtermjsEnvelope(value: unknown): {
  status?: unknown;
  message?: unknown;
  data?: unknown;
} {
  return isPlainObject(value) ? value : {};
}

async function readXtermjsEnvelope(response: Response): Promise<{
  status?: unknown;
  message?: unknown;
  data?: unknown;
}> {
  try {
    return parseXtermjsEnvelope(await response.json());
  } catch {
    return {};
  }
}

function getInvalidXtermjsEnvelopeMessage(): string {
  return "Invalid response envelope from /api/admin/settings/xtermjs";
}

export async function fetchXtermjsSettings(options?: {
  signal?: AbortSignal;
}): Promise<XtermjsSettings> {
  const response = await fetch("/api/admin/settings/xtermjs", {
    signal: options?.signal,
  });

  const json = await readXtermjsEnvelope(response);
  if (!response.ok || json.status !== "success") {
    throw new Error(
      getXtermjsErrorMessage(
        json.message,
        response.ok ? getInvalidXtermjsEnvelopeMessage() : `HTTP ${response.status}`
      )
    );
  }

  return deserializeXtermjsSettings(json.data);
}

export async function saveXtermjsSettings(
  settings: XtermjsSettings,
  options?: { signal?: AbortSignal }
): Promise<XtermjsSettings> {
  const response = await fetch("/api/admin/settings/xtermjs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(serializeXtermjsSettings(settings)),
    signal: options?.signal,
  });

  const json = await readXtermjsEnvelope(response);
  if (!response.ok || json.status !== "success") {
    throw new Error(
      getXtermjsErrorMessage(
        json.message,
        response.ok ? getInvalidXtermjsEnvelopeMessage() : `HTTP ${response.status}`
      )
    );
  }

  return deserializeXtermjsSettings(json.data);
}

export function isTransparentBackground(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized === "transparent" || normalized === "none") {
    return true;
  }

  const isTransparentAlpha = (rawAlpha: string): boolean => {
    const alphaValue = rawAlpha.trim();
    if (!alphaValue) {
      return false;
    }

    if (alphaValue.endsWith("%")) {
      const percentage = Number.parseFloat(alphaValue.slice(0, -1));
      return Number.isFinite(percentage) && percentage < 100;
    }

    const alpha = Number.parseFloat(alphaValue);
    return Number.isFinite(alpha) && alpha < 1;
  };

  const hexMatch = normalized.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    const alphaHex =
      hexMatch[1].length === 4 ? hexMatch[1][3] : hexMatch[1].slice(6, 8);
    return Number.parseInt(alphaHex, 16) < 255;
  }

  const functionalColorMatch = normalized.match(/^(rgba?|hsla?)\((.+)\)$/i);
  if (functionalColorMatch) {
    const colorBody = functionalColorMatch[2];
    const slashAlpha = colorBody.split("/")[1]?.trim();
    if (slashAlpha) {
      return isTransparentAlpha(slashAlpha);
    }

    const parts = colorBody
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 4) {
      return isTransparentAlpha(parts[3]);
    }

    return false;
  }

  return false;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === "AbortError"
      : isPlainObject(error) && error.name === "AbortError"
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useXtermjsSettings() {
  const mountedRef = useRef(true);
  const confirmedSettingsRef = useRef<XtermjsSettings>(defaultXtermjsSettings);
  const pendingSettingsRef = useRef<XtermjsSettings>(defaultXtermjsSettings);
  const latestRevisionRef = useRef(0);
  const mutationEpochRef = useRef(0);
  const queueTailRef = useRef(Promise.resolve());
  const pendingTaskCountRef = useRef(0);
  const [settings, setSettingsState] = useState<XtermjsSettings>(
    defaultXtermjsSettings
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);

  const syncSavingState = useCallback(() => {
    if (mountedRef.current) {
      setSaving(pendingTaskCountRef.current > 0);
    }
  }, []);

  const startQueuedTask = useCallback(
    <T,>(task: () => Promise<T>): Promise<T> => {
      pendingTaskCountRef.current += 1;
      syncSavingState();

      const runTask = () => Promise.resolve().then(task);
      const result = queueTailRef.current.then(runTask, runTask);

      queueTailRef.current = result.then(
        () => undefined,
        () => undefined
      );

      return result.finally(() => {
        pendingTaskCountRef.current -= 1;
        syncSavingState();
      });
    },
    [syncSavingState]
  );

  const applyFetchedSettings = useCallback((nextSettings: XtermjsSettings) => {
    const sanitized = sanitizeXtermjsSettings(nextSettings);
    confirmedSettingsRef.current = sanitized;
    pendingSettingsRef.current = sanitized;

    if (mountedRef.current) {
      setSettingsState(sanitized);
      setError(null);
    }

    return sanitized;
  }, []);

  const refetch = useCallback(
    async (options?: { signal?: AbortSignal }): Promise<XtermjsSettings> => {
      const requestEpoch = mutationEpochRef.current;
      const requestPendingCount = pendingTaskCountRef.current;

      if (mountedRef.current) {
        setLoading(true);
      }

      try {
        const fetched = await fetchXtermjsSettings({ signal: options?.signal });
        const isStale =
          requestEpoch !== mutationEpochRef.current ||
          requestPendingCount !== pendingTaskCountRef.current;

        if (isStale) {
          return sanitizeXtermjsSettings(fetched);
        }

        return mountedRef.current
          ? applyFetchedSettings(fetched)
          : sanitizeXtermjsSettings(fetched);
      } catch (caughtError) {
        if (!isAbortError(caughtError) && mountedRef.current) {
          setError(toError(caughtError));
        }
        throw caughtError;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [applyFetchedSettings]
  );

  const saveSettings = useCallback(
    async (valueOrUpdater: SetStateAction<XtermjsSettings>): Promise<XtermjsSettings> => {
      const baseSettings =
        pendingSettingsRef.current ?? confirmedSettingsRef.current;
      const nextSettings =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(baseSettings)
          : valueOrUpdater;
      const sanitizedNext = sanitizeXtermjsSettings(nextSettings);
      const revision = latestRevisionRef.current + 1;

      latestRevisionRef.current = revision;
      mutationEpochRef.current += 1;
      pendingSettingsRef.current = sanitizedNext;

      return startQueuedTask(async () => {
        try {
          await saveXtermjsSettings(sanitizedNext);
          const confirmed = await fetchXtermjsSettings();

          if (latestRevisionRef.current === revision) {
            confirmedSettingsRef.current = confirmed;
            pendingSettingsRef.current = confirmed;
            if (mountedRef.current) {
              setSettingsState(confirmed);
              setError(null);
            }
          } else {
            confirmedSettingsRef.current = confirmed;
          }

          return confirmed;
        } catch (caughtError) {
          if (latestRevisionRef.current === revision) {
            pendingSettingsRef.current = confirmedSettingsRef.current;
          }

          throw caughtError;
        }
      });
    },
    [startQueuedTask]
  );

  const resetSettings = useCallback(() => {
    return saveSettings(createDefaultXtermjsSettings());
  }, [saveSettings]);

  useEffect(() => {
    const controller = new AbortController();
    mountedRef.current = true;
    void refetch({ signal: controller.signal }).catch(() => {});

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [refetch]);

  return {
    settings,
    loading,
    error,
    saving,
    setSettings: saveSettings,
    resetSettings,
    refetch,
  };
}
