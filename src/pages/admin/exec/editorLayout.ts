export const COMMAND_EDITOR_ID = "remote-exec-command-editor";
export const COMMAND_EDITOR_COLLAPSED_LINES = 3;
export const COMMAND_EDITOR_LINE_HEIGHT_VAR = "--command-editor-line-height";
export const COMMAND_EDITOR_VERTICAL_PADDING_VAR = "--command-editor-vertical-padding";
export const COMMAND_EDITOR_COLLAPSED_HEIGHT = `calc(${COMMAND_EDITOR_COLLAPSED_LINES} * var(${COMMAND_EDITOR_LINE_HEIGHT_VAR}) + var(${COMMAND_EDITOR_VERTICAL_PADDING_VAR}))`;
export const COMMAND_EDITOR_LINE_NUMBER_LIMIT = 500;

export const parsePixelValue = (value: string) => {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
};

export const getCommandEditorBorderHeight = (element: HTMLElement | null) => {
    if (!element) {
        return 0;
    }

    const style = window.getComputedStyle(element);
    return parsePixelValue(style.borderTopWidth) + parsePixelValue(style.borderBottomWidth);
};

export const getCommandEditorCollapsedHeight = (textarea: HTMLTextAreaElement, editor: HTMLElement | null) => {
    const style = window.getComputedStyle(textarea);
    const lineHeight = parsePixelValue(style.lineHeight);
    const verticalPadding = parsePixelValue(style.paddingTop) + parsePixelValue(style.paddingBottom);

    return COMMAND_EDITOR_COLLAPSED_LINES * lineHeight + verticalPadding + getCommandEditorBorderHeight(editor);
};
