import React, { useMemo } from "react";
import { Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import Loading from "@/components/loading";
import ConfigFormTabs, {
  type ConfigFormItem,
} from "@/components/admin/ConfigFormTabs";
import {
  SettingCardButton,
  SettingCardLabel,
  SettingCardLongTextInput,
  SettingCardSelect,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { updateSettingsWithToast, useSettings } from "@/lib/api";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";
import type { ThemeConfiguration } from "@/utils/themeConfiguration";

interface NotificationChannel {
  id: string;
  configuration?: ThemeConfiguration;
}

interface ChannelConfigurationResponse {
  configuration?: ThemeConfiguration;
  data?: Record<string, unknown>;
}

const NotificationSettings = () => {
  const { t, i18n } = useTranslation();
  const { call } = useRPC2Call();
  const { settings, loading, error } = useSettings();
  const [channels, setChannels] = React.useState<NotificationChannel[]>([]);
  const [currentChannel, setCurrentChannel] = React.useState("");
  const [configuration, setConfiguration] =
    React.useState<ThemeConfiguration>();
  const [values, setValues] = React.useState<Record<string, any>>({});
  const [channelLoading, setChannelLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [channelError, setChannelError] = React.useState("");

  const currentLanguage =
    i18n.resolvedLanguage || i18n.language || navigator.language;

  React.useEffect(() => {
    if (loading) return;
    setChannelLoading(true);
    setChannelError("");
    call<unknown, NotificationChannel[]>("admin:listNotificationChannels")
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setChannels(list);
        const selected = settings.notification_method || "";
        setCurrentChannel(selected || "none");
      })
      .catch((err) => {
        setChannelError(
          err instanceof Error
            ? err.message
            : t("settings.notification.provider_fetch_failed"),
        );
      })
      .finally(() => setChannelLoading(false));
  }, [call, loading, settings.notification_method, t]);

  React.useEffect(() => {
    if (!currentChannel || currentChannel === "none") {
      setConfiguration(undefined);
      setValues({});
      return;
    }
    setChannelLoading(true);
    setChannelError("");
    call<{ id: string }, ChannelConfigurationResponse>(
      "admin:getNotificationChannelConfiguration",
      { id: currentChannel },
    )
      .then((result) => {
        setConfiguration(result?.configuration);
        setValues(result?.data || {});
      })
      .catch(() => {
        setConfiguration(undefined);
        setValues({});
      })
      .finally(() => setChannelLoading(false));
  }, [call, currentChannel]);

  const channelOptions = useMemo(() => {
    const registered = [
      {
        value: "none",
        label: t("common.none"),
      },
      ...channels.map((channel) => ({
        value: channel.id,
        label:
          resolveI18nText(
            channel.configuration?.name as I18nText,
            currentLanguage,
          ) || channel.id,
      })),
    ];
    if (
      currentChannel &&
      currentChannel !== "none" &&
      !registered.some((channel) => channel.value === currentChannel)
    ) {
      registered.push({
        value: currentChannel,
        label: `${currentChannel} (${t(
          "settings.notification.unavailable",
          "Unavailable",
        )})`,
      });
    }
    return registered;
  }, [channels, currentChannel, currentLanguage, t]);

  const currentRegistered = channels.some(
    (channel) => channel.id === currentChannel,
  );
  const items = Array.isArray(configuration?.data)
    ? (configuration.data as ConfigFormItem[])
    : [];

  const saveConfiguration = async () => {
    if (!currentChannel || !currentRegistered) return;
    setSaving(true);
    try {
      await call("admin:setNotificationChannelConfiguration", {
        id: currentChannel,
        data: values,
      });
      toast.success(t("common.success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading || (channelLoading && channels.length === 0)) {
    return <Loading />;
  }
  if (error) {
    return <Text color="red">{error}</Text>;
  }
  if (channelError) {
    return <Text color="red">{channelError}</Text>;
  }

  return (
    <>
      <SettingCardLabel>{t("settings.notification.title")}</SettingCardLabel>
      <SettingCardSwitch
        title={t("settings.notification.enable")}
        description={t("settings.notification.enable_description")}
        defaultChecked={settings.notification_enabled}
        onChange={async (checked) => {
          await updateSettingsWithToast(
            { notification_enabled: checked },
            t,
          );
        }}
        className="km-page-admin-settings-notification km-setting-card"
      />
      <SettingCardLongTextInput
        title={t("settings.notification.template")}
        description={t("settings.notification.template_description")}
        defaultValue={settings.notification_template}
        OnSave={async (value) => {
          await updateSettingsWithToast(
            { notification_template: value },
            t,
          );
        }}
      />
      <SettingCardSelect
        title={t("settings.notification.method")}
        description={t("settings.notification.method_description")}
        options={channelOptions}
        value={currentChannel}
        OnSave={async (value) => {
          if (value === currentChannel) return;
          await updateSettingsWithToast(
            { notification_method: value },
            t,
          );
          setCurrentChannel(value);
        }}
      />
      {currentChannel && !currentRegistered && currentChannel !== "none" ? (
        <Text color="gray">
          {t(
            "settings.notification.channel_unavailable",
            "This notification channel is not currently registered.",
          )}
        </Text>
      ) : null}
      {currentRegistered && items.length > 0 ? (
        <ConfigFormTabs
          items={items}
          values={values}
          onValueChange={(key, value) =>
            setValues((current) => ({ ...current, [key]: value }))
          }
          resolveText={(value) => resolveI18nText(value, currentLanguage)}
          className="km-notification-channel-config"
          fillHeight={false}
          header={
            <Text weight="bold">
              {t("settings.notification.provider_fields")}
            </Text>
          }
          footer={
            <SettingCardButton
              title={t("settings.notification.provider_fields")}
              description={t(
                "settings.notification.provider_fields_description",
              )}
              onClick={saveConfiguration}
            >
              {saving ? t("common.saving") : t("common.save")}
            </SettingCardButton>
          }
        />
      ) : null}
      <SettingCardButton
        title={t("settings.notification.test_title")}
        description={t("settings.notification.test_description")}
        onClick={async () => {
          try {
            await call("admin:testSendMessage");
            toast.success(t("common.success"));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        }}
        className="km-setting-card"
      >
        GO
      </SettingCardButton>
    </>
  );
};

export default NotificationSettings;
