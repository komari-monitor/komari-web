import {
  Copy,
  Download,
  Palette,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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

interface TabMenuProps {
  tab: TerminalTab;
  index: number;
  total: number;
  open: boolean;
  position: ContextMenuPosition | null;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onDuplicate: () => void;
  onExportText: () => void;
  onFind: () => void;
  onColor: (color: string | null) => void;
  onClose: (mode: CloseMode) => void;
}

const TabMenu = ({
  tab,
  index,
  total,
  open,
  position,
  onOpenChange,
  onRename,
  onDuplicate,
  onExportText,
  onFind,
  onColor,
  onClose,
}: TabMenuProps) => {
  const { t } = useTranslation();

  return (
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
                <button
                  key={color}
                  type="button"
                  onClick={() => onColor(color)}
                  className="h-5 w-5 rounded-full border border-black/40 transition-transform duration-100 hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
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

        <DropdownMenuItem onSelect={onRename} className="flex items-center gap-2">
          <Pencil size={14} />
          <span>{t("terminal.rename_tab", "重命名选项卡")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onDuplicate} className="flex items-center gap-2">
          <Copy size={14} />
          <span>{t("terminal.duplicate_tab", "复制标签页")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onExportText} className="flex items-center gap-2">
          <Download size={14} />
          <span>{t("terminal.export_text", "导出文本")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onFind} className="flex items-center gap-2">
          <Search size={14} />
          <span>{t("terminal.find", "查找")}</span>
        </DropdownMenuItem>

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
              {t("terminal.close_to_left", "左侧")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onClose("right")}
              disabled={index === total - 1}
            >
              {t("terminal.close_to_right", "右侧")}
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
};

export default TabMenu;
