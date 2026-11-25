import { lazy, Suspense, useState } from "react";
import { Badge, Flex, Text } from "@radix-ui/themes";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import Flag from "@/components/Flag";
import { useDashboardWidgetContext } from "@/components/admin/dashboard/widgetContext";
import { Skeletonize } from "@/components/ui/skeleton";
import { getCountryDisplayName } from "@/utils/regionCode";
import { RankListPopover } from "./RankList";
import type { GlobeSummary } from "./types";

const LazyDotMatrixGlobe = lazy(() => import("./DotMatrixGlobe"));

/** 全球节点分布（零依赖点阵 3D 地球）：完全跟随所在网格格子的宽高度自适应缩放，卡片内零滚动条 */
export const GlobeWidget = ({
  summary,
  loading = false,
}: {
  summary: GlobeSummary;
  loading?: boolean;
}) => {
  const { t, i18n } = useTranslation();
  const { editing, dragging, isDragPreview, width, height } = useDashboardWidgetContext();
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const isCompactWidth = width === "compact";
  const maxVisibleRegions = isCompactWidth
    ? height === "short"
      ? 2
      : height === "tall"
        ? 8
        : 4
    : height === "short"
      ? 3
      : height === "tall"
        ? 14
        : 8;
  const visibleRegions = summary.regions.slice(0, maxVisibleRegions);
  const hasMoreRegions = summary.regions.length > visibleRegions.length;

  const renderRegionRow = (region: GlobeSummary["regions"][number], inPopover = false) => {
    const label = getCountryDisplayName(region.code, i18n.language) || region.code;
    const active = focusedCode === region.code || hoveredCode === region.code;
    const badgeColor =
      region.offline === 0 ? "green" : region.online > 0 ? "amber" : "red";
    return (
      <button
        key={region.code}
        type="button"
        className="km-globe-region-item"
        data-active={active}
        disabled={editing && !inPopover}
        onClick={() => setFocusedCode(region.code)}
        onMouseEnter={() => (!editing || inPopover) && setHoveredCode(region.code)}
        onMouseLeave={() => setHoveredCode(null)}
      >
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center [&_.km-flag]:m-0 [&_.km-flag]:h-4 [&_.km-flag]:w-4">
          <Flag flag={region.code} />
        </span>
        <Text size="2" className="min-w-0 flex-1 truncate text-left" title={label}>
          {label}
        </Text>
        <Badge size="1" variant="soft" color={badgeColor} className="shrink-0">
          {region.online}/{region.total}
        </Badge>
      </button>
    );
  };

  return (
    <Flex direction="column" gap="3" className="km-globe-widget">
      <Flex
        justify="between"
        align="center"
        gap="2"
        wrap="wrap"
        className="shrink-0"
        style={{ color: "var(--gray-10)" }}
      >
        <Flex gap="2" align="center">
          <Globe size={18} />
          <Text size="3" weight="bold">
            {t("dashboardLayout.widgets.globe", "Global node globe")}
          </Text>
        </Flex>
        <Flex gap="2" align="center">
          <Badge size="1" variant="soft" color="gray">
            {t("dashboard.globeRegionCount", "{{count}} regions", {
              count: summary.regions.length,
            })}
          </Badge>
          <Badge
            size="1"
            variant="soft"
            color={
              summary.nodeTotal === 0
                ? "gray"
                : summary.onlineTotal === summary.nodeTotal
                  ? "green"
                  : summary.onlineTotal > 0
                    ? "amber"
                    : "red"
            }
          >
            {summary.onlineTotal}/{summary.nodeTotal}
          </Badge>
          {hasMoreRegions && (
            <RankListPopover
              title={t("dashboard.globeAllRegions", "All regions")}
              ariaLabel={t("common.details", "Details")}
            >
              <Flex direction="column" gap="1">
                {summary.regions.map((region) => renderRegionRow(region, true))}
              </Flex>
            </RankListPopover>
          )}
        </Flex>
      </Flex>

      {isDragPreview ? (
        <div className="km-globe-drag-placeholder">
          <Globe size={32} color="var(--gray-9)" />
          <Text size="2" color="gray">
            {t("dashboardLayout.widgets.globe", "Global node globe")}
          </Text>
        </div>
      ) : (
        <Skeletonize loading={loading} className="km-globe-skeleton">
          <div
            className="km-globe-layout"
            data-compact={isCompactWidth}
            data-has-regions={summary.regions.length > 0}
          >
            <div className="km-globe-stage">
              <Suspense
                fallback={
                  <div className="km-globe-drag-placeholder">
                    <Globe size={28} color="var(--gray-8)" />
                  </div>
                }
              >
                <LazyDotMatrixGlobe
                  regions={summary.regions}
                  focusedCode={focusedCode}
                  highlightedCode={hoveredCode}
                  interactive={!editing}
                  paused={editing || dragging}
                  onSelectRegion={(code) => setFocusedCode(code)}
                  onHoverRegion={setHoveredCode}
                />
              </Suspense>
            </div>

            {summary.regions.length > 0 ? (
              <div className="km-globe-regions">
                {visibleRegions.map((region) => renderRegionRow(region))}
                {!hasMoreRegions && summary.unmappedCount > 0 && height !== "short" && (
                  <Text size="1" color="gray" className="px-2 pt-2">
                    {t("dashboard.globeUnmapped", "{{count}} node(s) without region", {
                      count: summary.unmappedCount,
                    })}
                  </Text>
                )}
              </div>
            ) : (
              <Flex direction="column" gap="1" justify="center" className="km-globe-empty-note">
                <Text size="2" color="gray">
                  {t("dashboard.globeNoRegions", "No node regions detected yet")}
                </Text>
                <Text size="1" color="gray">
                  {t(
                    "dashboard.globeHint",
                    "Drag the globe to explore. Assign regions to servers to pin them here.",
                  )}
                </Text>
              </Flex>
            )}
          </div>
        </Skeletonize>
      )}
    </Flex>
  );
};
