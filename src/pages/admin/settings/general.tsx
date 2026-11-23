import { useTranslation } from "react-i18next";
import { Button, Code, Flex, Text, TextField } from "@radix-ui/themes";
import { api } from "@/lib/http";
import {
  SettingCardButton,
  SettingCardCollapse,
  SettingCardLabel,
  SettingCardSelect,
  SettingCardShortTextInput,
  SettingCardsLoading,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import React from "react";
import { toast } from "sonner";
import { useRouteQuery } from "@/lib/routeData";
import { DEFAULT_SETTINGS, settingsErrorText, settingsQuery } from "@/routeQueries/settings";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_VARIANTS } from "@/lib/motion";
import { ApiKeyCard } from "./shared/ApiKeyCard";
import { getJsonBody, saveSettings, serverError } from "./shared/request";
import { TRAFFIC_TIMEZONE_SUGGESTIONS } from "@/utils/timezones";

export default function GeneralSettings() {
  const { t } = useTranslation();
  // 页面切换时设置已由 routePreload 提前请求；等待预算内到达直接显示，否则设置卡显示色块
  const settingsResult = useRouteQuery(settingsQuery);
  const settings = settingsResult.data ?? DEFAULT_SETTINGS;
  const loading = settingsResult.loading;
  const error = settingsErrorText(settingsResult.error);
  const [geoip_testResult, setGeoipTestResult] = React.useState<string | null>(
    null
  );
  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    // 布局与 settings/_layout 的内层一致（flex-column + block 档）；加载中每张设置卡各自显示色块
    <div className="flex w-full flex-col gap-km-block">
      <SettingCardsLoading loading={loading}>
      <SettingCardLabel>
        {t("settings.general.auto_discovery")}
      </SettingCardLabel>
      <ApiKeyCard
        settingKey="auto_discovery_key"
        savedValue={settings?.auto_discovery_key}
        title={t("settings.general.auto_discovery_key")}
        description={t("settings.general.auto_discovery_key_description")}
        length={24}
      >
        <Button
          variant="soft"
          color="mint"
          onClick={() => {
            window.open(
              "https://komari-document.pages.dev/install/agent-ad.html",
              "_blank"
            );
          }}
        >
          {t("common.help")}
        </Button>
      </ApiKeyCard>
      <SettingCardShortTextInput
        title={t("settings.general.traffic_timezone")}
        description={t("settings.general.traffic_timezone_description")}
        defaultValue={settings.traffic_default_timezone ?? ""}
        placeholder="Asia/Shanghai"
        list="global-traffic-timezones"
        OnSave={async (value) => {
          const timezone = value.trim();
          if (timezone) {
            try {
              new Intl.DateTimeFormat(undefined, { timeZone: timezone });
            } catch {
              toast.error(t("settings.general.traffic_timezone_invalid"));
              throw new Error("Invalid time zone");
            }
          }
          await saveSettings({ traffic_default_timezone: timezone }, t);
        }}
      >
        <datalist id="global-traffic-timezones">
          {TRAFFIC_TIMEZONE_SUGGESTIONS.map((zone) => <option key={zone} value={zone} />)}
        </datalist>
      </SettingCardShortTextInput>
      <SettingCardLabel>{t("settings.geoip.title")}</SettingCardLabel>
      <SettingCardSwitch
        title={t("settings.geoip.enable_title")}
        description={t("settings.geoip.enable_description")}
        defaultChecked={settings.geo_ip_enabled}
        onChange={async (checked) => {
          await saveSettings({ geo_ip_enabled: checked }, t);
        }}
        className="km-page-admin-settings-general km-setting-card"
      />
      <SettingCardSelect
        title={t("settings.geoip.provider_title")}
        description={t("settings.geoip.provider_description")}
        defaultValue={settings.geo_ip_provider}
        options={[
          { value: "empty", label: t("common.none") },
          { value: "mmdb", label: "MaxMind" },
          { value: "ip-api", label: "ip-api.com" },
          { value: "geojs", label: "geojs.io" },
          { value: "ipinfo", label: "ipinfo.io" },
        ]}
        OnSave={async (value) => {
          await saveSettings({ geo_ip_provider: value }, t);
        }}
      />
      <SettingCardButton
        title={t("settings.geoip.update_title")}
        onClick={async () => {
          try {
            await api.post("/api/admin/update/mmdb");
            toast.success(t("settings.geoip.update_success"));
          } catch (error) {
            const failure = serverError(error);
            if (!failure) throw error;
            toast.error(failure.message || t("settings.geoip.update_error"));
          }
        }}
        className="km-setting-card"
      >
        {t("common.update")}
      </SettingCardButton>
      <SettingCardCollapse
        title={t("settings.geoip.test_title")}
        description={t("settings.geoip.test_description")}
      >
        <Flex className="w-full gap-2" direction="column">
          <TextField.Root placeholder="1.1.1.1 or 2606:4700:4700::1111"></TextField.Root>
          <div>
            <Button
              variant="solid"
              onClick={async () => {
                const ip = (
                  document.querySelector(
                    "input[placeholder]"
                  ) as HTMLInputElement
                ).value;
                const data = await getJsonBody<any>(`/api/admin/test/geoip?ip=${ip}`);
                setGeoipTestResult(
                  JSON.stringify(data.data, null, 2) || t("common.no_results")
                );
              }}
            >
              {t("settings.geoip.test_button")}
            </Button>
          </div>{" "}
          <Flex className="w-full">
            {/*
              feedback 性格：测试结果出现/消失时高度弹簧展开（MOTION_VARIANTS.collapse），
              下方内容被平滑推开；外层 SettingCardCollapse 的 AutoHeight 跟随卡片总高度。
            */}
            <AnimatePresence initial={false}>
              {geoip_testResult && (
                <motion.div
                  key="geoip-result"
                  className="w-full"
                  variants={MOTION_VARIANTS.collapse}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <Code
                    className="w-full whitespace-pre-wrap text-sm p-3 rounded-md overflow-auto max-h-96"
                    style={{ display: "block" }}
                  >
                    {geoip_testResult}
                  </Code>
                </motion.div>
              )}
            </AnimatePresence>
          </Flex>
        </Flex>
      </SettingCardCollapse>
      </SettingCardsLoading>
    </div>
  );
}
