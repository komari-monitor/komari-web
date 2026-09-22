import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { readCurrentThemeSettings, saveThemeSettings } from "@/utils/saveThemeSettings";
import { GUIDE_SETTINGS_KEY, parseGuideState, type GuideId, type GuideState } from "./guideState";

export function useGuideState(enabled: boolean) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<{ theme: string; state: GuideState } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    readCurrentThemeSettings().then(({ theme, settings }) => {
      if (!cancelled) setLoaded({ theme, state: parseGuideState(settings[GUIDE_SETTINGS_KEY]) });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  const mark = useCallback((item: GuideId | "workbenchOpened") => {
    if (!loaded) return;
    const update = (state: GuideState): GuideState => ({
      seen: item === "workbenchOpened" ? state.seen : [...new Set([...state.seen, item])],
      workbenchOpened: state.workbenchOpened || item === "workbenchOpened",
    });
    setLoaded((previous) => previous && ({ ...previous, state: update(previous.state) }));
    void saveThemeSettings(loaded.theme, (settings) => ({
      [GUIDE_SETTINGS_KEY]: update(parseGuideState(settings[GUIDE_SETTINGS_KEY])),
    })).catch(() => toast.error(t("onboarding.save_failed")));
  }, [loaded, t]);

  return { state: loaded?.state ?? null, mark };
}
