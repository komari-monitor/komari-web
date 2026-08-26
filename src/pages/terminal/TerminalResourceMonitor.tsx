import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Gauge, X } from "lucide-react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { useNodeList } from "@/contexts/NodeListContext";
import { getOSImage } from "@/utils/osImageHelper";
import { formatBytes } from "@/utils/unitHelper";

interface RawLatestStatus {
  online?: boolean;
  cpu?: number;
  ram?: number;
  disk?: number;
  net_in?: number;
  net_out?: number;
}

interface ResourceSample {
  online: boolean;
  cpuUsage: number;
  ramUsed: number;
  diskUsed: number;
  networkDown: number;
  networkUp: number;
}

interface TerminalResourceMonitorProps {
  clients: Array<{
    uuid: string;
    name: string;
    os: string;
  }>;
  servers: string[];
  onRemove: (uuid: string) => void;
}

const RESOURCE_UPDATE_INTERVAL_MS = 2000;
const MONITOR_EDGE_MARGIN = 8;

const clampMonitorPosition = (
  x: number,
  y: number,
  width: number,
  height: number,
) => ({
  x: Math.min(
    Math.max(MONITOR_EDGE_MARGIN, x),
    Math.max(
      MONITOR_EDGE_MARGIN,
      window.innerWidth - width - MONITOR_EDGE_MARGIN,
    ),
  ),
  y: Math.min(
    Math.max(MONITOR_EDGE_MARGIN, y),
    Math.max(
      MONITOR_EDGE_MARGIN,
      window.innerHeight - Math.min(height, 120) - MONITOR_EDGE_MARGIN,
    ),
  ),
});

const normalizePercent = (value: number) =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

const usagePercent = (used: number, total: number) =>
  total > 0 ? normalizePercent((used / total) * 100) : 0;

const usageColor = (percent: number) => {
  if (percent >= 90) return "#dc143c";
  if (percent >= 70) return "#eab308";
  return "#3cb371";
};

const sameSample = (left: ResourceSample, right: ResourceSample) =>
  left.online === right.online &&
  left.cpuUsage === right.cpuUsage &&
  left.ramUsed === right.ramUsed &&
  left.diskUsed === right.diskUsed &&
  left.networkDown === right.networkDown &&
  left.networkUp === right.networkUp;

const UsageRow = ({
  label,
  detail,
  percent,
}: {
  label: string;
  detail: string;
  percent: number;
}) => {
  const normalizedPercent = normalizePercent(percent);

  return (
    <div className="km-resource-monitor-metric">
      <div className="flex items-baseline justify-between gap-2 text-[11px] leading-4">
        <span className="text-neutral-400">{label}</span>
        <span className="font-medium text-neutral-100">{detail}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            backgroundColor: usageColor(normalizedPercent),
            width: `${normalizedPercent}%`,
          }}
        />
      </div>
    </div>
  );
};

