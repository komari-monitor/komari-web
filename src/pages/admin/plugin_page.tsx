import { Box, Callout } from "@radix-ui/themes";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

// 插件注入的管理页面：iframe 内嵌插件目录里的静态 HTML。
export default function PluginPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const short = params.get("short");
  const file = params.get("file");
  if (!short || !file) {
    return (
      <Callout.Root>
        <Callout.Text>{t("plugin.page_missing_params", "Missing plugin page parameters")}</Callout.Text>
      </Callout.Root>
    );
  }
  const src = `/api/admin/plugin/${encodeURIComponent(short)}/${file}`;
  // surface 层：进场落位已由外层 AdminPanelBar 按路由区块完成，这里不再叠一层 PageMotion（否则位移翻倍为 16px）。
  // 切换不同插件页（只改 query）时 iframe 原地换 src，不重挂载。
  return (
    <Box className="km-page-admin-plugin h-full min-h-[calc(100vh-96px)]">
      <iframe
        title={`${short}/${file}`}
        src={src}
        sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
        className="km-plugin-frame h-full min-h-[calc(100vh-96px)] w-full border-0"
      />
    </Box>
  );
}
