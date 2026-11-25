import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isEditableEventTarget } from "./fileManagerApi";

export interface MarqueePoint {
  x: number;
  y: number;
}

export interface MarqueeBounds {
  width: number;
  height: number;
}

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type MarqueeSelectionMode = "replace" | "add" | "toggle";

export const MARQUEE_DRAG_THRESHOLD = 3;

export const hasExceededMarqueeThreshold = (
  start: MarqueePoint,
  current: MarqueePoint,
  threshold = MARQUEE_DRAG_THRESHOLD,
): boolean => Math.hypot(current.x - start.x, current.y - start.y) >= threshold;

export const clampMarqueePoint = (
  point: MarqueePoint,
  bounds?: MarqueeBounds,
): MarqueePoint => {
  if (!bounds) return point;
  const maxX = Math.max(0, bounds.width);
  const maxY = Math.max(0, bounds.height);
  return {
    x: Math.min(Math.max(0, point.x), maxX),
    y: Math.min(Math.max(0, point.y), maxY),
  };
};

export const computeMarqueeRect = (
  start: MarqueePoint,
  current: MarqueePoint,
  bounds?: MarqueeBounds,
): MarqueeRect => {
  const clampedStart = clampMarqueePoint(start, bounds);
  const clampedCurrent = clampMarqueePoint(current, bounds);
  const rawLeft = Math.min(clampedStart.x, clampedCurrent.x);
  const rawTop = Math.min(clampedStart.y, clampedCurrent.y);
  const rawRight = Math.max(clampedStart.x, clampedCurrent.x);
  const rawBottom = Math.max(clampedStart.y, clampedCurrent.y);

  const maxWidth = bounds ? Math.max(0, bounds.width) : Infinity;
  const maxHeight = bounds ? Math.max(0, bounds.height) : Infinity;

  const left = Number.isFinite(maxWidth)
    ? Math.min(rawLeft, Math.max(0, maxWidth - 1))
    : rawLeft;
  const top = Number.isFinite(maxHeight)
    ? Math.min(rawTop, Math.max(0, maxHeight - 1))
    : rawTop;
  const width = Number.isFinite(maxWidth)
    ? Math.min(Math.max(1, rawRight - left), Math.max(0, maxWidth - left))
    : Math.max(1, rawRight - left);
  const height = Number.isFinite(maxHeight)
    ? Math.min(Math.max(1, rawBottom - top), Math.max(0, maxHeight - top))
    : Math.max(1, rawBottom - top);

  return { left, top, width, height };
};

export const marqueeRectToBounds = (rect: MarqueeRect): BoundingBox => ({
  left: rect.left,
  top: rect.top,
  right: rect.left + rect.width,
  bottom: rect.top + rect.height,
});

export const rectsIntersect = (a: BoundingBox, b: BoundingBox): boolean =>
  a.right > b.left &&
  a.left < b.right &&
  a.bottom > b.top &&
  a.top < b.bottom;

