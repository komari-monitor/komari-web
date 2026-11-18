import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { Info, Minus, Plus, RotateCcw, Settings, X } from "lucide-react";
import {
  CONTROL_MOTION,
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
} from "@/lib/motion";
import {
  clampTerminalBackgroundBlur,
  clampTerminalBackgroundOffset,
  clampTerminalBackgroundOpacity,
  clampTerminalBackgroundScale,
  clampTerminalFontSize,
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_SETTINGS,
  MAX_TERMINAL_BACKGROUND_BLUR,
  MAX_TERMINAL_BACKGROUND_OFFSET,
  MAX_TERMINAL_BACKGROUND_OPACITY,
  MAX_TERMINAL_BACKGROUND_SCALE,
  MAX_TERMINAL_FONT_SIZE,
  MIN_TERMINAL_BACKGROUND_BLUR,
  MIN_TERMINAL_BACKGROUND_OFFSET,
  MIN_TERMINAL_BACKGROUND_OPACITY,
  MIN_TERMINAL_BACKGROUND_SCALE,
  MIN_TERMINAL_FONT_SIZE,
  TERMINAL_FONT_PRESETS,
  type TerminalSettings,
} from "./terminalDefaults";

export interface TerminalSettingsDialogProps {
  open: boolean;
  settings: TerminalSettings;
  onChange: (next: TerminalSettings) => void;
  onReset: () => void;
  onClose: () => void;
}

interface NumberSliderControlProps {
  id: string;
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  clamp: (val: number) => number;
  onChange: (val: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}

const NumberSliderControl = ({
  id,
  label,
  unit = "",
  value,
  min,
  max,
  step = 1,
  clamp,
  onChange,
  decreaseLabel,
  increaseLabel,
}: NumberSliderControlProps) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const handleStep = (delta: number) => {
    const next = clamp(value + delta);
    setDraft(String(next));
    onChange(next);
  };

