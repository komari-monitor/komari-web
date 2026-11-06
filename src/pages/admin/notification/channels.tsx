import React, { useMemo } from "react";
import { Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Skeletonize } from "@/components/ui/skeleton";
import { AutoHeight } from "@/components/motion";
import ConfigFormTabs, {
  type ConfigFormItem,
} from "@/components/admin/ConfigFormTabs";
import {
  SettingCardButton,
  SettingCardLabel,
  SettingCardLongTextInput,
  SettingCardSelect,
  SettingCardSwitch,
  SettingCardsLoading,
} from "@/components/admin/SettingCard";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { updateSettingsWithToast } from "@/lib/api";
import { useRouteQuery } from "@/lib/routeData";
import {
  DEFAULT_SETTINGS,
  notificationChannelsQuery,
  settingsErrorText,
  settingsQuery,
  type NotificationChannel,
} from "@/routeQueries/ops";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_VARIANTS } from "@/lib/motion";
import { resolveI18nText, type I18nText } from "@/utils/i18nText";
import type { ThemeConfiguration } from "@/utils/themeConfiguration";

const NO_CHANNELS: NotificationChannel[] = [];

interface ChannelConfigurationResponse {
  configuration?: ThemeConfiguration;
  data?: Record<string, unknown>;
}

const NotificationSettings = () => {
  const { t, i18n } = useTranslation();
  const { call } = useRPC2Call();
  // 设置与渠道列表由 routePreload 在切换页面时并行提前请求（src/routeQueries/ops.ts）
  const settingsResult = useRouteQuery(settingsQuery);
  const settings = settingsResult.data ?? DEFAULT_SETTINGS;
  const error = settingsErrorText(settingsResult.error);
  const loading = settingsResult.loading;
  const channelsResult = useRouteQuery(notificationChannelsQuery);
  const channels = channelsResult.data ?? NO_CHANNELS;
  const [currentChannel, setCurrentChannel] = React.useState("");
  const [configuration, setConfiguration] =
    React.useState<ThemeConfiguration>();
  const [values, setValues] = React.useState<Record<string, any>>({});
  const [configLoading, setConfigLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  // 渠道列表请求中（含刷新）或渠道配置请求中
  const channelLoading = channelsResult.loading || configLoading;
  const channelError =
    channelsResult.error && !channelsResult.loading
      ? channelsResult.error instanceof Error
        ? channelsResult.error.message
        : t("settings.notification.provider_fetch_failed")
      : "";

  const currentLanguage =
    i18n.resolvedLanguage || i18n.language || navigator.language;

  // 渠道列表（重新）到达且设置已到：选中设置里保存的渠道（与原实现一致，每次拿到列表都重置）
  const savedMethod = settings.notification_method || "";
  const [adopted, setAdopted] = React.useState<{
    list: NotificationChannel[];
    method: string;
  } | null>(null);
  if (
    !loading &&
    channelsResult.data &&
    (adopted?.list !== channelsResult.data || adopted.method !== savedMethod)
  ) {
    setAdopted({ list: channelsResult.data, method: savedMethod });
    setCurrentChannel(savedMethod || "none");
  }

  // 切换界面语言时重新拉取渠道列表（原实现的 effect 依赖 t）
  const reloadChannels = channelsResult.reload;
  const initialT = React.useRef(t);
  React.useEffect(() => {
    if (initialT.current === t) return;
    initialT.current = t;
    void reloadChannels();
  }, [t, reloadChannels]);

  React.useEffect(() => {
    if (!currentChannel || currentChannel === "none") {
      setConfiguration(undefined);
      setValues({});
      return;
    }
    setConfigLoading(true);
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
      .finally(() => setConfigLoading(false));
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

  // 首屏：设置或渠道列表还没到，整页用真实结构渲染骨架（不再 early return）
  const pageLoading = loading || (channelLoading && channels.length === 0);
  if (error) {
    return <Text color="red">{error}</Text>;
  }
  if (channelError) {
    return <Text color="red">{channelError}</Text>;
  }

  return (
    // 加载中每张设置卡各自画成同尺寸色块，小标题照常显示
    <SettingCardsLoading loading={pageLoading}>
    <div className="flex w-full flex-col gap-km-block">
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
      {/*
        content 层：「渠道不可用」提示与渠道配置表单出现/消失时高度弹簧展开/收起；
        切换渠道时表单保持同一块 DOM：配置请求慢时旧字段淡成骨架，新字段到达后再淡入，
        字段数变化由 AutoHeight 平滑过渡（不再整块卸载重挂）。
      */}
      <AnimatePresence initial={false}>
      {currentChannel && !currentRegistered && currentChannel !== "none" ? (
        <motion.div
          key="unavailable"
          variants={MOTION_VARIANTS.collapse}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <Text color="gray">
            {t(
              "settings.notification.channel_unavailable",
              "This notification channel is not currently registered.",
            )}
          </Text>
        </motion.div>
      ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
      {currentRegistered && items.length > 0 ? (
        <motion.div
          key="channel-config"
          variants={MOTION_VARIANTS.collapse}
          initial="initial"
          animate="animate"
          exit="exit"
        >
        <AutoHeight>
        <Skeletonize loading={channelLoading && !pageLoading}>
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
        </Skeletonize>
        </AutoHeight>
        </motion.div>
      ) : null}
      </AnimatePresence>
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
    </div>
    </SettingCardsLoading>
  );
};

export default NotificationSettings;
