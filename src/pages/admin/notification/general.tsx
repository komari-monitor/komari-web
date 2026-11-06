import { useTranslation } from "react-i18next";
import { Text } from "@radix-ui/themes";
import { updateSettingsWithToast } from "@/lib/api";
import { useRouteQuery } from "@/lib/routeData";
import { DEFAULT_SETTINGS, settingsErrorText, settingsQuery } from "@/routeQueries/ops";
import {
  SettingCardLabel,
  SettingCardShortTextInput,
  SettingCardSwitch,
  SettingCardsLoading,
} from "@/components/admin/SettingCard";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
const GeneralNotification = () => {
  const { t } = useTranslation();
  // 不在 settings/_layout 下：用统一页面骨架（km-page + PageHeader），页边距交给后台内容区
  return (
    <div className="km-page km-page-admin-notification-general km-notification-general-form">
      <PageHeader title={t("notification.general.title")} />
      <Inner />
    </div>
  );
};

const Inner = () => {
  const { t } = useTranslation();
  // 设置由 routePreload 在切换页面时提前请求（src/routeQueries/ops.ts）
  const settingsResult = useRouteQuery(settingsQuery);
  const settings = settingsResult.data ?? DEFAULT_SETTINGS;
  const error = settingsErrorText(settingsResult.error);
  const loading = settingsResult.loading;

  if (error) {
    return <Text color="red">{error}</Text>;
  }
  // 加载中渲染真实设置卡片（默认值），每张卡各自画成同尺寸色块；小标题照常显示，数据到达后原地淡入
  // 卡片栈与设置页一致：block 档；小标题 km-section-title 上 section 下 group
  return (
    <SettingCardsLoading loading={loading}>
    <div className="flex flex-col gap-km-block">
      <SettingCardLabel>
        {t("admin.notification.expire_title")}
      </SettingCardLabel>
      <SettingCardSwitch
        defaultChecked={settings.expire_notification_enabled}
        title={t("admin.notification.expire_enable")}
        description={t("admin.notification.expire_enable_description")}
        onChange={async (checked) => {
          await updateSettingsWithToast(
            { expire_notification_enabled: checked },
            t
          );
        }}
      />
      <SettingCardShortTextInput
        type="number"
        title={t("admin.notification.expire_time")}
        description={t("admin.notification.expire_time_description")}
        defaultValue={settings.expire_notification_lead_days}
        OnSave={async (value) => {
          const numValue = Number(value);
          if (isNaN(numValue) || numValue < 0) {
            toast.error("Please enter a valid non-negative number");
            return;
          }
          await updateSettingsWithToast(
            { expire_notification_lead_days: numValue },
            t
          );
        }}
      />
      <SettingCardLabel>{t("admin.notification.login")}</SettingCardLabel>
      <SettingCardSwitch
        title={t("admin.notification.login")}
        description={t("admin.notification.login_description")}
        defaultChecked={settings.login_notification}
        onChange={async (checked) => {
          await updateSettingsWithToast(
            { login_notification: checked },
            t
          );
        }}
      />
      <SettingCardLabel>{t("admin.notification.traffic")}</SettingCardLabel>
      <SettingCardShortTextInput
        title={t("admin.notification.traffic")}
        description={t("admin.notification.traffic_description")}
        defaultValue={settings.traffic_limit_percentage}
        type="number"
        OnSave={async (value) => {
          await updateSettingsWithToast(
            { traffic_limit_percentage: Number(value) },
            t
          );
        }}
      />
    </div>
    </SettingCardsLoading>
  );
};

export default GeneralNotification;
