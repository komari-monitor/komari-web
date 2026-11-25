import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "@/contexts/ThemeContext";
import { useSystemTheme } from "@/hooks/useSystemTheme";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import Flag from "@/components/Flag";
import { getCountryDisplayName } from "@/utils/regionCode";
import { formatSpeed } from "@/utils/unitHelper";
import type { GlobeRegionMarker } from "./types";
import { getWorldLandDots, latLngToSphere, type SpherePoint } from "./worldLandMask";

const DEG_TO_RAD = Math.PI / 180;
const AUTO_ROTATE_RAD_PER_SEC = 0.14;
const MAX_TILT_RAD = 1.05;
const MIN_TILT_RAD = -1.05;

type RGB = readonly [number, number, number];

type GlobePalette = {
  isDark: boolean;
  sphereBgInner: RGB;
  sphereBgOuter: RGB;
  rimGlow: RGB;
  graticule: RGB;
  landFront: RGB;
  landBack: RGB;
  accent: RGB;
  online: RGB;
  partial: RGB;
  offline: RGB;
};

let probeCanvas: HTMLCanvasElement | null = null;
let probeCtx: CanvasRenderingContext2D | null = null;

/** 借助 1×1 离屏画布将任意现代 CSS 颜色（含 oklch / display-p3 / hex / rgb）准确解析为 RGB */
function resolveCssColorToRgb(colorStr: string, fallback: RGB): RGB {
  if (!colorStr || typeof document === "undefined") return fallback;
  try {
    if (!probeCanvas) {
      probeCanvas = document.createElement("canvas");
      probeCanvas.width = 1;
      probeCanvas.height = 1;
      probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
    }
    if (!probeCtx) return fallback;
    probeCtx.clearRect(0, 0, 1, 1);
    probeCtx.fillStyle = "#000000";
    probeCtx.fillStyle = colorStr.trim();
    probeCtx.fillRect(0, 0, 1, 1);
    const data = probeCtx.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2]];
  } catch {
    return fallback;
  }
}

function rgba(rgb: RGB, alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
}

