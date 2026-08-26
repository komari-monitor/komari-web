import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown, CaseSensitive, Regex, X } from "lucide-react";

interface TerminalSearchBarProps {
  open: boolean;
  searchTerm: string;
  resultIndex: number;
  resultCount: number;
  caseSensitive: boolean;
  useRegex: boolean;
  onSearchTermChange: (term: string) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onToggleCaseSensitive: () => void;
  onToggleUseRegex: () => void;
  onClose: () => void;
}

export const TerminalSearchBar: React.FC<TerminalSearchBarProps> = ({
  open,
  searchTerm,
  resultIndex,
  resultCount,
  caseSensitive,
  useRegex,
  onSearchTermChange,
  onFindNext,
  onFindPrevious,
  onToggleCaseSensitive,
  onToggleUseRegex,
  onClose,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        onFindPrevious();
      } else {
        onFindNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const countDisplay =
    searchTerm.length > 0
      ? resultCount > 0
        ? `${resultIndex + 1}/${resultCount}`
        : "0/0"
      : "";

  const toolButtonClassName = (active: boolean) =>
    `inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[4px] transition-colors duration-150 ${
      active
        ? "bg-[color:var(--accent-4)] text-[color:var(--accent-11)]"
        : "text-neutral-400 hover:bg-[#3c3c3c] hover:text-white"
    }`;

  return (
    <div
      className="km-terminal-search-floating absolute right-4 top-3 z-30 flex h-[34px] max-w-[calc(100vw-2rem)] items-center gap-1 rounded-[5px] bg-[#2b2b2b] p-1 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative flex h-full min-w-0 items-center">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          placeholder={t("terminal.search.placeholder", "查找")}
          onChange={(e) => onSearchTermChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-[clamp(132px,32vw,192px)] min-w-0 rounded-tl-[4px] border-0 border-b-2 border-[color:var(--accent-11)] bg-[#1e1e1e] pl-2 pr-12 text-xs text-neutral-100 placeholder-neutral-500 outline-none"
        />
        {countDisplay && (
          <span className="pointer-events-none absolute right-2 shrink-0 text-[11px] text-neutral-300 select-none">
            {countDisplay}
          </span>
        )}
      </div>

      <div className="flex h-full shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onFindPrevious}
          className={toolButtonClassName(false)}
          title={t("terminal.search.prev", "上一个")}
          aria-label={t("terminal.search.prev", "上一个")}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          onClick={onFindNext}
          className={toolButtonClassName(false)}
          title={t("terminal.search.next", "下一个")}
          aria-label={t("terminal.search.next", "下一个")}
        >
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          onClick={onToggleCaseSensitive}
          className={toolButtonClassName(caseSensitive)}
          aria-pressed={caseSensitive}
          title={t("terminal.search.match_case", "区分大小写")}
          aria-label={t("terminal.search.match_case", "区分大小写")}
        >
          <CaseSensitive size={14} />
        </button>
        <button
          type="button"
          onClick={onToggleUseRegex}
          className={toolButtonClassName(useRegex)}
          aria-pressed={useRegex}
          title={t("terminal.search.use_regex", "正则表达式")}
          aria-label={t("terminal.search.use_regex", "正则表达式")}
        >
          <Regex size={14} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className={toolButtonClassName(false)}
          title={t("terminal.search.close", "关闭")}
          aria-label={t("terminal.search.close", "关闭")}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
