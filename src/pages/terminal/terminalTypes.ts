export interface TerminalClient {
  uuid: string;
  name: string;
  os: string;
  weight?: number;
}

export interface TerminalTab {
  id: string;
  uuid: string;
  title: string;
  color: string | null;
}

export type CloseMode = "current" | "left" | "right" | "others";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export const TAB_COLORS = [
  "#dc143c",
  "#4682b4",
  "#3cb371",
  "#ff8c00",
  "#c71585",
  "#1e90ff",
  "#32cd32",
  "#eab308",
  "#8a2be2",
  "#6a5acd",
  "#00ff00",
  "#d2b48c",
  "#ff00ff",
  "#00ffff",
  "#87ceeb",
  "#a9a9a9",
];

export const MIN_TAB_WIDTH = 120;
export const MAX_TAB_WIDTH = 260;
export const ACTIONS_RESERVED_WIDTH = 76;
export const SCROLL_BUTTONS_WIDTH = 56;

export const TAB_SCROLL_BUTTON_CLASS_NAME =
  "inline-flex h-7 w-7 flex-[0_0_28px] cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent text-neutral-400 transition-colors duration-150 hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-20";

export const TAB_SEPARATOR_CLASS_NAME =
  "h-3.5 w-px shrink-0 self-center rounded-full bg-neutral-700 transition-opacity";

export const TAB_ACTION_CLASS_NAME =
  "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent text-neutral-400 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none";

export const TERMINAL_CALLOUT_CLASS_NAME =
  "rounded-lg border border-red-800/60 bg-red-950/80 text-red-300 backdrop-blur-md";

export const createTabId = () => `terminal-tab-${crypto.randomUUID()}`;

export const createTab = (
  client: TerminalClient,
  title = client.name,
  fallbackTitle = "Server",
): TerminalTab => ({
  id: createTabId(),
  uuid: client.uuid,
  title: title || client.name || fallbackTitle,
  color: null,
});
