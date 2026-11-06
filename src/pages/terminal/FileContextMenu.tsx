
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { MOTION_DURATION, MOTION_EASE, MOTION_SPRING } from "@/lib/motion";
import type { ContextMenuPosition } from "./terminalTypes";

export interface ContextMenuItemConfig {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  submenu?: ContextMenuItemConfig[];
  separatorBefore?: boolean;
}

interface FileContextMenuProps {
  open: boolean;
  position: ContextMenuPosition | null;
  items: ContextMenuItemConfig[];
  onOpenChange: (open: boolean) => void;
}

export function FileContextMenu({ open, position, items, onOpenChange }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<ContextMenuPosition | null>(null);
  const hasSubmenus = items.some((item) => item.submenu && item.submenu.length > 0);

  useEffect(() => {
    if (!open) return;
    const close = () => onOpenChange(false);
    const closeIfOutside = (event: PointerEvent) => {
      if (!menuRef.current || !menuRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", closeIfOutside);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", closeIfOutside);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [onOpenChange, open]);

  useLayoutEffect(() => {
    if (!open || !position || !menuRef.current) return;
    // 用未变换的布局尺寸测宽高：进场动画里的 scale 不会影响落位计算
    const { offsetWidth, offsetHeight } = menuRef.current;
    setCoords({
      x: Math.max(4, Math.min(position.x, window.innerWidth - offsetWidth - 4)),
      y: Math.max(4, Math.min(position.y, window.innerHeight - offsetHeight - 4)),
    });
  }, [items, open, position]);

  return (
    createPortal(
      <AnimatePresence initial={false}>
        {open && position && (
          <motion.div
            key="file-context-menu"
            ref={menuRef}
            role="menu"
            // overlay 层：从右键位置「长出来」，先预缩再落位（Anticipation + Arc）
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2 }}
            transition={{
              scale: MOTION_SPRING.soft,
              y: MOTION_SPRING.soft,
              opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
            }}
            style={{
              left: coords?.x ?? position.x,
              top: coords?.y ?? position.y,
              transformOrigin: "top left",
            }}
            className={`pointer-events-auto fixed z-[100000] min-w-[170px] rounded-md border border-neutral-800 bg-[#161616] p-1 text-neutral-200 shadow-2xl backdrop-blur-md ${
              hasSubmenus
                ? "overflow-visible"
                : "max-h-[min(70vh,620px)] overflow-y-auto overscroll-contain"
            }`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {items.map((item) => (
              <ContextMenuItem
                key={item.key}
                item={item}
                onOpenChange={onOpenChange}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    )
  );
}

function ContextMenuItem({
  item,
  depth = 0,
  onOpenChange,
}: {
  item: ContextMenuItemConfig;
  depth?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [submenuPlacement, setSubmenuPlacement] = useState<{
    top: number;
    side: "left" | "right";
  } | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  const openSubmenu = () => {
    if (item.disabled) return;
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setExpanded(true);
  };

  useLayoutEffect(() => {
    if (!expanded || !itemRef.current || !submenuRef.current) {
      setSubmenuPlacement(null);
      return;
    }
    const itemRect = itemRef.current.getBoundingClientRect();
    const submenuRect = submenuRef.current.getBoundingClientRect();
    const gap = 4;
    const side = itemRect.right + gap + submenuRect.width <= window.innerWidth - 4 ? "right" : "left";
    const preferredTop = itemRect.top - 5;
    const maxTop = Math.max(4, window.innerHeight - submenuRect.height - 4);
    const y = Math.max(4, Math.min(preferredTop, maxTop));
    setSubmenuPlacement({ top: y - itemRect.top, side });
  }, [expanded, item.submenu?.length]);

  const scheduleCloseSubmenu = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setExpanded(false);
      closeTimerRef.current = null;
    }, 80);
  };

  if (!item.submenu || item.submenu.length === 0) {
    return (
      <div>
        {item.separatorBefore && <div className="my-1 h-px bg-neutral-800" />}
        <button
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={`flex w-full min-w-0 items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-xs text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white disabled:pointer-events-none disabled:opacity-40 ${
            item.destructive ? "text-red-400 hover:bg-red-500/15 hover:text-red-300" : ""
          }`}
          onClick={() => {
            item.onSelect?.();
            onOpenChange(false);
          }}
        >
          {item.icon}
          <span className="min-w-0 truncate">{item.label}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={itemRef}
      className="relative"
      onMouseEnter={openSubmenu}
      onMouseLeave={scheduleCloseSubmenu}
    >
      {item.separatorBefore && <div className="my-1 h-px bg-neutral-800" />}
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={expanded}
        disabled={item.disabled}
        className={`flex w-full min-w-0 items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-xs text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white disabled:pointer-events-none disabled:opacity-40 ${
          item.destructive ? "text-red-400 hover:bg-red-500/15 hover:text-red-300" : ""
        }`}
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(true);
          }
        }}
      >
        {item.icon}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronRight size={12} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="submenu"
            className="absolute z-[100001]"
            style={{
              top: submenuPlacement?.top ?? -5,
              ...(submenuPlacement?.side === "left"
                ? { right: "calc(100% + 4px)", paddingRight: 4 }
                : { left: "calc(100% + 4px)", paddingLeft: 4 }),
              visibility: submenuPlacement ? "visible" : "hidden",
              transformOrigin:
                submenuPlacement?.side === "left" ? "top right" : "top left",
            }}
            initial={{ opacity: 0, scale: 0.97, x: submenuPlacement?.side === "left" ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.98, x: submenuPlacement?.side === "left" ? 2 : -2 }}
            transition={{
              scale: MOTION_SPRING.snappy,
              x: MOTION_SPRING.snappy,
              opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
            }}
            onMouseEnter={openSubmenu}
            onMouseLeave={scheduleCloseSubmenu}
          >
            <div
              ref={submenuRef}
              role="menu"
              className="relative max-h-[min(70vh,620px)] min-w-[130px] overflow-y-auto overscroll-contain rounded-md border border-neutral-800 bg-[#161616] p-1 shadow-2xl backdrop-blur-md"
            >
              {item.submenu.map((child) => (
                <ContextMenuItem
                  key={child.key}
                  item={child}
                  depth={depth + 1}
                  onOpenChange={onOpenChange}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function useContextMenu() {
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  return {
    contextMenuPosition,
    contextMenuOpen,
    openContextMenu: (event: { clientX: number; clientY: number; preventDefault?: () => void }) => {
      event.preventDefault?.();
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      requestAnimationFrame(() => setContextMenuOpen(true));
    },
    closeContextMenu: () => setContextMenuOpen(false),
    setContextMenuOpen,
  };
}

export default FileContextMenu;
