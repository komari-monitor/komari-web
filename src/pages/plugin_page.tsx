import { Box, Callout } from "@radix-ui/themes";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { SURFACE_MOTION } from "@/lib/motion";

// 插件公开页面（visibility=public）：通过公开路由直接访问，不进导航。
// 内容来自无需鉴权的 /api/plugin/:short/* 后端路由。
export default function PluginPage() {
  const { t } = useTranslation();
  const params = useParams<{ short: string; "*": string }>();
  const short = params.short;
  const filepath = params["*"];
  if (!short || !filepath) {
    return (
      <motion.div
        initial={SURFACE_MOTION.route.initial}
        animate={SURFACE_MOTION.route.animate}
        transition={SURFACE_MOTION.route.transition}
      >
        <Callout.Root className="km-plugin-missing">
          <Callout.Text>{t("plugin.page_missing_params", "Missing plugin page parameters")}</Callout.Text>
        </Callout.Root>
      </motion.div>
    );
  }
  const src = `/api/plugin/${encodeURIComponent(short)}/${filepath}`;
  return (
    <motion.div
      // surface 层：插件页整页淡入，iframe 本身不做任何位移（避免重绘闪烁）
      initial={SURFACE_MOTION.routeFade.initial}
      animate={SURFACE_MOTION.routeFade.animate}
      transition={SURFACE_MOTION.routeFade.transition}
      className="km-page-plugin h-full min-h-[calc(100vh-96px)]"
    >
      <Box className="h-full">
        <iframe
          title={`${short}/${filepath}`}
          src={src}
          sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
          className="km-plugin-frame h-full min-h-[calc(100vh-96px)] w-full border-0"
        />
      </Box>
    </motion.div>
  );
}
