import { useEffect, useState } from "react";
import { Button, Callout, Dialog, Flex } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import ConfigFormTabs from "./ConfigFormTabs";
import Loading from "@/components/loading";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { resolveI18nText } from "@/utils/i18nText";
import type { PluginConfiguration, PluginInfo } from "@/types/plugin";

interface Props {
  plugin: PluginInfo;
  onClose: () => void;
  onSaved: () => void;
}

export default function PluginConfigDialog({ plugin, onClose, onSaved }: Props) {
  const { call } = useRPC2Call();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const [configuration, setConfiguration] = useState<PluginConfiguration | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    void call<{ short: string }, { configuration?: PluginConfiguration; data?: Record<string, unknown> }>(
      "admin:getPluginConfiguration", { short: plugin.short },
    ).then((result) => {
      if (ignore) return;
      const config = result?.configuration || {};
      const initial: Record<string, unknown> = {};
      for (const item of config.data || []) {
        if (!item.key || item.type === "title" || item.type === "textbox") continue;
        const saved = result?.data?.[item.key];
        const selection = item.type === "nodes" || item.type === "pingtasks";
        initial[item.key] = saved !== undefined
          ? selection ? JSON.stringify(saved) : saved
          : item.default ?? (selection ? "[]" : undefined);
      }
      setConfiguration(config);
      setValues(initial);
    }).catch((e: unknown) => {
      if (!ignore) setError(e instanceof Error ? e.message : String(e));
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, [call, plugin.short]);

  const save = async () => {
    if (loading || saving || !configuration) return;
    setSaving(true);
    setError(null);
    try {
      await call("admin:setPluginConfiguration", { short: plugin.short, data: values });
      toast.success(plugin.enabled
        ? t("plugin.config_saved_and_reloaded", "Configuration saved and plugin reloaded")
        : t("plugin.config_saved", "Configuration saved"));
      onSaved();
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const reloadFailed = plugin.enabled && message.includes("plugin configuration saved but reload failed");
      setError(`${reloadFailed
        ? t("plugin.config_saved_reload_failed", "Configuration saved, but plugin reload failed")
        : t("plugin.config_save_failed", "Failed to save configuration")}: ${message}`);
      if (reloadFailed) onSaved();
    } finally {
      setSaving(false);
    }
  };

  const editable = configuration?.data?.some((item) => item.type !== "title" && item.type !== "textbox");

  return (
    <Dialog.Root open>
      <Dialog.Content
        maxWidth="900px"
        style={{ height: "min(80vh, 800px)", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <Dialog.Title className="shrink-0">
          {resolveI18nText(plugin.name, language) || plugin.short} · {t("plugin.config", "Configuration")}
        </Dialog.Title>
        <Flex direction="column" gap="3" className="min-h-0 flex-1">
          {error && <Callout.Root color="red" className="shrink-0"><Callout.Text>{error}</Callout.Text></Callout.Root>}
          {loading ? <Loading /> : configuration && (
            <ConfigFormTabs
              items={configuration.data || []}
              values={values}
              onValueChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
              resolveText={(value) => resolveI18nText(value, language) || ""}
              className="min-h-0 flex-1 overflow-hidden"
              notice={!configuration.data?.some((item) => item.type !== "title")
                ? <Callout.Root><Callout.Text>{t("plugin.config_no_items", "This plugin has no configuration items")}</Callout.Text></Callout.Root>
                : undefined}
            />
          )}
        </Flex>
        <Flex justify="end" gap="3" mt="4" className="shrink-0">
          <Button variant="soft" color="gray" disabled={saving} onClick={onClose}>{t("common.cancel", "Cancel")}</Button>
          <Button disabled={loading || saving || !editable} onClick={save}>
            {saving
              ? plugin.enabled ? t("plugin.saving_and_reloading", "Saving and reloading...") : t("plugin.saving", "Saving...")
              : plugin.enabled ? t("plugin.save_and_reload", "Save and reload") : t("common.save", "Save")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
