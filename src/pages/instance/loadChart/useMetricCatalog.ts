import { useEffect, useMemo, useState } from "react";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useRPC2Call } from "@/contexts/RPC2Context";
import type { PublicPingTask } from "@/types/metrics";
import { toPingTaskMap } from "@/utils/metricSeries";
import { fallbackCatalog, getMetricKind } from "./catalog";
import type { MetricCatalogItem, MetricDefinition } from "./types";

/** 指标定义（public:listMetricDefinitions）与公开延迟任务（public:getPublicPingTasks） */
export function useMetricCatalog() {
  const { call } = useRPC2Call();
  const { publicInfo } = usePublicInfo();
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [definitionsLoaded, setDefinitionsLoaded] = useState(false);
  const maxMetricRetentionDays = useMemo(() => {
    if (!definitionsLoaded) return 0;
    const retentionDays = definitions
      .map((definition) => Number(definition.retention_days))
      .filter((days) => Number.isFinite(days) && days > 0);
    if (retentionDays.length > 0) return Math.max(...retentionDays);

    const fallback = Number(publicInfo?.metric_retention_days);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  }, [definitions, definitionsLoaded, publicInfo?.metric_retention_days]);
  const [pingTasks, setPingTasks] = useState<PublicPingTask[]>([]);

  useEffect(() => {
    let active = true;
    call<unknown, MetricDefinition[]>("public:listMetricDefinitions")
      .then((items) => {
        if (active) {
          setDefinitions(Array.isArray(items) ? items : []);
          setDefinitionsLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setDefinitions([]);
          setDefinitionsLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [call]);

  useEffect(() => {
    let active = true;
    call<unknown, PublicPingTask[]>("public:getPublicPingTasks")
      .then((items) => {
        if (active) setPingTasks(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setPingTasks([]);
      });
    return () => {
      active = false;
    };
  }, [call]);

  const definitionMap = useMemo(
    () => new Map(definitions.map((item) => [item.name, item])),
    [definitions],
  );
  const pingTaskMap = useMemo(() => toPingTaskMap(pingTasks), [pingTasks]);

  const metricOptions = useMemo(() => {
    const merged = new Map<string, MetricCatalogItem>();
    for (const item of fallbackCatalog) merged.set(item.key, item);
    for (const def of definitions) {
      if (!merged.has(def.name)) {
        merged.set(def.name, {
          key: def.name,
          label: def.description || def.name,
          kind: getMetricKind(def.name, def.unit),
          unit: def.unit,
        });
      }
    }
    return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [definitions]);

  return { maxMetricRetentionDays, definitionMap, pingTaskMap, metricOptions };
}