const TerminalResourceMonitor = ({
  clients,
  servers,
  onRemove,
}: TerminalResourceMonitorProps) => {
  const { t } = useTranslation();
  const { call } = useRPC2Call();
  const { nodeList } = useNodeList(false) ?? { nodeList: [] };
  const [samples, setSamples] = useState<Record<string, ResourceSample>>({});
  const [loadError, setLoadError] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const serverKey = servers.join("|");
  const clientByUuid = useMemo(
    () => new Map(clients.map((client) => [client.uuid, client])),
    [clients],
  );
  const nodeByUuid = useMemo(
    () => new Map((nodeList ?? []).map((node) => [node.uuid, node])),
    [nodeList],
  );

  useEffect(() => {
    const selectedServers = serverKey ? serverKey.split("|") : [];
    if (selectedServers.length === 0) {
      setSamples({});
      setLoadError(false);
      return;
    }

    let stopped = false;
    let running = false;
    let requestSequence = 0;

    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      const sequence = ++requestSequence;

      try {
        const result = await call<
          Record<string, never>,
          Record<string, RawLatestStatus>
        >("common:getNodesLatestStatus");
        if (stopped || sequence !== requestSequence) return;

        const next: Record<string, ResourceSample> = {};
        for (const uuid of selectedServers) {
          const record = result?.[uuid];
          next[uuid] = {
            online: record?.online === true,
            cpuUsage: normalizePercent(record?.cpu ?? 0),
            ramUsed: record?.ram ?? 0,
            diskUsed: record?.disk ?? 0,
            networkDown: record?.net_in ?? 0,
            networkUp: record?.net_out ?? 0,
          };
        }

        setSamples((previous) => {
          const previousKeys = Object.keys(previous);
          const changed =
            previousKeys.length !== selectedServers.length ||
            previousKeys.some(
              (uuid) => !next[uuid] || !sameSample(previous[uuid], next[uuid]),
            );
          return changed ? next : previous;
        });
        setLoadError(false);
      } catch {
        if (!stopped && sequence === requestSequence) {
          setLoadError(true);
        }
      } finally {
        running = false;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), RESOURCE_UPDATE_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [call, serverKey]);

  useEffect(() => {
    if (!position) return;

    const handleResize = () => {
      const panel = panelRef.current;
      if (!panel) return;
      setPosition((current) =>
        current
          ? clampMonitorPosition(
              current.x,
              current.y,
              panel.offsetWidth,
              panel.offsetHeight,
            )
          : current,
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position]);

  if (servers.length === 0) return null;

  const handleHeaderPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (
      event.button !== 0 ||
      (event.target instanceof Element && event.target.closest("button"))
    ) {
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    setPosition({
      x: rect.left,
      y: rect.top,
    });
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handleHeaderPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const state = dragStateRef.current;
    const panel = panelRef.current;
    if (!state || !panel || state.pointerId !== event.pointerId) return;

    const next = clampMonitorPosition(
      state.originX + event.clientX - state.startX,
      state.originY + event.clientY - state.startY,
      panel.offsetWidth,
      panel.offsetHeight,
    );
    setPosition(next);
  };

  const endDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setDragging(false);
  };

  return (
    <section
      ref={panelRef}
      data-resource-monitor=""
      className="km-terminal-resource-monitor fixed z-50 w-[292px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-neutral-800 bg-[#161616]/95 text-neutral-200 shadow-2xl backdrop-blur-md"
      style={
        position
          ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto" }
          : { right: "16px", top: "52px" }
      }
      aria-label={t("terminal.resource_monitor.title", "资源小窗")}
    >
      <div
        className={`flex h-9 touch-none select-none items-center gap-2 border-b border-neutral-800 bg-[#1b1b1b] px-3 text-xs font-medium ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={endDragging}
        onPointerCancel={endDragging}
      >
        <Gauge size={14} className="shrink-0 text-neutral-400" />
        <span className="min-w-0 flex-1 truncate">
          {t("terminal.resource_monitor.title", "资源小窗")}
        </span>
        <span className="rounded-full bg-white/10 px-1.5 py-px text-[10px] text-neutral-300">
          {servers.length}
        </span>
      </div>

      <div className="max-h-[calc(70vh-2.25rem)] space-y-1.5 overflow-y-auto p-2">
        {loadError && (
          <p className="px-1 py-1 text-[11px] text-red-300">
            {t("terminal.resource_monitor.load_error", "实时数据加载失败")}
          </p>
        )}
        {servers.map((uuid) => {
          const client = clientByUuid.get(uuid);
          const node = nodeByUuid.get(uuid);
          const sample = samples[uuid];
          const ramPercent = usagePercent(sample?.ramUsed ?? 0, node?.mem_total ?? 0);
          const diskPercent = usagePercent(sample?.diskUsed ?? 0, node?.disk_total ?? 0);

          return (
            <article
              key={uuid}
              className="rounded-[5px] border border-neutral-800/80 bg-[#111111] p-2"
            >
              <div className="mb-2 flex items-center gap-2">
                <img
                  src={getOSImage(client?.os || node?.os || "")}
                  alt=""
                  draggable={false}
                  className="h-3.5 w-3.5 shrink-0 object-contain"
                />
                <h3 className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-100">
                  {client?.name || node?.name || uuid}
                </h3>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[3px] text-neutral-500 transition-colors hover:bg-white/15 hover:text-neutral-100"
                  onClick={() => onRemove(uuid)}
                  aria-label={t("common.close", "Close")}
                >
                  <X size={11} strokeWidth={2.2} />
                </button>
              </div>

              {!sample ? (
                <p className="text-[11px] text-neutral-500">
                  {t("terminal.resource_monitor.waiting", "等待数据...")}
                </p>
              ) : !sample.online ? (
                <p className="text-[11px] text-red-300">
                  {t("nodeCard.offline", "离线")}
                </p>
              ) : (
                <div className="space-y-2">
                  <UsageRow
                    label="CPU"
                    detail={`${sample.cpuUsage.toFixed(1)}%`}
                    percent={sample.cpuUsage}
                  />
                  <UsageRow
                    label={t("nodeCard.ram", "内存")}
                    detail={`${formatBytes(sample.ramUsed)} / ${formatBytes(node?.mem_total ?? 0)}`}
                    percent={ramPercent}
                  />
                  <UsageRow
                    label={t("nodeCard.disk", "磁盘")}
                    detail={`${formatBytes(sample.diskUsed)} / ${formatBytes(node?.disk_total ?? 0)}`}
                    percent={diskPercent}
                  />
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                        <ArrowUp size={11} />
                        <span>{t("dashboard.uploadRate", "上传速率")}</span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-neutral-100">
                        {formatBytes(sample.networkUp)}/s
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                        <ArrowDown size={11} />
                        <span>{t("dashboard.downloadRate", "下载速率")}</span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-neutral-100">
                        {formatBytes(sample.networkDown)}/s
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default TerminalResourceMonitor;
