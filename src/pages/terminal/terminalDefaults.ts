import type { ITerminalOptions } from "@xterm/xterm";

export const DEFAULT_TERMINAL_FONT_FAMILY = "'Cascadia Mono', 'Noto Sans SC', monospace";
export const DEFAULT_TERMINAL_FONT_SIZE = 16;
export const DEFAULT_TERMINAL_PADDING = 16;

export const DEFAULT_TERMINAL_OPTIONS: Pick<
  ITerminalOptions,
  | "cursorBlink"
  | "convertEol"
  | "fontFamily"
  | "fontSize"
  | "macOptionIsMeta"
  | "scrollback"
> = {
  cursorBlink: true,
  convertEol: true,
  fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
  fontSize: DEFAULT_TERMINAL_FONT_SIZE,
  macOptionIsMeta: true,
  scrollback: 5000,
};
