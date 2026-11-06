import { useTranslation } from "react-i18next";
import { Text } from "@radix-ui/themes";
import { SettingCardLongTextInput, SettingCardsLoading } from "@/components/admin/SettingCard";
import { StaggeredItem, StaggeredList } from "@/components/motion";
import { useRouteQuery } from "@/lib/routeData";
import { DEFAULT_SETTINGS, settingsErrorText, settingsQuery } from "@/routeQueries/settings";
import { saveSettings } from "./shared/request";

export default function CustomSettings() {
  const { t } = useTranslation();
  // 页面切换时设置已由 routePreload 提前请求；等待预算内到达直接显示，否则设置卡显示色块
  const settingsResult = useRouteQuery(settingsQuery);
  const settings = settingsResult.data ?? DEFAULT_SETTINGS;
  const loading = settingsResult.loading;
  const error = settingsErrorText(settingsResult.error);

  // 加载中直接渲染真实卡片（空值），每张卡画成同尺寸的色块；数据到达后原地淡入
  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    <div className="km-page-admin-settings-custom">
      <SettingCardsLoading loading={loading}>
        {/* content 性格：页内只有一张卡，仍走统一的错峰容器，保证和别的设置页节奏一致 */}
        <StaggeredList className="flex w-full flex-col gap-km-block">
          <StaggeredItem>
            <SettingCardLongTextInput
              title={t("settings.custom.header")}
              description={t("settings.custom.header_description")}
              defaultValue={settings.custom_head || ""}
              OnSave={async (data) => {
                await saveSettings({ custom_head: data }, t);
              }}
            />
          </StaggeredItem>
        </StaggeredList>
      </SettingCardsLoading>
    </div>
  );
}