export const resolveMarqueeSelection = (
  hitPaths: Iterable<string>,
  baseSelection: ReadonlySet<string>,
  mode: MarqueeSelectionMode,
): Set<string> => {
  if (mode === "replace") {
    return new Set(hitPaths);
  }
  const next = new Set(baseSelection);
  for (const path of hitPaths) {
    if (mode === "toggle") {
      if (baseSelection.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
    } else {
      next.add(path);
    }
  }
  return next;
};

const computeEdgeScrollDelta = (
  cursor: number,
  minEdge: number,
  maxEdge: number,
): number => {
  if (cursor < minEdge) {
    return -Math.min(24, Math.max(4, Math.round((minEdge - cursor) * 0.35)));
  }
  if (cursor > maxEdge) {
    return Math.min(24, Math.max(4, Math.round((cursor - maxEdge) * 0.35)));
  }
  return 0;
};

export interface UseMarqueeSelectionOptions {
  containerRef: RefObject<HTMLElement | null>;
  itemSelector: string;
  ignoreSelector: string;
  getItemKey: (element: HTMLElement) => string | null;
  getSelectedPaths: () => ReadonlySet<string>;
  onSelectionChange: (nextSelection: Set<string>) => void;
  onDragStart?: () => void;
  disabled?: boolean;
}

export const useMarqueeSelection = (options: UseMarqueeSelectionOptions) => {
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const marqueeTrackingRef = useRef(false);
  const marqueeActiveRef = useRef(false);
  const justMarqueeSelectedRef = useRef(false);
  const resetJustSelectedTimerRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      if (resetJustSelectedTimerRef.current !== null) {
        window.clearTimeout(resetJustSelectedTimerRef.current);
        resetJustSelectedTimerRef.current = null;
      }
    };
  }, []);

  const consumeJustMarqueeSelected = useCallback(() => {
    if (!justMarqueeSelectedRef.current) return false;
    justMarqueeSelectedRef.current = false;
    if (resetJustSelectedTimerRef.current !== null) {
      window.clearTimeout(resetJustSelectedTimerRef.current);
      resetJustSelectedTimerRef.current = null;
    }
    return true;
  }, []);

  const startMarqueeSelection = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const currentOptions = optionsRef.current;
    if (currentOptions.disabled || event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (!target || isEditableEventTarget(target) || target.closest(currentOptions.ignoreSelector)) {
      return;
    }

    const container = currentOptions.containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - container.clientLeft;
    const offsetY = event.clientY - rect.top - container.clientTop;
    // 忽略滚动条区域，避免拖拽滚动条时误触框选
    if (
      offsetX < 0 ||
      offsetY < 0 ||
      offsetX >= container.clientWidth ||
      offsetY >= container.clientHeight
    ) {
      return;
    }

    cleanupRef.current?.();
    if (resetJustSelectedTimerRef.current !== null) {
      window.clearTimeout(resetJustSelectedTimerRef.current);
      resetJustSelectedTimerRef.current = null;
    }

    const startPoint: MarqueePoint = {
      x: offsetX + container.scrollLeft,
      y: offsetY + container.scrollTop,
    };
    const contentBounds: MarqueeBounds = {
      width: container.scrollWidth,
      height: container.scrollHeight,
    };
    const mode: MarqueeSelectionMode =
      event.ctrlKey || event.metaKey
        ? "toggle"
        : event.shiftKey
          ? "add"
          : "replace";
    const baseSelection = new Set(currentOptions.getSelectedPaths());

    let lastClientX = event.clientX;
    let lastClientY = event.clientY;
    let autoScrollFrame: number | null = null;

    marqueeTrackingRef.current = true;
    marqueeActiveRef.current = false;
    justMarqueeSelectedRef.current = false;
    setMarqueeRect(null);

    const updateFromClientPoint = (clientX: number, clientY: number) => {
      const latestOptions = optionsRef.current;
      const activeContainer = latestOptions.containerRef.current;
      if (!activeContainer) return;

      const activeRect = activeContainer.getBoundingClientRect();
      const originX = activeRect.left + activeContainer.clientLeft - activeContainer.scrollLeft;
      const originY = activeRect.top + activeContainer.clientTop - activeContainer.scrollTop;
      const rawPoint: MarqueePoint = {
        x: clientX - originX,
        y: clientY - originY,
      };

      if (!marqueeActiveRef.current) {
        if (!hasExceededMarqueeThreshold(startPoint, rawPoint)) {
          return;
        }
        marqueeActiveRef.current = true;
        window.getSelection()?.removeAllRanges();
        latestOptions.onDragStart?.();
      }

      const nextRect = computeMarqueeRect(startPoint, rawPoint, contentBounds);
      const selectionBox = marqueeRectToBounds(nextRect);
      const hitPaths: string[] = [];

      activeContainer.querySelectorAll<HTMLElement>(latestOptions.itemSelector).forEach((element) => {
        const key = latestOptions.getItemKey(element);
        if (!key) return;
        const rowRect = element.getBoundingClientRect();
        const rowBox: BoundingBox = {
          left: rowRect.left - originX,
          top: rowRect.top - originY,
          right: rowRect.right - originX,
          bottom: rowRect.bottom - originY,
        };
        if (rectsIntersect(selectionBox, rowBox)) {
          hitPaths.push(key);
        }
      });

      const nextSelection = resolveMarqueeSelection(hitPaths, baseSelection, mode);
      latestOptions.onSelectionChange(nextSelection);
      setMarqueeRect(nextRect);
    };

    const stepAutoScroll = () => {
      autoScrollFrame = null;
      const activeContainer = optionsRef.current.containerRef.current;
      if (!activeContainer || !marqueeActiveRef.current) return;

      const activeRect = activeContainer.getBoundingClientRect();
      const minX = activeRect.left + activeContainer.clientLeft;
      const maxX = minX + activeContainer.clientWidth;
      const minY = activeRect.top + activeContainer.clientTop;
      const maxY = minY + activeContainer.clientHeight;
      const dx = computeEdgeScrollDelta(lastClientX, minX, maxX);
      const dy = computeEdgeScrollDelta(lastClientY, minY, maxY);
      if (dx === 0 && dy === 0) return;

      const prevLeft = activeContainer.scrollLeft;
      const prevTop = activeContainer.scrollTop;
      if (dx !== 0) activeContainer.scrollLeft += dx;
      if (dy !== 0) activeContainer.scrollTop += dy;

      if (activeContainer.scrollLeft !== prevLeft || activeContainer.scrollTop !== prevTop) {
        updateFromClientPoint(lastClientX, lastClientY);
        autoScrollFrame = window.requestAnimationFrame(stepAutoScroll);
      }
    };

    const ensureAutoScroll = () => {
      if (autoScrollFrame !== null || !marqueeActiveRef.current) return;
      const activeContainer = optionsRef.current.containerRef.current;
      if (!activeContainer) return;
      const activeRect = activeContainer.getBoundingClientRect();
      const minX = activeRect.left + activeContainer.clientLeft;
      const maxX = minX + activeContainer.clientWidth;
      const minY = activeRect.top + activeContainer.clientTop;
      const maxY = minY + activeContainer.clientHeight;
      if (
        computeEdgeScrollDelta(lastClientX, minX, maxX) !== 0 ||
        computeEdgeScrollDelta(lastClientY, minY, maxY) !== 0
      ) {
        autoScrollFrame = window.requestAnimationFrame(stepAutoScroll);
      }
    };

    const handleMove = (moveEvent: MouseEvent) => {
      lastClientX = moveEvent.clientX;
      lastClientY = moveEvent.clientY;
      updateFromClientPoint(lastClientX, lastClientY);
      ensureAutoScroll();
    };

    const handleScroll = () => {
      if (marqueeActiveRef.current) {
        updateFromClientPoint(lastClientX, lastClientY);
      }
    };

    const finishDrag = (restoreBaseSelection = false) => {
      const wasActive = marqueeActiveRef.current;
      if (restoreBaseSelection && wasActive) {
        optionsRef.current.onSelectionChange(new Set(baseSelection));
      }
      justMarqueeSelectedRef.current = wasActive;
      if (wasActive) {
        resetJustSelectedTimerRef.current = window.setTimeout(() => {
          justMarqueeSelectedRef.current = false;
          resetJustSelectedTimerRef.current = null;
        }, 0);
      }
      marqueeTrackingRef.current = false;
      marqueeActiveRef.current = false;
      setMarqueeRect(null);
      if (autoScrollFrame !== null) {
        window.cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
      }
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("scroll", handleScroll);
      cleanupRef.current = null;
    };

    const handleUp = () => finishDrag(false);
    const handleBlur = () => finishDrag(false);
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") {
        keyEvent.preventDefault();
        finishDrag(true);
      }
    };

    cleanupRef.current = () => finishDrag(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("keydown", handleKeyDown);
    container.addEventListener("scroll", handleScroll, { passive: true });
  }, []);

  return {
    marqueeRect,
    marqueeActiveRef,
    marqueeTrackingRef,
    startMarqueeSelection,
    consumeJustMarqueeSelected,
  };
};
