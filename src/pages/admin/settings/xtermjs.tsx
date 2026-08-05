import React from "react";
import { Button, Callout, Flex } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import Loading from "@/components/loading";
import {
  SettingCardButton,
  SettingCardLabel,
  SettingCardLongTextInput,
  SettingCardShortTextInput,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import {
  formatXtermThemeJson,
  isTransparentBackground,
  parseXtermThemeJson,
  useXtermjsSettings,
  type XtermjsSettings,
} from "@/hooks/useXtermjsSettings";

export default function XtermjsSettingsPage() {
  const { t } = useTranslation();
  const { settings, loading, error, saving, setSettings, resetSettings, refetch } =
    useXtermjsSettings();

  const showSaveError = React.useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t("settings.settings_save_failed")}: ${message}`);
    },
    [t]
  );

  const commitSettings = React.useCallback(
    async (promise: Promise<unknown>) => {
      try {
        return await promise;
      } catch (error) {
        showSaveError(error);
        throw error;
      }
    },
    [showSaveError]
  );

  const saveIntegerField = React.useCallback(
    async (
      fieldLabel: string,
      rawValue: string,
      minimum: number,
      apply: (current: XtermjsSettings) => XtermjsSettings
    ) => {
      const normalizedValue = rawValue.trim();
      const parsed = Number.parseInt(normalizedValue, 10);
      if (
        !/^\d+$/.test(normalizedValue) ||
        !Number.isInteger(parsed) ||
        parsed < minimum
      ) {
        toast.error(`${fieldLabel} ${t("settings.invalid_integer")}`);
        return;
      }

      await commitSettings(setSettings(apply));
      toast.success(t("settings.settings_saved"));
    },
    [commitSettings, setSettings, t]
  );

  const handleReset = React.useCallback(async () => {
    await commitSettings(resetSettings());
    toast.success(t("settings.settings_saved"));
  }, [commitSettings, resetSettings, t]);

  const handleThemeJsonSave = React.useCallback(
    async (value: string) => {
      const parsed = parseXtermThemeJson(value);

      if (parsed.status === "invalid_json") {
        toast.error(t("settings.xtermjs.theme_json_invalid"));
        return;
      }

      if (parsed.status === "non_object") {
        toast.error(t("settings.xtermjs.theme_json_must_be_object"));
        return;
      }

      await commitSettings(
        setSettings((current) => ({
          ...current,
          terminalOptions: {
            ...current.terminalOptions,
            theme: parsed.theme,
          },
        }))
      );

      if (parsed.filtered) {
        toast.warning(t("settings.xtermjs.theme_json_filtered"));
      } else {
        toast.success(t("settings.settings_saved"));
      }
    },
    [commitSettings, setSettings, t]
  );

  const handleCustomCssSave = React.useCallback(
    async (value: string) => {
      await commitSettings(
        setSettings((current) => ({
          ...current,
          customCss: value,
        }))
      );
      toast.success(t("settings.settings_saved"));
    },
    [commitSettings, setSettings, t]
  );

  const handleRetry = React.useCallback(async () => {
    try {
      await refetch();
    } catch {
      // error state already comes from the hook
    }
  }, [refetch]);

  const themeBackgroundIsOpaque =
    settings.transparentBackground &&
    settings.terminalOptions.theme?.background !== undefined &&
    !isTransparentBackground(settings.terminalOptions.theme.background);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
    <Flex direction="column" gap="3" className="km-page-admin-settings-xtermjs">
        <Callout.Root color="red" size="1">
          <Callout.Icon>
            <AlertTriangle size={16} />
          </Callout.Icon>
          <Callout.Text>{error.message}</Callout.Text>
        </Callout.Root>
        <Button onClick={handleRetry}>{t("common.retry", "Retry")}</Button>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="3">
      <SettingCardLabel>{t("settings.xtermjs.title")}</SettingCardLabel>
      <SettingCardButton
        title={t("settings.xtermjs.title")}
        description={t("settings.xtermjs.reset_defaults")}
        onClick={handleReset}
        className="km-setting-card"
      >
        {t("common.reset", "Reset")}
      </SettingCardButton>

      <SettingCardShortTextInput
        title={t("settings.xtermjs.font_family")}
        descriptionPlacement="footer"
        defaultValue={settings.terminalOptions.fontFamily || ""}
        placeholder="'Cascadia Mono', 'Noto Sans SC', monospace"
        isSaving={saving}
        OnSave={async (value) => {
          await commitSettings(
            setSettings((current) => ({
              ...current,
              terminalOptions: {
                ...current.terminalOptions,
                fontFamily: value,
              },
            }))
          );
          toast.success(t("settings.settings_saved"));
        }}
      />

      <SettingCardShortTextInput
        title={t("settings.xtermjs.font_size")}
        descriptionPlacement="footer"
        defaultValue={settings.terminalOptions.fontSize?.toString() || "16"}
        placeholder="16"
        inputMode="numeric"
        isSaving={saving}
        OnSave={async (value) => {
          await saveIntegerField(
            t("settings.xtermjs.font_size"),
            value,
            1,
            (current) => ({
              ...current,
              terminalOptions: {
                ...current.terminalOptions,
                fontSize: Number.parseInt(value.trim(), 10),
              },
            })
          );
        }}
      />

      <SettingCardSwitch
        title={t("settings.xtermjs.cursor_blink")}
        defaultChecked={Boolean(settings.terminalOptions.cursorBlink)}
        onChange={async (checked) => {
          await commitSettings(
            setSettings((current) => ({
              ...current,
              terminalOptions: {
                ...current.terminalOptions,
                cursorBlink: checked,
              },
            }))
          );
          toast.success(t("settings.settings_saved"));
        }}
        className="km-setting-card"
      />

      <SettingCardShortTextInput
        title={t("settings.xtermjs.scrollback")}
        descriptionPlacement="footer"
        defaultValue={settings.terminalOptions.scrollback?.toString() || "5000"}
        placeholder="5000"
        inputMode="numeric"
        isSaving={saving}
        OnSave={async (value) => {
          await saveIntegerField(
            t("settings.xtermjs.scrollback"),
            value,
            0,
            (current) => ({
              ...current,
              terminalOptions: {
                ...current.terminalOptions,
                scrollback: Number.parseInt(value.trim(), 10),
              },
            })
          );
        }}
      />

      <SettingCardSwitch
        title={t("settings.xtermjs.convert_eol")}
        defaultChecked={Boolean(settings.terminalOptions.convertEol)}
        onChange={async (checked) => {
          await commitSettings(
            setSettings((current) => ({
              ...current,
              terminalOptions: {
                ...current.terminalOptions,
                convertEol: checked,
              },
            }))
          );
          toast.success(t("settings.settings_saved"));
        }}
        className="km-setting-card"
      />

      <SettingCardSwitch
        title={t("settings.xtermjs.transparent_background")}
        description={t("settings.xtermjs.transparent_hint")}
        defaultChecked={settings.transparentBackground}
        onChange={async (checked) => {
          await commitSettings(
            setSettings((current) => ({
              ...current,
              transparentBackground: checked,
            }))
          );
          toast.success(t("settings.settings_saved"));
        }}
        className="km-setting-card"
      />

      {themeBackgroundIsOpaque && (
        <Callout.Root color="amber" size="1">
          <Callout.Icon>
            <AlertTriangle size={16} />
          </Callout.Icon>
          <Callout.Text>
            {t("settings.xtermjs.transparent_theme_hint")}
          </Callout.Text>
        </Callout.Root>
      )}

      <SettingCardShortTextInput
        title={t("settings.xtermjs.terminal_padding")}
        descriptionPlacement="footer"
        defaultValue={settings.terminalPadding?.toString() || "16"}
        placeholder="16"
        inputMode="numeric"
        isSaving={saving}
        OnSave={async (value) => {
          await saveIntegerField(
            t("settings.xtermjs.terminal_padding"),
            value,
            0,
            (current) => ({
              ...current,
              terminalPadding: Number.parseInt(value.trim(), 10),
            })
          );
        }}
      />

      <SettingCardLongTextInput
        title={t("settings.xtermjs.theme_json")}
        description={t("settings.xtermjs.theme_json_description")}
        descriptionPlacement="footer"
        defaultValue={formatXtermThemeJson(settings.terminalOptions.theme)}
        isSaving={saving}
        OnSave={handleThemeJsonSave}
      />

      <SettingCardLongTextInput
        title={t("settings.xtermjs.custom_css")}
        description={t("settings.xtermjs.custom_css_description")}
        descriptionPlacement="footer"
        defaultValue={settings.customCss || ""}
        isSaving={saving}
        OnSave={handleCustomCssSave}
      />
    </Flex>
  );
}
