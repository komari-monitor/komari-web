import { useEffect, useState } from "react";
import { Callout, Box } from "@radix-ui/themes";
import Loading from "@/components/loading";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import {
  getRawThemeHtml,
  type ThemeConfiguration,
} from "@/utils/themeConfiguration";

interface ThemeConfigResponse {
  configuration?: ThemeConfiguration;
}

const ThemeRaw = () => {
  const { publicInfo } = usePublicInfo();
  const theme = publicInfo?.theme;
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!theme) {
        setHtml("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const resp = await fetch(`/themes/${theme}/komari-theme.json`, {
          cache: "no-cache",
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data: ThemeConfigResponse = await resp.json();
        const rawHtml = getRawThemeHtml(data.configuration);
        if (!rawHtml.trim()) {
          throw new Error("Raw theme content is empty");
        }

        if (!cancelled) setHtml(rawHtml);
      } catch (e) {
        if (!cancelled) {
          setHtml("");
          setError(e instanceof Error ? e.message : "Failed to load raw theme");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [theme]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <Callout.Root color="red">
        <Callout.Text>{error}</Callout.Text>
      </Callout.Root>
    );
  }

  return (
    <Box className="km-page-admin-theme-raw h-full min-h-[calc(100vh-96px)]">
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
