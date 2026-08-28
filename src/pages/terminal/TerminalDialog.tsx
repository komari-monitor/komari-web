import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const dialogSurface =
  "w-full overflow-visible rounded-[6px] border border-[#454545] bg-[#252526] text-[#cccccc] shadow-2xl";
const secondaryButton =
  "inline-flex h-7 items-center justify-center rounded-[4px] border border-[#3c3c3c] bg-transparent px-3 text-xs text-[#cccccc] hover:bg-[#2a2d2e]";
const dangerButton =
  "inline-flex h-7 items-center justify-center rounded-[4px] border-0 bg-[#a1260d] px-3 text-xs text-white hover:bg-[#c42b1c] disabled:opacity-60";
const primaryButton =
  "inline-flex h-7 items-center justify-center rounded-[4px] border-0 bg-[#007acc] px-3 text-xs text-white hover:bg-[#1b8ad4] disabled:opacity-60";

export interface DialogField {
  key: string;
  label?: string;
  placeholder?: string;
  value: string;
  suggestions?: string[];
  onChange: (value: string) => void;
  onSelectSuggestion?: (value: string) => void;
}

export interface TerminalDialogProps {
  open: boolean;
  title: string;
  description?: string;
  fields?: DialogField[];
  secondaryLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  submitting?: boolean;
  selectSubmits?: boolean;
  autoHighlight?: boolean;
  onSecondary?: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function TerminalDialog({
  open,
  title,
  description,
  fields = [],
  secondaryLabel,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  destructive = false,
  submitting = false,
  selectSubmits = false,
  autoHighlight = false,
  onSecondary,
  onSubmit,
  onCancel,
}: TerminalDialogProps) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const firstFieldKey = fields[0]?.key ?? null;

  const activeSuggestions = useMemo(() => {
    if (!activeField) return [];
    const field = fields.find((item) => item.key === activeField);
    return (field?.suggestions ?? []).slice(0, 24);
  }, [activeField, fields]);

  const selectedIndex = autoHighlight && activeSuggestion === -1 && activeSuggestions.length > 0
    ? 0
    : activeSuggestion;

  useEffect(() => {
    if (!open) return;
    setActiveField(firstFieldKey);
    setActiveSuggestion(-1);
    const timer = window.setTimeout(() => {
      (fields.length ? firstInputRef.current : confirmRef.current)?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fields.length, firstFieldKey, open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel();
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  const isInput = fields.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[100010] flex items-start justify-center bg-black/60 px-4"
      onKeyDown={(event) => {
        if (event.key === "Enter" && !isInput && !submitting) {
          event.preventDefault();
          onSubmit();
        }
        if (event.key === "Enter" && selectedIndex >= 0) {
          event.preventDefault();
          const field = fields.find((item) => item.key === activeField);
          const suggestion = activeSuggestions[selectedIndex];
          if (field && suggestion) {
            field.onChange(suggestion);
            field.onSelectSuggestion?.(suggestion);
            setActiveSuggestion(selectedIndex);
            if (selectSubmits && !submitting) onSubmit();
          }
          return;
        }
        if (event.key === "Enter" && isInput && !submitting) {
          event.preventDefault();
          onSubmit();
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveSuggestion((current) => {
            const base = autoHighlight && current === -1 ? 0 : current;
            return activeSuggestions.length === 0 ? -1 : (base + 1) % activeSuggestions.length;
          });
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveSuggestion((current) => {
            const base = autoHighlight && current === -1 ? 0 : current;
            return activeSuggestions.length === 0 ? -1 : (base - 1 + activeSuggestions.length) % activeSuggestions.length;
          });
        }
      }}
    >
      <div
        className={`mt-[12vh] h-fit w-full ${isInput ? "max-w-[440px]" : "max-w-[320px]"} ${dialogSurface} max-w-[92vw]`}
        onMouseDown={(event) => event.stopPropagation()}
        role={isInput ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-label={title}
      >
        <div className="px-4 pb-3 pt-4">
          <h2 className="text-sm font-medium text-[#eeeeee]">{title}</h2>
          {description && (
            <p className="mt-2 text-xs leading-5 text-[#bdbdbd]">{description}</p>
          )}
          {fields.length > 0 && (
            <div className="mt-3 grid gap-3">
              {fields.map((field, fieldIndex) => {
                const suggestions = activeField === field.key
                  ? activeSuggestions
                  : field.suggestions?.slice(0, 24) ?? [];
                return (
                  <label key={field.key} className="block text-xs text-[#bdbdbd]">
                    {field.label && <span className="mb-1 block">{field.label}</span>}
                    <div className="relative">
                      <input
                        ref={fieldIndex === 0 ? firstInputRef : undefined}
                        value={field.value}
                        placeholder={field.placeholder}
                        onFocus={() => {
                          setActiveField(field.key);
                          setActiveSuggestion(-1);
                        }}
                        onChange={(event) => {
                          field.onChange(event.target.value);
                          setActiveSuggestion(-1);
                        }}
                        className="h-8 w-full rounded-[4px] border border-[#3c3c3c] bg-[#1e1e1e] px-2 text-xs text-[#eeeeee] outline-none focus:border-[#007acc]"
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-[min(55vh,480px)] overflow-y-auto overscroll-contain rounded-md border border-neutral-800 bg-[#161616] p-1 shadow-2xl">
                          {suggestions.map((suggestion, index) => (
                            <button
                              key={suggestion}
                              type="button"
                              className={`block w-full truncate rounded-[4px] border-0 px-2 py-1.5 text-left text-xs transition-colors ${
                                index === selectedIndex
                                  ? "bg-neutral-800 text-white"
                                  : "bg-transparent text-neutral-200 hover:bg-neutral-800 hover:text-white"
                              }`}
                              onMouseEnter={() => setActiveSuggestion(index)}
                              onClick={() => {
                                field.onChange(suggestion);
                                field.onSelectSuggestion?.(suggestion);
                                setActiveSuggestion(-1);
                                if (selectSubmits && !submitting) onSubmit();
                              }}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#2b2b2b] px-3 py-3">
          <button type="button" className={secondaryButton} onClick={onCancel}>
            {cancelLabel}
          </button>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              className={dangerButton}
              disabled={submitting}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </button>
          )}
          <button
            ref={isInput ? undefined : confirmRef}
            type="button"
            disabled={submitting}
            className={destructive && !isInput && !onSecondary ? dangerButton : primaryButton}
            onClick={onSubmit}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default TerminalDialog;
