import { useEffect, useMemo } from "react";
import { Callout, Box } from "@radix-ui/themes";
import { Skeletonize } from "@/components/ui/skeleton";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { getRawThemeHtml } from "@/utils/themeConfiguration";
import { useRouteQuery } from "@/lib/routeData";
import { rememberActiveTheme, themeManifestQuery } from "@/routeQueries/appearance";

const ThemeRaw = () => {
  const { publicInfo, isLoading: publicInfoLoading } = usePublicInfo();
  const theme = publicInfo?.theme;
  // 主题清单：主题已知时切换页面前就已预取（见 routeQueries/appearance.ts）
  const manifestQuery = useMemo(() => (theme ? themeManifestQuery(theme) : null), [theme]);
  const manifest = useRouteQuery(manifestQuery);
  useEffect(() => rememberActiveTheme(theme), [theme]);
  // 原来首帧就是加载中：公共信息还没到（主题未知）时也先转圈
  const loading = manifest.loading || (!theme && publicInfoLoading);
  const rawHtml = theme && manifest.data ? getRawThemeHtml(manifest.data.configuration) : "";
  const error = !theme
    ? null
    : manifest.error
      ? manifest.error instanceof Error
        ? manifest.error.message
        : "Failed to load raw theme"
      : manifest.data && !rawHtml.trim()
        ? "Raw theme content is empty"
        : null;
  const html = error ? "" : rawHtml;

  // 加载中：iframe 舞台的位置先是一大块色块（不再整页转圈）
  if (loading) {
    return (
      <Skeletonize loading className="km-setting-card-skeleton min-h-[calc(100vh-96px)]">
        <div />
      </Skeletonize>
    );
  }

  if (error) {
    return (
      <Callout.Root color="red">
        <Callout.Text>{error}</Callout.Text>
      </Callout.Root>
    );
  }

  return (
    <Box className="km-page-admin-theme-raw h-full min-h-[calc(100vh-96px)]">
      {/*
        surface 性格：主题原文是一整块 iframe「舞台」，路由进场已由外层 AdminPanelBar 做过淡入落位，
        这里不再按 theme 加 key + AnimatePresence：key 变化会卸载重挂 iframe（整页重新加载），
        且退场与进场两个 iframe 会短暂上下叠在一起把页面撑高。
      */}
      <iframe
        title="Theme raw content"
        srcDoc={html}
        sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
        className="km-theme-raw-frame h-full min-h-[calc(100vh-96px)] w-full border-0"
      />
    </Box>
  );
};

export default ThemeRaw;
