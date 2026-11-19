import { createPortal } from "react-dom";
import {
  Columns2,
  Copy,
  Download,
  FileCode2,
  FolderOpen,
  Gauge,
  Palette,
  Pencil,
  Rows2,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { CONTROL_MOTION } from "@/lib/motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TAB_COLORS,
  type CloseMode,
  type ContextMenuPosition,
  type TerminalTab,
} from "./terminalTypes";
import type { SplitZone } from "./splitTree";

interface TabMenuProps {
  tab: TerminalTab;
  index: number;
  total: number;
  open: boolean;
  position: ContextMenuPosition | null;
  orientation?: "horizontal" | "vertical";
  resourceWindowOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onDuplicate: () => void;
  onExportText: () => void;
  onFind: () => void;
  onOpenFileManager?: () => void;
  onOpenEditor?: () => void;
  onToggleResourceWindow?: () => void;
  onColor: (color: string | null) => void;
  onClose: (mode: CloseMode) => void;
  onSplit?: (zone: SplitZone) => void;
}

const TabMenu = ({
  tab,
  index,
  total,
  open,
  position,
  orientation = "horizontal",
  resourceWindowOpen = false,
  onOpenChange,
  onRename,
  onDuplicate,
  onExportText,
  onFind,
  onOpenEditor,
  onToggleResourceWindow,
  onOpenFileManager,
  onColor,
  onClose,
  onSplit,
}: TabMenuProps) => {
  const { t } = useTranslation();
  const isVertical = orientation === "vertical";

  const menu = (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <span
          className="fixed h-px w-px pointer-events-none opacity-0"
          style={{
            left: position ? `${position.x}px` : "0px",
            top: position ? `${position.y}px` : "0px",
          }}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={0}
        themeAppearance="dark"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        className="min-w-[170px] !border-neutral-800 !bg-[#161616] !text-neutral-200 backdrop-blur-md"
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            <Palette size={14} />
            <span>{t("terminal.color_tab", "更改选项卡颜色")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            themeAppearance="dark"
            className="w-[160px] !border-neutral-800 !bg-[#161616] !text-neutral-200 p-2 backdrop-blur-md"
          >
            <div className="grid grid-cols-4 gap-1.5">
              {TAB_COLORS.map((color) => (
                <motion.button
                  key={color}
                  type="button"
                  onClick={() => onColor(color)}
                  whileHover={CONTROL_MOTION.hover}
                  whileTap={CONTROL_MOTION.tap}
                  transition={CONTROL_MOTION.transition}
                  className="h-5 w-5 rounded-full border border-black/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
            {tab.color && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onColor(null)}>
                  {t("terminal.default_color", "默认颜色")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem
          onSelect={() => {
            onOpenChange(false);
            requestAnimationFrame(() => {
              onRename();
            });
          }}
          className="flex items-center gap-2"
        >
          <Pencil size={14} />
          <span>{t("terminal.rename_tab", "重命名选项卡")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onDuplicate} className="flex items-center gap-2">
          <Copy size={14} />
          <span>{t("terminal.duplicate_tab", "复制标签页")}</span>
        </DropdownMenuItem>

        {onSplit && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2">
              <Columns2 size={14} />
              <span>{t("terminal.split.menu", "分屏拆分")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              themeAppearance="dark"
              className="min-w-[148px] !border-neutral-800 !bg-[#161616] !text-neutral-200 backdrop-blur-md"
            >
              <DropdownMenuItem
                onSelect={() => onSplit("right")}
                className="flex items-center gap-2"
              >
                <Columns2 size={14} />
                <span>{t("terminal.split.right", "向右分屏")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onSplit("left")}
                className="flex items-center gap-2"
              >
                <Columns2 size={14} />
                <span>{t("terminal.split.left", "向左分屏")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onSplit("bottom")}
                className="flex items-center gap-2"
              >
                <Rows2 size={14} />
                <span>{t("terminal.split.down", "向下分屏")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onSplit("top")}
                className="flex items-center gap-2"
              >
                <Rows2 size={14} />
                <span>{t("terminal.split.up", "向上分屏")}</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuItem onSelect={onExportText} className="flex items-center gap-2">
          <Download size={14} />
          <span>{t("terminal.export_text", "导出文本")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onFind} className="flex items-center gap-2">
          <Search size={14} />
          <span>{t("terminal.find", "查找")}</span>
        </DropdownMenuItem>

        {onToggleResourceWindow && (
          <DropdownMenuItem
            onSelect={onToggleResourceWindow}
            className="flex items-center gap-2"
          >
            <Gauge size={14} />
            <span>
              {resourceWindowOpen
                ? t("terminal.resource_monitor.close", "关闭资源小窗")
                : t("terminal.resource_monitor.open", "打开资源小窗")}
            </span>
          </DropdownMenuItem>
        )}

        {(onOpenFileManager || onOpenEditor) && (
          <>
            <DropdownMenuSeparator />

            {onOpenFileManager && (
              <DropdownMenuItem onSelect={onOpenFileManager} className="flex items-center gap-2">
                <FolderOpen size={14} />
                <span>{t("file_manager.title", "文件管理")}</span>
              </DropdownMenuItem>
            )}

            {onOpenEditor && (
              <DropdownMenuItem onSelect={onOpenEditor} className="flex items-center gap-2">
                <FileCode2 size={14} />
                <span>{t("file_manager.open_in_editor", "在编辑器中打开")}</span>
              </DropdownMenuItem>
            )}
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            <X size={14} />
            <span>{t("terminal.close_tabs", "关闭")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            themeAppearance="dark"
            className="min-w-[130px] border border-neutral-800 bg-[#161616]/95 backdrop-blur-md"
          >
            <DropdownMenuItem
              onSelect={() => onClose("left")}
              disabled={index === 0}
            >
              {isVertical
                ? t("terminal.close_above", "上方")
                : t("terminal.close_to_left", "左侧")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onClose("right")}
              disabled={index === total - 1}
            >
              {isVertical
                ? t("terminal.close_below", "下方")
                : t("terminal.close_to_right", "右侧")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onClose("others")}
              disabled={total <= 1}
            >
              {t("terminal.close_others", "其他")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem
          onSelect={() => onClose("current")}
          className="flex items-center gap-2 text-red-400 focus:text-red-300"
        >
          <X size={14} />
          <span>{t("terminal.close_tab", "关闭标签页")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (typeof document === "undefined") {
    return menu;
  }

  return createPortal(menu, document.body);
};

export default TabMenu;
