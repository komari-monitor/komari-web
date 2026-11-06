import { useState, useRef, useLayoutEffect, useMemo, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
    COMMAND_EDITOR_COLLAPSED_HEIGHT,
    COMMAND_EDITOR_COLLAPSED_LINES,
    COMMAND_EDITOR_ID,
    COMMAND_EDITOR_LINE_HEIGHT_VAR,
    COMMAND_EDITOR_LINE_NUMBER_LIMIT,
    COMMAND_EDITOR_VERTICAL_PADDING_VAR,
    getCommandEditorBorderHeight,
    getCommandEditorCollapsedHeight,
} from "./editorLayout";

/** 带行号的命令输入框：失焦时收起为 3 行，聚焦时按内容展开（最高 60vh） */
const CommandEditor = ({
    command,
    onCommandChange,
    onKeyDown,
}: {
    command: string;
    onCommandChange: (command: string) => void;
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}) => {
    const { t } = useTranslation();
    const [commandFocused, setCommandFocused] = useState(false);
    const [commandEditorHeight, setCommandEditorHeight] = useState(COMMAND_EDITOR_COLLAPSED_HEIGHT);

    const commandTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const commandEditorRef = useRef<HTMLDivElement | null>(null);
    const commandLineGutterRef = useRef<HTMLDivElement | null>(null);

    const commandLineCount = useMemo(() => {
        return command === "" ? 1 : command.split("\n").length;
    }, [command]);

    const commandLineLabels = useMemo(() => {
        if (commandFocused) {
            const renderedLineCount = Math.min(commandLineCount, COMMAND_EDITOR_LINE_NUMBER_LIMIT);
            const labels = Array.from({ length: renderedLineCount }, (_, index) => String(index + 1));

            if (commandLineCount > renderedLineCount) {
                labels.push(`+${commandLineCount - renderedLineCount}`);
            }

            return labels;
        }

        if (commandLineCount <= COMMAND_EDITOR_COLLAPSED_LINES) {
            return Array.from({ length: commandLineCount }, (_, index) => String(index + 1));
        }

        const visibleNumberedLines = COMMAND_EDITOR_COLLAPSED_LINES - 1;
        const remainingLines = commandLineCount - visibleNumberedLines;
        return [
            ...Array.from({ length: visibleNumberedLines }, (_, index) => String(index + 1)),
            `+${remainingLines}`,
        ];
    }, [commandFocused, commandLineCount]);

    const commandEditorStyle = useMemo<CSSProperties>(() => ({
        [COMMAND_EDITOR_LINE_HEIGHT_VAR]: "1.5rem",
        [COMMAND_EDITOR_VERTICAL_PADDING_VAR]: "1.5rem",
        height: commandEditorHeight,
        maxHeight: commandFocused ? "60vh" : COMMAND_EDITOR_COLLAPSED_HEIGHT,
    }), [commandEditorHeight, commandFocused]);

    useLayoutEffect(() => {
        const textarea = commandTextareaRef.current;
        if (!textarea) {
            return;
        }

        if (!commandFocused) {
            textarea.scrollTop = 0;
            if (commandLineGutterRef.current) {
                commandLineGutterRef.current.scrollTop = 0;
            }
            setCommandEditorHeight(COMMAND_EDITOR_COLLAPSED_HEIGHT);
            return;
        }

        textarea.style.height = "0px";

        const measuredHeight = textarea.scrollHeight + getCommandEditorBorderHeight(commandEditorRef.current);
        const collapsedHeight = getCommandEditorCollapsedHeight(textarea, commandEditorRef.current);

        setCommandEditorHeight(`${Math.max(collapsedHeight, measuredHeight)}px`);
        textarea.style.height = "100%";
    }, [command, commandFocused]);

    return (
            <div
                ref={commandEditorRef}
                className="grid grid-cols-[3.75rem_minmax(0,1fr)] overflow-hidden rounded-md border border-[var(--gray-a7)] bg-[var(--color-surface)] transition-[height,border-color,box-shadow] duration-200 focus-within:border-[var(--accent-8)] focus-within:shadow-[0_0_0_1px_var(--accent-8)]"
                style={commandEditorStyle}
            >
                <div
                    ref={commandLineGutterRef}
                    aria-hidden="true"
                    className="km-exec-editor-gutter select-none overflow-hidden border-r border-[var(--gray-a5)] bg-[var(--gray-2)] px-2 text-right font-mono text-xs text-[var(--gray-11)] [line-height:var(--command-editor-line-height)] [padding-bottom:calc(var(--command-editor-vertical-padding)/2)] [padding-top:calc(var(--command-editor-vertical-padding)/2)]"
                >
                    {commandLineLabels.map((label, index) => (
                        <div
                            key={`${label}-${index}`}
                            className={label.startsWith("+") ? "font-medium text-[var(--accent-11)]" : undefined}
                        >
                            {label}
                        </div>
                    ))}
                </div>
                <textarea
                    id={COMMAND_EDITOR_ID}
                    ref={commandTextareaRef}
                    value={command}
                    onChange={(e) => onCommandChange(e.target.value)}
                    onFocus={() => setCommandFocused(true)}
                    onBlur={() => setCommandFocused(false)}
                    onKeyDown={onKeyDown}
                    onScroll={(event) => {
                        if (commandLineGutterRef.current) {
                            commandLineGutterRef.current.scrollTop = event.currentTarget.scrollTop;
                        }
                    }}
                    placeholder={t("exec.commandPlaceholder")}
                    rows={COMMAND_EDITOR_COLLAPSED_LINES}
                    wrap="soft"
                    spellCheck={false}
                    className="km-exec-editor-input h-full w-full resize-none border-0 bg-transparent px-3 font-mono text-sm text-[var(--gray-12)] outline-none placeholder:text-[var(--gray-9)] [line-height:var(--command-editor-line-height)] [padding-bottom:calc(var(--command-editor-vertical-padding)/2)] [padding-top:calc(var(--command-editor-vertical-padding)/2)]"
                    style={{
                        maxHeight: commandFocused ? "60vh" : COMMAND_EDITOR_COLLAPSED_HEIGHT,
                        overflowY: commandFocused ? "auto" : "hidden",
                        overflowWrap: "break-word",
                        whiteSpace: "pre-wrap",
                    }}
                />
            </div>
    );
};

export default CommandEditor;