  const handleInputChange = (raw: string) => {
    setDraft(raw);
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === "+") {
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
      onChange(Math.round(parsed));
    }
  };

  const handleBlur = () => {
    const trimmed = draft.trim();
    const parsed = Number(trimmed);
    const clamped = clamp(
      Number.isFinite(parsed) && trimmed !== "" && trimmed !== "-" && trimmed !== "+"
        ? parsed
        : value,
    );
    setDraft(String(clamped));
    if (clamped !== value) {
      onChange(clamped);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-medium text-[#e0e0e0]">
          {label}
        </label>
        <span className="text-[11px] text-neutral-400">
          {min > 0 ? `${min}${unit}` : min < 0 ? `${min}${unit}` : `0${unit}`} –{" "}
          {max > 0 && min < 0 ? `+${max}${unit}` : `${max}${unit}`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = clamp(Number(event.target.value));
            setDraft(String(next));
            onChange(next);
          }}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#007acc]"
          aria-label={label}
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={value <= min}
            onClick={() => handleStep(-step)}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[4px] border border-[#3c3c3c] bg-[#1e1e1e] text-neutral-200 transition-colors hover:bg-[#2a2d2e] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={decreaseLabel}
          >
            <Minus size={13} />
          </button>
          <div className="relative flex items-center">
            <input
              id={id}
              type="text"
              inputMode="numeric"
              value={draft}
              onChange={(event) => handleInputChange(event.target.value)}
              onBlur={handleBlur}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              className={`h-7 rounded-[4px] border border-[#3c3c3c] bg-[#1e1e1e] text-center text-xs text-[#eeeeee] outline-none focus:border-[#007acc] ${
                unit ? "w-14 pr-3.5 pl-1.5" : "w-12 px-1"
              }`}
            />
            {unit && (
              <span className="pointer-events-none absolute right-1.5 text-[10px] text-neutral-400">
                {unit}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={value >= max}
            onClick={() => handleStep(step)}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[4px] border border-[#3c3c3c] bg-[#1e1e1e] text-neutral-200 transition-colors hover:bg-[#2a2d2e] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={increaseLabel}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

const TerminalSettingsDialog = ({
  open,
  settings,
  onChange,
  onReset,
  onClose,
}: TerminalSettingsDialogProps) => {
  const { t } = useTranslation();
  const [fontDraft, setFontDraft] = useState(settings.fontFamily);
  const [bgUrlDraft, setBgUrlDraft] = useState(settings.backgroundUrl);

  useEffect(() => {
    setFontDraft(settings.fontFamily);
  }, [settings.fontFamily]);

  useEffect(() => {
    setBgUrlDraft(settings.backgroundUrl);
  }, [settings.backgroundUrl]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  const handleFontChange = (value: string) => {
    setFontDraft(value);
    if (value.trim()) {
      onChange({
        ...settings,
        fontFamily: value.trim(),
      });
    }
  };

  const handleFontBlur = () => {
    const trimmed = fontDraft.trim();
    if (!trimmed) {
      setFontDraft(DEFAULT_TERMINAL_FONT_FAMILY);
      onChange({
        ...settings,
        fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
      });
    } else if (trimmed !== fontDraft) {
      setFontDraft(trimmed);
    }
  };

  const handleBgUrlChange = (value: string) => {
    setBgUrlDraft(value);
    onChange({
      ...settings,
      backgroundUrl: value.trim(),
    });
  };

  const isDefault =
    settings.fontFamily === DEFAULT_TERMINAL_SETTINGS.fontFamily &&
    settings.fontSize === DEFAULT_TERMINAL_SETTINGS.fontSize &&
    settings.convertEol === DEFAULT_TERMINAL_SETTINGS.convertEol &&
    settings.backgroundUrl === DEFAULT_TERMINAL_SETTINGS.backgroundUrl &&
    settings.backgroundOffsetX === DEFAULT_TERMINAL_SETTINGS.backgroundOffsetX &&
    settings.backgroundOffsetY === DEFAULT_TERMINAL_SETTINGS.backgroundOffsetY &&
    settings.backgroundScale === DEFAULT_TERMINAL_SETTINGS.backgroundScale &&
    settings.backgroundOpacity === DEFAULT_TERMINAL_SETTINGS.backgroundOpacity &&
    settings.backgroundBlur === DEFAULT_TERMINAL_SETTINGS.backgroundBlur;

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="terminal-settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: {
              duration: MOTION_DURATION.fast,
              ease: MOTION_EASE.standard,
            },
          }}
          className="km-terminal-settings-dialog fixed inset-0 z-[100010] flex items-start justify-center bg-black/35 px-4"
          onMouseDown={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("terminal.settings.title", "终端设置")}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{
              scale: MOTION_SPRING.soft,
              y: MOTION_SPRING.soft,
              opacity: {
                duration: MOTION_DURATION.fast,
                ease: MOTION_EASE.standard,
              },
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className="mt-[6vh] flex max-h-[86vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[8px] border border-[#3c3c3c] bg-[#252526]/95 text-[#cccccc] shadow-2xl backdrop-blur-md"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#333333] px-4 py-3">
              <div className="flex items-center gap-2">
                <Settings size={15} className="shrink-0 text-sky-400" />
                <h2 className="text-sm font-medium text-[#eeeeee]">
                  {t("terminal.settings.title", "终端设置")}
                </h2>
              </div>
              <motion.button
                type="button"
                whileTap={CONTROL_MOTION.tap}
                transition={CONTROL_MOTION.transition}
                onClick={onClose}
                className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
                title={t("common.close", "关闭")}
                aria-label={t("common.close", "关闭")}
              >
                <X size={14} />
              </motion.button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {/* Font Family */}
              <div className="space-y-2">
                <label
                  htmlFor="km-terminal-font-family-input"
                  className="block text-xs font-medium text-[#e0e0e0]"
                >
                  {t("terminal.settings.font_family", "终端字体")}
                </label>
                <input
                  id="km-terminal-font-family-input"
                  type="text"
                  value={fontDraft}
                  placeholder={DEFAULT_TERMINAL_FONT_FAMILY}
                  onChange={(event) => handleFontChange(event.target.value)}
                  onBlur={handleFontBlur}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-8 w-full rounded-[4px] border border-[#3c3c3c] bg-[#1e1e1e] px-2.5 text-xs text-[#eeeeee] outline-none transition-colors focus:border-[#007acc]"
                />
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {TERMINAL_FONT_PRESETS.map((preset) => {
                    const active = settings.fontFamily === preset.value;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setFontDraft(preset.value);
                          onChange({
                            ...settings,
                            fontFamily: preset.value,
                          });
                        }}
                        className={`cursor-pointer rounded-[4px] border px-2 py-1 text-[11px] transition-colors ${
                          active
                            ? "border-sky-500/80 bg-sky-500/20 text-sky-300"
                            : "border-[#3c3c3c] bg-[#1e1e1e] text-neutral-300 hover:border-neutral-600 hover:bg-[#2a2d2e] hover:text-white"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size */}
              <NumberSliderControl
                id="km-terminal-font-size-input"
                label={t("terminal.settings.font_size", "字体大小")}
                unit="px"
                value={settings.fontSize}
                min={MIN_TERMINAL_FONT_SIZE}
                max={MAX_TERMINAL_FONT_SIZE}
                step={1}
                clamp={clampTerminalFontSize}
                onChange={(fontSize) =>
                  onChange({
                    ...settings,
                    fontSize,
                  })
                }
                decreaseLabel={t(
                  "terminal.settings.decrease_font_size",
                  "减小字号",
                )}
                increaseLabel={t(
                  "terminal.settings.increase_font_size",
                  "增大字号",
                )}
              />

              {/* Convert EOL */}
              <div className="flex items-center justify-between gap-3 rounded-[6px] border border-[#333333] bg-[#1e1e1e] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[#e0e0e0]">
                    {t("terminal.settings.convert_eol", "开启 EOL 转换")}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-4 text-neutral-400">
                    {t(
                      "terminal.settings.convert_eol_desc",
                      "将每个换行符 (\\n) 视为回车加换行 (\\r\\n)",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.convertEol}
                  onClick={() =>
                    onChange({
                      ...settings,
                      convertEol: !settings.convertEol,
                    })
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:outline-none ${
                    settings.convertEol ? "bg-[#007acc]" : "bg-[#3c3c3c]"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-150 ${
                      settings.convertEol ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Background Image / Video */}
              <div className="space-y-3 rounded-[6px] border border-[#333333] bg-[#1b1b1c] p-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="km-terminal-bg-url-input"
                      className="block text-xs font-medium text-[#e0e0e0]"
                    >
                      {t(
                        "terminal.settings.background_url",
                        "背景图片 / 视频 URL",
                      )}
                    </label>
                    {bgUrlDraft.trim() && (
                      <button
                        type="button"
                        onClick={() => handleBgUrlChange("")}
                        className="cursor-pointer border-0 bg-transparent text-[11px] text-sky-400 hover:text-sky-300"
                      >
                        {t("terminal.settings.clear_background", "清空")}
                      </button>
                    )}
                  </div>
                  <input
                    id="km-terminal-bg-url-input"
                    type="text"
                    value={bgUrlDraft}
                    placeholder={t(
                      "terminal.settings.background_url_placeholder",
                      "https://example.com/bg.webp 或 .mp4 / .webm",
                    )}
                    onChange={(event) => handleBgUrlChange(event.target.value)}
                    onBlur={() => setBgUrlDraft(settings.backgroundUrl)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                    className="h-8 w-full rounded-[4px] border border-[#3c3c3c] bg-[#1e1e1e] px-2.5 text-xs text-[#eeeeee] placeholder-neutral-500 outline-none transition-colors focus:border-[#007acc]"
                  />
                </div>

                {/* X Offset */}
                <NumberSliderControl
                  id="km-terminal-bg-offset-x-input"
                  label={t(
                    "terminal.settings.background_offset_x",
                    "背景水平偏移 (X)",
                  )}
                  unit="%"
                  value={settings.backgroundOffsetX}
                  min={MIN_TERMINAL_BACKGROUND_OFFSET}
                  max={MAX_TERMINAL_BACKGROUND_OFFSET}
                  step={1}
                  clamp={clampTerminalBackgroundOffset}
                  onChange={(backgroundOffsetX) =>
                    onChange({
                      ...settings,
                      backgroundOffsetX,
                    })
                  }
                  decreaseLabel={t(
                    "terminal.settings.decrease_offset_x",
                    "向左偏移",
                  )}
                  increaseLabel={t(
                    "terminal.settings.increase_offset_x",
                    "向右偏移",
                  )}
                />

                {/* Y Offset */}
                <NumberSliderControl
                  id="km-terminal-bg-offset-y-input"
                  label={t(
                    "terminal.settings.background_offset_y",
                    "背景垂直偏移 (Y)",
                  )}
                  unit="%"
                  value={settings.backgroundOffsetY}
                  min={MIN_TERMINAL_BACKGROUND_OFFSET}
                  max={MAX_TERMINAL_BACKGROUND_OFFSET}
                  step={1}
                  clamp={clampTerminalBackgroundOffset}
                  onChange={(backgroundOffsetY) =>
                    onChange({
                      ...settings,
                      backgroundOffsetY,
                    })
                  }
                  decreaseLabel={t(
                    "terminal.settings.decrease_offset_y",
                    "向上偏移",
                  )}
                  increaseLabel={t(
                    "terminal.settings.increase_offset_y",
                    "向下偏移",
                  )}
                />

                {/* Scale */}
                <NumberSliderControl
                  id="km-terminal-bg-scale-input"
                  label={t("terminal.settings.background_scale", "背景缩放")}
                  unit="%"
                  value={settings.backgroundScale}
                  min={MIN_TERMINAL_BACKGROUND_SCALE}
                  max={MAX_TERMINAL_BACKGROUND_SCALE}
                  step={1}
                  clamp={clampTerminalBackgroundScale}
                  onChange={(backgroundScale) =>
                    onChange({
                      ...settings,
                      backgroundScale,
                    })
                  }
                  decreaseLabel={t(
                    "terminal.settings.decrease_scale",
                    "缩小背景",
                  )}
                  increaseLabel={t(
                    "terminal.settings.increase_scale",
                    "放大背景",
                  )}
                />

                {/* Opacity */}
                <NumberSliderControl
                  id="km-terminal-bg-opacity-input"
                  label={t(
                    "terminal.settings.background_opacity",
                    "背景不透明度",
                  )}
                  unit="%"
                  value={settings.backgroundOpacity}
                  min={MIN_TERMINAL_BACKGROUND_OPACITY}
                  max={MAX_TERMINAL_BACKGROUND_OPACITY}
                  step={1}
                  clamp={clampTerminalBackgroundOpacity}
                  onChange={(backgroundOpacity) =>
                    onChange({
                      ...settings,
                      backgroundOpacity,
                    })
                  }
                  decreaseLabel={t(
                    "terminal.settings.decrease_opacity",
                    "降低不透明度",
                  )}
                  increaseLabel={t(
                    "terminal.settings.increase_opacity",
                    "增加不透明度",
                  )}
                />

                {/* Blur */}
                <NumberSliderControl
                  id="km-terminal-bg-blur-input"
                  label={t("terminal.settings.background_blur", "背景模糊度")}
                  unit="px"
                  value={settings.backgroundBlur}
                  min={MIN_TERMINAL_BACKGROUND_BLUR}
                  max={MAX_TERMINAL_BACKGROUND_BLUR}
                  step={1}
                  clamp={clampTerminalBackgroundBlur}
                  onChange={(backgroundBlur) =>
                    onChange({
                      ...settings,
                      backgroundBlur,
                    })
                  }
                  decreaseLabel={t(
                    "terminal.settings.decrease_blur",
                    "减小模糊度",
                  )}
                  increaseLabel={t(
                    "terminal.settings.increase_blur",
                    "增大模糊度",
                  )}
                />
              </div>

              {/* Hint note */}
              <div className="flex items-start gap-1.5 rounded-[5px] bg-[#1a1a1a] px-2.5 py-2 text-[11px] leading-4 text-neutral-400">
                <Info size={13} className="mt-0.5 shrink-0 text-neutral-400" />
                <span>
                  {t(
                    "terminal.settings.refresh_hint",
                    "设置即时生效；对于终端已输出的历史内容或部分字体渲染效果，可能需要刷新页面生效。",
                  )}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-[#333333] px-4 py-2.5">
              <button
                type="button"
                disabled={isDefault}
                onClick={onReset}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[4px] border border-[#3c3c3c] bg-transparent px-2.5 text-xs text-neutral-300 transition-colors hover:bg-[#2a2d2e] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw size={12} />
                {t("terminal.settings.reset", "恢复默认")}
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={MOTION_SPRING.snappy}
                onClick={onClose}
                className="inline-flex h-7 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-[#007acc] px-3.5 text-xs text-white transition-colors hover:bg-[#1b8ad4]"
              >
                {t("common.close", "关闭")}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default TerminalSettingsDialog;
