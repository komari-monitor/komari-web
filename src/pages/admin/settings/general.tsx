import { useTranslation } from "react-i18next";
import { Button, Code, Flex, Text, TextField } from "@radix-ui/themes";
import {
  updateSettingsWithToast,
  useSettings,
  type SettingsResponse,
} from "@/lib/api";
import {
  SettingCard,
  SettingCardButton,
  SettingCardCollapse,
  SettingCardLabel,
  SettingCardSelect,
  SettingCardShortTextInput,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import { Dialog } from "@radix-ui/themes";


import React from "react";
import { toast } from "sonner";
import Loading from "@/components/loading";
import { formatBytes } from "@/utils/unitHelper";
export default function GeneralSettings() {
  const { t } = useTranslation();
  const { settings, loading, error } = useSettings();
  const [geoip_testResult, setGeoipTestResult] = React.useState<string | null>(
    null
  );
  if (loading) {
    return <Loading text="creeper?" />;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    <>
      <SettingCardLabel>
        {t("settings.general.auto_discovery")}
      </SettingCardLabel>
      <ApiCard settings={settings} />
      <label className="text-xl font-bold">{t("settings.geoip.title")}</label>
      <SettingCardSwitch
        title={t("settings.geoip.enable_title")}
        description={t("settings.geoip.enable_description")}
        defaultChecked={settings.geo_ip_enabled}
        onChange={async (checked) => {
          await updateSettingsWithToast({ geo_ip_enabled: checked }, t);
        }}
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
          await updateSettingsWithToast({ geo_ip_provider: value }, t);
        }}
      />
      <SettingCardButton
        title={t("settings.geoip.update_title")}
        onClick={async () => {
          const result = await fetch("/api/admin/update/mmdb", {
            method: "POST",
          });
          const data = await result.json();
          if (data.status === "success") {
            toast.success(t("settings.geoip.update_success"));
          } else {
            toast.error(
              data.message || t("settings.geoip.update_error")
            );
          }
        }}
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
                const result = await fetch(`/api/admin/test/geoip?ip=${ip}`);
                const data = await result.json();
                setGeoipTestResult(
                  JSON.stringify(data.data, null, 2) || t("common.no_results")
                );
              }}
            >
              {t("settings.geoip.test_button")}
            </Button>
          </div>{" "}
          <Flex className="w-full">
            {geoip_testResult && (
              <Code
                className="w-full whitespace-pre-wrap text-sm p-3 rounded-md overflow-auto max-h-96"
                style={{ display: "block" }}
              >
                {geoip_testResult}
              </Code>
            )}
          </Flex>
        </Flex>
      </SettingCardCollapse>
      <SettingCardLabel>{t("settings.database.title")}</SettingCardLabel>
      <DatabaseCard />
      <SettingCardLabel>{t("settings.nezha.title")}</SettingCardLabel>

      <label className="text-sm text-muted-foreground -mt-4">
        {t("settings.nezha.description")}
      </label>
      <SettingCardSwitch
        title={t("settings.nezha.enabled")}
        description={t("settings.nezha.enabled_description")}
        defaultChecked={settings.nezha_compat_enabled}
        onChange={async (checked) => {
          await updateSettingsWithToast({ nezha_compat_enabled: checked }, t);
        }}
      />
      <SettingCardShortTextInput
        title={t("settings.nezha.listen")}
        description={t("settings.nezha.listen_description")}
        defaultValue={settings.nezha_compat_listen || ""}
        placeholder="0.0.0.0:5555"
        OnSave={async (value) => {
          await updateSettingsWithToast({ nezha_compat_listen: value }, t);
        }}
      />
    </>
  );
}

const DatabaseCard = () => {
  const { t } = useTranslation();
  const [size, setSize] = React.useState<number | null>(null);
  const [dbType, setDbType] = React.useState<string>("");
  const [vacuuming, setVacuuming] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const fetchSize = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/database/size");
      const data = await res.json();
      if (data.status === "success" && data.data) {
        setSize(typeof data.data.size === "number" ? data.data.size : null);
        setDbType(data.data.type || "");
      }
    } catch {
      // 忽略读取失败，保持未知状态
    }
  }, []);

  React.useEffect(() => {
    fetchSize();
  }, [fetchSize]);

  const handleVacuum = async () => {
    setVacuuming(true);
    try {
      const res = await fetch("/api/admin/database/vacuum", {
        method: "POST",
      });
      const data = await res.json();
      if (data.status === "success") {
        const after =
          data.data && typeof data.data.after === "number"
            ? data.data.after
            : null;
        if (after !== null) {
          setSize(after);
        } else {
          await fetchSize();
        }
        toast.success(t("settings.database.vacuum_success"));
      } else {
        toast.error(data.message || t("settings.database.vacuum_error"));
      }
    } catch (e) {
      toast.error(t("settings.database.vacuum_error") + ": " + e);
    } finally {
      setVacuuming(false);
      setConfirmOpen(false);
    }
  };

  const sizeText = size !== null ? formatBytes(size) : t("common.unknown");
  const isSQLite = dbType === "" || dbType === "sqlite";

  return (
    <SettingCard
      title={t("settings.database.vacuum_title")}
      description={t("settings.database.vacuum_description", {
        size: sizeText,
      })}
    >
      <SettingCard.Action>
        <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Dialog.Trigger>
            <Button
              variant="solid"
              color="orange"
              disabled={vacuuming || !isSQLite}
            >
              {vacuuming
                ? t("settings.database.vacuuming")
                : t("settings.database.vacuum_button")}
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>
              {t("settings.database.vacuum_title")}
            </Dialog.Title>
            <Dialog.Description size="2">
              {t("settings.database.vacuum_confirm")}
            </Dialog.Description>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" disabled={vacuuming}>
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              <Button
                variant="solid"
                color="orange"
                disabled={vacuuming}
                onClick={(e) => {
                  e.preventDefault();
                  handleVacuum();
                }}
              >
                {vacuuming
                  ? t("settings.database.vacuuming")
                  : t("settings.database.vacuum_button")}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </SettingCard.Action>

    </SettingCard>
  );
};

const ApiCard = ({ settings }: { settings: SettingsResponse }) => {

  //const { settings } = useSettings();
  const { t } = useTranslation();
  const [apiValues, setApiValues] = React.useState<string>(
    settings?.auto_discovery_key || ""
  );

  // 生成32位随机字符串
  const generateRandomString = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // 处理生成按钮点击
  const handleGenerateApiKey = () => {
    const newApiKey = generateRandomString();
    setApiValues(newApiKey);
  };

  // 初始化API值
  React.useEffect(() => {
    if (settings?.auto_discovery_key) {
      setApiValues(settings.auto_discovery_key);
    }
  }, [settings?.auto_discovery_key]);

  return (
    <SettingCardShortTextInput
      title={t("settings.general.auto_discovery_key")}
      description={t("settings.general.auto_discovery_key_description")}
      value={apiValues}
      onChange={(e) => setApiValues(e.target.value)}
      OnSave={async (values) => {
        if (!values) {
          await updateSettingsWithToast({ auto_discovery_key: "" }, t);
          return;
        }
        if (values.length < 12) {
          toast.error(t("settings.api.key_length_error"));
          return;
        }
        await updateSettingsWithToast({ auto_discovery_key: values }, t);
      }}
    >
      <div className="flex flex-row gap-2 justify-start items-center">
        <Button variant="soft" color="green" onClick={handleGenerateApiKey}>
          {t("common.generate")}
        </Button>
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
      </div>
    </SettingCardShortTextInput>
  );
};