function mixRgb(a: RGB, b: RGB, ratio: number): RGB {
  const t = Math.min(1, Math.max(0, ratio));
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function readGlobePalette(element: HTMLElement | null, isDark: boolean): GlobePalette {
  const style = element ? getComputedStyle(element) : null;
  const pick = (name: string, fallback: RGB): RGB => {
    const raw = style?.getPropertyValue(name)?.trim() ?? "";
    return raw ? resolveCssColorToRgb(raw, fallback) : fallback;
  };

  const panel = pick("--color-panel-solid", isDark ? [24, 24, 27] : [255, 255, 255]);
  const gray2 = pick("--gray-2", isDark ? [26, 27, 32] : [248, 249, 251]);
  const gray3 = pick("--gray-3", isDark ? [34, 36, 44] : [240, 242, 246]);
  const gray8 = pick("--gray-8", isDark ? [92, 98, 114] : [175, 182, 196]);
  const gray9 = pick("--gray-9", isDark ? [126, 134, 152] : [132, 140, 156]);
  const gray10 = pick("--gray-10", isDark ? [152, 160, 178] : [104, 112, 128]);
  const accent8 = pick("--accent-8", [110, 106, 222]);
  const accent9 = pick("--accent-9", [91, 91, 214]);
  const green9 = pick("--green-9", [48, 164, 108]);
  const amber9 = pick("--amber-9", [245, 158, 11]);
  const red9 = pick("--red-9", [229, 72, 77]);

  return {
    isDark,
    sphereBgInner: isDark ? mixRgb(gray3, accent9, 0.08) : mixRgb(panel, gray2, 0.55),
    sphereBgOuter: isDark ? mixRgb(panel, gray2, 0.85) : mixRgb(gray3, accent8, 0.06),
    rimGlow: accent8,
    graticule: isDark ? gray8 : gray9,
    // 陆地点阵带极轻的主题色倾向，融入 Radix 主题且保持 Carbon 控制台的克制质感
    landFront: isDark ? mixRgb(gray10, accent8, 0.24) : mixRgb(gray10, accent9, 0.2),
    landBack: isDark ? gray8 : gray8,
    accent: accent9,
    online: green9,
    partial: amber9,
    offline: red9,
  };
}

function shortestAngleDelta(current: number, target: number): number {
  const twoPi = Math.PI * 2;
  const diff = (((target - current + Math.PI) % twoPi) + twoPi) % twoPi - Math.PI;
  return diff;
}

type ProjectedMarker = {
  marker: GlobeRegionMarker;
  sx: number;
  sy: number;
  z: number;
  radius: number;
  rgb: RGB;
};

type HoveredMarkerState = {
  marker: GlobeRegionMarker;
  x: number;
  y: number;
};

/** 预先生成少量优雅的经纬辅助线点集（赤道、南北回归线、6 条子午线） */
function buildGraticuleLoops(): SpherePoint[][] {
  const loops: SpherePoint[][] = [];
  const step = 6;
  for (const lat of [-30, 0, 30]) {
    const ring: SpherePoint[] = [];
    for (let lng = -180; lng <= 180; lng += step) {
      ring.push(latLngToSphere(lat, lng));
    }
    loops.push(ring);
  }
  for (let lng = 0; lng < 180; lng += 30) {
    const ring: SpherePoint[] = [];
    for (let a = 0; a <= 360; a += step) {
      const rad = a * DEG_TO_RAD;
      const lngRad = lng * DEG_TO_RAD;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      ring.push([cosA * Math.sin(lngRad), sinA, cosA * Math.cos(lngRad)]);
    }
    loops.push(ring);
  }
  return loops;
}

const GRATICULE_LOOPS = buildGraticuleLoops();

export interface DotMatrixGlobeProps {
  regions: GlobeRegionMarker[];
  focusedCode: string | null;
  highlightedCode: string | null;
  interactive?: boolean;
  /** 编辑或拖拽布局时暂停 60fps 自转重绘，仅保留静止高清晰画面以保证拖拽满帧流畅 */
  paused?: boolean;
  onSelectRegion?: (code: string) => void;
  onHoverRegion?: (code: string | null) => void;
}

export default function DotMatrixGlobe({
  regions,
  focusedCode,
  highlightedCode,
  interactive = true,
  paused = false,
  onSelectRegion,
  onHoverRegion,
}: DotMatrixGlobeProps) {
  const { t, i18n } = useTranslation();
  const { appearance, color } = useContext(ThemeContext);
  const resolvedAppearance = useSystemTheme(appearance);
  const isDark = resolvedAppearance === "dark";
  const reducedMotion = useKmReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<HoveredMarkerState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const landDots = useMemo(() => getWorldLandDots(), []);
  const markerVectors = useMemo(
    () =>
      regions.map((marker) => ({
        marker,
        vec: latLngToSphere(marker.lat, marker.lng),
      })),
    [regions],
  );

  // 用 refs 承载高频动画状态，避免 60fps 帧循环触发 React 重渲染
  const paletteRef = useRef<GlobePalette>(readGlobePalette(null, isDark));
  const markersRef = useRef(markerVectors);
  markersRef.current = markerVectors;
  const projectedRef = useRef<ProjectedMarker[]>([]);
  const highlightedRef = useRef<string | null>(highlightedCode);
  highlightedRef.current = highlightedCode;
  const focusedRef = useRef<string | null>(focusedCode);
  focusedRef.current = focusedCode;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  // 初始朝向：优先对准节点数最多的地区，否则朝向东亚/亚太 (110°E, 24°N)
  const initialRegion = regions[0];
  const rotYRef = useRef((initialRegion?.lng ?? 110) * DEG_TO_RAD);
  const rotXRef = useRef(
    Math.max(MIN_TILT_RAD, Math.min(MAX_TILT_RAD, (initialRegion?.lat ?? 24) * DEG_TO_RAD)),
  );
  const velYRef = useRef(0);
  const velXRef = useRef(0);
  const targetRef = useRef<{ rotY: number; rotX: number } | null>(null);
  const draggingRef = useRef(false);
  const pointerHoveringRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number; downX: number; downY: number } | null>(null);
  const hasAutoAlignedRef = useRef(Boolean(initialRegion));

  // 数据首次到达后若用户还没交互过，平滑转向最多节点所在地区
  useEffect(() => {
    if (hasAutoAlignedRef.current || regions.length === 0) return;
    hasAutoAlignedRef.current = true;
    const primary = regions[0];
    targetRef.current = {
      rotY: primary.lng * DEG_TO_RAD,
      rotX: Math.max(MIN_TILT_RAD, Math.min(MAX_TILT_RAD, primary.lat * DEG_TO_RAD)),
    };
  }, [regions]);

  // 外部选中地区 -> 平滑旋转聚焦
  useEffect(() => {
    if (!focusedCode) return;
    const found = regions.find((r) => r.code === focusedCode);
    if (!found) return;
    velYRef.current = 0;
    velXRef.current = 0;
    targetRef.current = {
      rotY: found.lng * DEG_TO_RAD,
      rotX: Math.max(MIN_TILT_RAD, Math.min(MAX_TILT_RAD, found.lat * DEG_TO_RAD)),
    };
  }, [focusedCode, regions]);

  // 主题亮暗模式或 26 种 Radix 强调色变化时实时重读 CSS 变量配色
  useEffect(() => {
    const syncPalette = () => {
      paletteRef.current = readGlobePalette(containerRef.current, isDark);
    };
    syncPalette();
    // 主题切换后的下一帧再同步一次，确保 Radix Theme CSS 变量已刷新
    const raf = window.requestAnimationFrame(syncPalette);
    return () => window.cancelAnimationFrame(raf);
  }, [isDark, color]);

  // Canvas 尺寸监听 + 离屏/切后台自动暂停渲染循环
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let inView = true;
    let docVisible = typeof document === "undefined" ? true : !document.hidden;
    let rafId = 0;
    let lastTs = performance.now();

    const resize = () => {
      const nextWidth = Math.floor(container.clientWidth);
      const nextHeight = Math.floor(container.clientHeight);
      if (nextWidth <= 0 || nextHeight <= 0) {
        width = 0;
        height = 0;
        return;
      }
      width = nextWidth;
      height = nextHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };
    resize();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!rafId && width > 0 && height > 0) drawFrame(performance.now());
    });
    resizeObserver.observe(container);

    const drawFrame = (now: number) => {
      const liveW = Math.floor(container.clientWidth);
      const liveH = Math.floor(container.clientHeight);
      if (liveW !== width || liveH !== height) {
        resize();
      }
      if (width <= 0 || height <= 0) return;

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      // 更新球体旋转角度：优先聚焦动画 -> 拖拽惯性 -> 缓慢自转
      if (!draggingRef.current) {
        if (targetRef.current) {
          const dy = shortestAngleDelta(rotYRef.current, targetRef.current.rotY);
          const dx = targetRef.current.rotX - rotXRef.current;
          const ease = reducedRef.current ? 1 : 1 - Math.exp(-dt * 6.5);
          rotYRef.current += dy * ease;
          rotXRef.current += dx * ease;
          if (Math.abs(dy) < 0.002 && Math.abs(dx) < 0.002) {
            rotYRef.current = targetRef.current.rotY;
            rotXRef.current = targetRef.current.rotX;
            targetRef.current = null;
          }
        } else {
          if (Math.abs(velYRef.current) > 0.0001 || Math.abs(velXRef.current) > 0.0001) {
            rotYRef.current += velYRef.current;
            rotXRef.current = Math.max(
              MIN_TILT_RAD,
              Math.min(MAX_TILT_RAD, rotXRef.current + velXRef.current),
            );
            const decay = Math.exp(-dt * 5.2);
            velYRef.current *= decay;
            velXRef.current *= decay;
          } else if (!reducedRef.current && !pointerHoveringRef.current && !highlightedRef.current) {
            // 物理西向东自转（陆地自左向右缓缓流过）
            rotYRef.current -= AUTO_ROTATE_RAD_PER_SEC * dt;
          }
        }
      }

      const palette = paletteRef.current;
      const cx = width / 2;
      const cy = height / 2;
      // 半径按短边 0.40 计算，确保连同 1.15× 外光晕完整收在卡片内部
      const radius = Math.max(20, Math.min(width, height) * 0.4);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // 1. 外圈柔和大气光晕
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.86, cx, cy, radius * 1.15);
      halo.addColorStop(0, rgba(palette.rimGlow, palette.isDark ? 0.16 : 0.1));
      halo.addColorStop(0.65, rgba(palette.rimGlow, palette.isDark ? 0.05 : 0.03));
      halo.addColorStop(1, rgba(palette.rimGlow, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      // 2. 球体底层质感径向渐变
      const sphereGrad = ctx.createRadialGradient(
        cx - radius * 0.28,
        cy - radius * 0.28,
        radius * 0.12,
        cx,
        cy,
        radius,
      );
      sphereGrad.addColorStop(0, rgba(palette.sphereBgInner, 0.96));
      sphereGrad.addColorStop(1, rgba(palette.sphereBgOuter, 0.98));
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // 球体纤细轮廓边
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(palette.rimGlow, palette.isDark ? 0.24 : 0.2);
      ctx.stroke();

      const cosY = Math.cos(rotYRef.current);
      const sinY = Math.sin(rotYRef.current);
      const cosX = Math.cos(rotXRef.current);
      const sinX = Math.sin(rotXRef.current);

      // 3. 极淡经纬线（Carbon 工程技术感）
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = rgba(palette.graticule, palette.isDark ? 0.11 : 0.13);
      for (const loop of GRATICULE_LOOPS) {
        let drawing = false;
        ctx.beginPath();
        for (let i = 0; i < loop.length; i += 1) {
          const [x0, y0, z0] = loop[i];
          const x1 = x0 * cosY - z0 * sinY;
          const z1 = x0 * sinY + z0 * cosY;
          const y2 = y0 * cosX - z1 * sinX;
          const z2 = y0 * sinX + z1 * cosX;
          if (z2 > 0.02) {
            const sx = cx + x1 * radius;
            const sy = cy - y2 * radius;
            if (!drawing) {
              ctx.moveTo(sx, sy);
              drawing = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          } else {
            drawing = false;
          }
        }
        ctx.stroke();
      }

      // 4. 全球陆地点阵（背面极淡透视点 + 正面随深度渐亮清晰点阵）
      const baseDotR = Math.max(1.05, Math.min(1.9, radius / 95));
      for (let i = 0; i < landDots.length; i += 1) {
        const [x0, y0, z0] = landDots[i];
        const x1 = x0 * cosY - z0 * sinY;
        const z1 = x0 * sinY + z0 * cosY;
        const y2 = y0 * cosX - z1 * sinX;
        const z2 = y0 * sinX + z1 * cosX;
        const sx = cx + x1 * radius;
        const sy = cy - y2 * radius;

        if (z2 <= 0) {
          const backAlpha = (1 + z2) * (palette.isDark ? 0.09 : 0.07);
          if (backAlpha > 0.015) {
            ctx.fillStyle = rgba(palette.landBack, backAlpha);
            ctx.beginPath();
            ctx.arc(sx, sy, baseDotR * 0.72, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          const depth = Math.pow(z2, 0.55);
          const alpha = (palette.isDark ? 0.24 : 0.26) + depth * (palette.isDark ? 0.68 : 0.62);
          const r = baseDotR * (0.72 + depth * 0.45);
          ctx.fillStyle = rgba(palette.landFront, alpha);
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. 球面顶部柔和镜面高光（增强立体球感）
      const sheen = ctx.createRadialGradient(
        cx - radius * 0.34,
        cy - radius * 0.36,
        radius * 0.05,
        cx - radius * 0.2,
        cy - radius * 0.2,
        radius * 0.9,
      );
      sheen.addColorStop(0, palette.isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.45)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = sheen;
      ctx.fill();

      // 6. 投影并绘制服务器地区光点（在线绿 / 部分离线琥珀 / 全离线红）
      const pulsePhase = reducedRef.current ? 0 : (now * 0.0014) % 1;
      const projected: ProjectedMarker[] = [];
      const currentMarkers = markersRef.current;

      for (let i = 0; i < currentMarkers.length; i += 1) {
        const { marker, vec } = currentMarkers[i];
        const [x0, y0, z0] = vec;
        const x1 = x0 * cosY - z0 * sinY;
        const z1 = x0 * sinY + z0 * cosY;
        const y2 = y0 * cosX - z1 * sinX;
        const z2 = y0 * sinX + z1 * cosX;
        const sx = cx + x1 * radius;
        const sy = cy - y2 * radius;
        const rgb =
          marker.offline === 0
            ? palette.online
            : marker.online > 0
              ? palette.partial
              : palette.offline;
        const sizeBoost = Math.min(3, Math.log2(marker.total + 1) * 1.1);
        const r = Math.max(3.2, Math.min(6.4, radius / 48 + sizeBoost));
        projected.push({ marker, sx, sy, z: z2, radius: r, rgb });
      }

      // 由远及近绘制，避免背面点遮挡正面点
      projected.sort((a, b) => a.z - b.z);
      projectedRef.current = projected;

      for (const item of projected) {
        const isActive =
          item.marker.code === highlightedRef.current || item.marker.code === focusedRef.current;
        if (item.z < -0.04) {
          // 背面极淡提示点
          ctx.beginPath();
          ctx.arc(item.sx, item.sy, item.radius * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = rgba(item.rgb, isActive ? 0.35 : 0.16);
          ctx.fill();
          continue;
        }

        const visibility = Math.min(1, (item.z + 0.08) * 1.6);

        // 扩散脉冲光环（在线节点或高亮地区）
        if (!reducedRef.current && (item.marker.online > 0 || isActive)) {
          const phase = (pulsePhase + (item.marker.lng + 180) / 360) % 1;
          const ringR = item.radius * (1.2 + phase * (isActive ? 3.2 : 2.3));
          const ringAlpha = (1 - phase) * (isActive ? 0.55 : 0.34) * visibility;
          ctx.beginPath();
          ctx.arc(item.sx, item.sy, ringR, 0, Math.PI * 2);
          ctx.lineWidth = isActive ? 1.6 : 1.2;
          ctx.strokeStyle = rgba(item.rgb, ringAlpha);
          ctx.stroke();
        }

        // 外晕光
        const glowR = item.radius * (isActive ? 2.6 : 1.9);
        const glow = ctx.createRadialGradient(item.sx, item.sy, 0, item.sx, item.sy, glowR);
        glow.addColorStop(0, rgba(item.rgb, 0.55 * visibility));
        glow.addColorStop(1, rgba(item.rgb, 0));
        ctx.beginPath();
        ctx.arc(item.sx, item.sy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // 核心实心光点 + 微亮高光中心
        ctx.beginPath();
        ctx.arc(item.sx, item.sy, item.radius * (isActive ? 1.22 : 1), 0, Math.PI * 2);
        ctx.fillStyle = rgba(item.rgb, 0.96 * visibility);
        ctx.fill();

        if (isActive) {
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = palette.isDark ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.95)";
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(item.sx, item.sy, Math.max(1.2, item.radius * 0.36), 0, Math.PI * 2);
        ctx.fillStyle = rgba([255, 255, 255], 0.85 * visibility);
        ctx.fill();
      }
    };

    const tick = (now: number) => {
      if (!inView || !docVisible) {
        rafId = 0;
        return;
      }
      drawFrame(now);
      if (paused) {
        rafId = 0;
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    const ensureRunning = () => {
      if (inView && docVisible && !rafId) {
        lastTs = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const stopLoop = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry?.isIntersecting ?? true;
        if (inView) ensureRunning();
        else stopLoop();
      },
      { threshold: 0.05 },
    );
    intersectionObserver.observe(container);

    const handleVisibility = () => {
      docVisible = !document.hidden;
      if (docVisible) ensureRunning();
      else stopLoop();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    ensureRunning();

    return () => {
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [landDots, paused]);

  const hitTestMarker = (clientX: number, clientY: number): ProjectedMarker | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: ProjectedMarker | null = null;
    let bestDist = 16; // 命中半径（像素），对触摸和鼠标都友好
    for (const item of projectedRef.current) {
      if (item.z < -0.02) continue;
      const dist = Math.hypot(item.sx - x, item.sy - y);
      if (dist <= Math.max(bestDist, item.radius + 9)) {
        bestDist = dist;
        best = item;
      }
    }
    return best;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactiveRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setIsDragging(true);
    targetRef.current = null;
    velYRef.current = 0;
    velXRef.current = 0;
    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      downX: event.clientX,
      downY: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactiveRef.current) return;
    pointerHoveringRef.current = true;

    if (draggingRef.current && lastPointerRef.current) {
      const dx = event.clientX - lastPointerRef.current.x;
      const dy = event.clientY - lastPointerRef.current.y;
      const sensitivity = 0.0065;
      rotYRef.current -= dx * sensitivity;
      rotXRef.current = Math.max(
        MIN_TILT_RAD,
        Math.min(MAX_TILT_RAD, rotXRef.current + dy * sensitivity),
      );
      velYRef.current = -dx * sensitivity * 0.42;
      velXRef.current = dy * sensitivity * 0.42;
      lastPointerRef.current.x = event.clientX;
      lastPointerRef.current.y = event.clientY;
      setHovered(null);
      return;
    }

    const hit = hitTestMarker(event.clientX, event.clientY);
    if (hit) {
      setHovered({ marker: hit.marker, x: hit.sx, y: hit.sy });
      onHoverRegion?.(hit.marker.code);
    } else if (hovered) {
      setHovered(null);
      onHoverRegion?.(null);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const last = lastPointerRef.current;
    lastPointerRef.current = null;
    if (last && Math.hypot(event.clientX - last.downX, event.clientY - last.downY) < 6) {
      const hit = hitTestMarker(event.clientX, event.clientY);
      if (hit) {
        onSelectRegion?.(hit.marker.code);
      }
    }
  };

  const handlePointerLeave = () => {
    pointerHoveringRef.current = false;
    if (!draggingRef.current) {
      setHovered(null);
      onHoverRegion?.(null);
    }
  };

  const hoveredLabel = hovered
    ? getCountryDisplayName(hovered.marker.code, i18n.language) || hovered.marker.code
    : "";

  return (
    <div
      ref={containerRef}
      className="km-globe-canvas-wrap"
      data-interactive={interactive}
      data-dragging={isDragging}
    >
      <canvas
        ref={canvasRef}
        className="km-globe-canvas"
        style={{
          cursor: !interactive
            ? "default"
            : isDragging
              ? "grabbing"
              : hovered
                ? "pointer"
                : "grab",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        aria-label={t("dashboard.globeAria", "Interactive 3D dot-matrix server globe")}
      />
      {interactive && hovered && (
        <div
          className="km-globe-tooltip"
          style={{
            left: `${hovered.x}px`,
            top: `${Math.max(18, hovered.y - 12)}px`,
          }}
          role="status"
        >
          <Flex align="center" justify="between" gap="2">
            <Flex align="center" gap="1.5" className="min-w-0">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center [&_.km-flag]:m-0 [&_.km-flag]:h-4 [&_.km-flag]:w-4">
                <Flag flag={hovered.marker.code} />
              </span>
              <Text size="1" weight="bold" className="truncate">
                {hoveredLabel}
              </Text>
            </Flex>
            <Badge
              size="1"
              variant="soft"
              color={
                hovered.marker.offline === 0
                  ? "green"
                  : hovered.marker.online > 0
                    ? "amber"
                    : "red"
              }
            >
              {hovered.marker.online}/{hovered.marker.total}
            </Badge>
          </Flex>
          <Flex direction="column" gap="0.5" mt="1">
            {hovered.marker.nodes.slice(0, 3).map((node) => (
              <Flex key={node.uuid} align="center" justify="between" gap="2">
                <Flex align="center" gap="1" className="min-w-0">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: node.online ? "var(--green-9)" : "var(--red-9)",
                    }}
                  />
                  <Text size="1" color="gray" className="truncate">
                    {node.name}
                  </Text>
                </Flex>
                {node.online && node.up + node.down > 0 && (
                  <Text size="1" color="gray" className="shrink-0 whitespace-nowrap">
                    {formatSpeed(node.up + node.down)}
                  </Text>
                )}
              </Flex>
            ))}
            {hovered.marker.nodes.length > 3 && (
              <Text size="1" color="gray">
                +{hovered.marker.nodes.length - 3}
              </Text>
            )}
          </Flex>
        </div>
      )}
    </div>
  );
}
