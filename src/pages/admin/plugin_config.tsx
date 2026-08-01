import { useCallback, useEffect, useState } from "react";
import { Blocks } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
} from "@radix-ui/themes";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import Loading from "@/components/loading";
import {
  SettingCardLongTextInput,
  SettingCardSelect,
  SettingCardShortTextInput,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { resolveI18nText } from "@/utils/i18nText";
import { iconMap, resolvePluginIcon } from "@/utils/iconHelper";
import type { I18nText } from "@/utils/i18nText";
import type { PluginConfiguration, PluginInfo, PluginConfigItem } from "@/types/plugin";

interface ConfigurationResponse {
  configuration?: PluginConfiguration;
  data?: Record<string, any>;
}

// 渲染插件 icon：lucide 名用组件，URL/相对路径用 img，否则默认 Blocks。
const renderPluginIcon = (
  plugin: PluginInfo,
  size: number,
  className: string,
  opacity: number,
) => {
  const icon = resolvePluginIcon(plugin.short, plugin.icon);
  if (!icon) {
    return <Blocks size={size} className={className} style={{ opacity }} />;
  }
  const Cmp = iconMap[icon];
  if (Cmp) {
    return <Cmp size={size} className={className} style={{ opacity }} />;
  }
  return (
    <img
      src={icon}
      alt=""
      className={`${className} object-contain`}
      style={{ opacity }}
    />
  );
};

// 插件配置：左侧插件列表，右侧具体插件的配置项（与主题配置一致）。
export default function PluginConfigPage() {
  const { call } = useRPC2Call();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "";

  const [searchParams] = useSearchParams();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PluginInfo | null>(null);
  const [autoSelectDone, setAutoSelectDone] = useState(false);
  const [configuration, setConfiguration] = useState<PluginConfiguration | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayText = useCallback(
    (value: I18nText | undefined) => resolveI18nText(value, language) || "",
    [language],
  );



  const loadList = useCallback(async () => {
    try {
      const result = await call<any, PluginInfo[]>("admin:listPlugins");
      setPlugins(Array.isArray(result) ? result : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [call]);

  useEffect(() => {
    loadList().finally(() => setLoading(false));
  }, [loadList]);


  const selectPlugin = useCallback(async (plugin: PluginInfo) => {
    setSelected(plugin);
    setConfiguration(null);
    setValues({});
    setError(null);
    try {
      const result = await call<any, ConfigurationResponse>("admin:getPluginConfiguration", {
        short: plugin.short,
      });
      const configuration = result?.configuration || {};
      setConfiguration(configuration);
      const items: PluginConfigItem[] = Array.isArray(configuration.data)
        ? configuration.data
        : [];
      const init: Record<string, any> = {};
      items.forEach((item) => {
        if (item.type !== "title" && item.key) {
          const saved = result?.data?.[item.key];
          init[item.key] = saved !== undefined ? saved : item.default;
        }
      });
      setValues(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [call]);
  // 从插件管理页跳转过来时（?short=xxx）自动选中对应插件。
  useEffect(() => {
    if (loading || autoSelectDone) return;
    const target = searchParams.get("short");
    if (!target || plugins.length === 0) return;
    const plugin = plugins.find((item) => item.short === target);
    if (plugin) {
      setAutoSelectDone(true);
      selectPlugin(plugin);
    }
  }, [loading, autoSelectDone, searchParams, plugins, selectPlugin]);

  const handleValueChange = (key: string, value: any) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const saveAll = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await call("admin:setPluginConfiguration", {
        short: selected.short,
        data: values,
      });
      toast.success(t("plugin.config_saved", "Configuration saved"));
    } catch (e) {
      toast.error(
        `${t("plugin.config_save_failed", "Failed to save configuration")}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const items: PluginConfigItem[] = Array.isArray(configuration?.data)
    ? configuration.data
    : [];
  const hasItems = items.some((item) => item.type !== "title");

  return (
    <Box className="p-4">
      <Flex align="center" gap="2" mb="3">
        <Blocks size={20} />
        <Heading size="4">{t("plugin.config", "Configuration")}</Heading>
      </Flex>
      <Separator size="4" mb="4" />
      <Flex direction={{ initial: "column", md: "row" }} gap="4" align="start">
        {/* 左侧：插件列表 */}
        <Card className="w-full md:w-64 shrink-0">
          <Flex direction="column" gap="1">
            {plugins.length === 0 && (
              <Text size="2" color="gray">
                {t("plugin.no_plugins", "No plugins installed yet")}
              </Text>
            )}
            {plugins.map((plugin) => {
              const isActive = selected?.short === plugin.short;
              return (
                <button
                  key={plugin.short}
                  type="button"
                  onClick={() => selectPlugin(plugin)}
                  className="group flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors duration-200 hover:bg-accent-3"
                  style={{
                    borderLeft: isActive
                      ? "4px solid var(--accent-8)"
                      : "4px solid transparent",
                    backgroundColor: isActive ? "var(--accent-4)" : "transparent",
                    color: isActive ? "var(--accent-10)" : "inherit",
                  }}
                >
                  {renderPluginIcon(plugin, 16, "h-5 w-5 shrink-0", isActive ? 1 : 0.7)}
                  <Text
                    size="2"
                    weight={isActive ? "bold" : "medium"}
                    className="min-w-0 truncate"
                  >
                    {displayText(plugin.name) || plugin.short}
                  </Text>
                </button>
              );
            })}
          </Flex>
        </Card>

        {/* 右侧：配置项 */}
        <Flex direction="column" gap="3" className="min-w-0 flex-1">
          {!selected && (
            <Callout.Root>
              <Callout.Text>{t("plugin.config_select_hint", "Select a plugin to configure")}</Callout.Text>
            </Callout.Root>
          )}
          {selected && error && (
            <Callout.Root color="red">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}
          {selected && !error && !hasItems && (
            <Callout.Root>
              <Callout.Text>{t("plugin.config_no_items", "This plugin has no configuration items")}</Callout.Text>
            </Callout.Root>
          )}
          {selected && !error && hasItems && (
            <>
              <Flex justify="between" align="center">
                <Text weight="bold">
                  {displayText(selected.name) || selected.short}
                </Text>
                <Button onClick={saveAll} disabled={saving}>
                  {saving ? t("plugin.config_saving", "Saving...") : t("common.save")}
                </Button>
              </Flex>
              <Flex direction="column" gap="3">
                {items.map((item, index) => {
                  if (item.type === "title") {
                    return (
                      <Heading key={index} size="3" className="mt-4">
                        {displayText(item.name) || t("common.title")}
                      </Heading>
                    );
                  }
                  if (!item.key) return null;
                  const value = values[item.key];
                  const title = displayText(item.name);
                  const description = displayText(item.help);
                  switch (item.type) {
                    case "switch":
                      return (
                        <SettingCardSwitch
                          key={item.key}
                          title={title}
                          description={description}
                          defaultChecked={!!value}
                          onChange={(checked) => handleValueChange(item.key!, checked)}
                        />
                      );
                    case "select": {
                      const options = (item.options || "")
                        .split(",")
                        .map((option) => option.trim())
                        .filter(Boolean)
                        .map((option) => ({ value: option }));
                      return (
                        <SettingCardSelect
                          key={item.key}
                          title={title}
                          description={description}
                          value={value}
                          options={options}
                          OnSave={(v) => handleValueChange(item.key!, v)}
                          label={value !== undefined ? String(value) : t("common.select")}
                        />
                      );
                    }
                    case "number":
                      return (
                        <SettingCardShortTextInput
                          key={item.key}
                          title={title}
                          description={description}
                          type="number"
                          showSaveButton={false}
                          value={value !== undefined ? String(value) : ""}
                          onChange={(event) =>
                            handleValueChange(
                              item.key!,
                              event.target.value === ""
                                ? undefined
                                : Number(event.target.value),
                            )
                          }
                        />
                      );
                    case "richtext":
                      return (
                        <SettingCardLongTextInput
                          key={item.key}
                          title={title}
                          description={description}
                          defaultValue={value !== undefined ? String(value) : ""}
                          showSaveButton={false}
                          onChange={(event) =>
                            handleValueChange(item.key!, event.target.value)
                          }
                        />
                      );
                    case "string":
                    default:
                      return (
                        <SettingCardShortTextInput
                          key={item.key}
                          title={title}
                          description={description}
                          value={value !== undefined ? String(value) : ""}
                          required={item.required}
                          showSaveButton={false}
                          onChange={(event) =>
                            handleValueChange(item.key!, event.target.value)
                          }
                        />
                      );
                  }
                })}
              </Flex>
            </>
          )}
        </Flex>
      </Flex>
    </Box>
  );
}