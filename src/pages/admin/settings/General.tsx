import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/contexts/SettingsContext";
import type { SettingsData } from "@/contexts/SettingsContext";
import { Loader2 } from "lucide-react"; 
import { useTranslation } from "react-i18next";

export default function GeneralSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings, refetchSettings, isUpdating, isFetching } =
    useSettings();

  const [formData, setFormData] = useState<Partial<SettingsData> | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleGeoIpEnabledChange = (checked: boolean) => {
    if (formData) {
      setFormData({ ...formData, geo_ip_enabled: checked });
    }
  };

  const handleProviderChange = (value: string) => {
    if (formData) {
      setFormData({ ...formData, geo_ip_provider: value });
    }
  };

  const handleSave = () => {
    if (formData) {
      updateSettings(formData);
    }
  };

  if (isFetching && !settings) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!formData) {
    return <div>{t('admin.general.load_failed')}</div>;
  }

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <div className="font-semibold">{t('admin.general.geo_ip_enabled')}</div>
        <div className="text-gray-500 text-sm mb-2">
          {t('admin.general.geo_ip_enabled_desc')}
        </div>
        <Switch
          checked={formData.geo_ip_enabled || false}
          onCheckedChange={handleGeoIpEnabledChange}
        />
      </div>

      {formData.geo_ip_enabled && (
        <div className="mb-6">
          <div className="font-semibold">{t('admin.general.geo_ip_provider')}</div>
          <div className="text-gray-500 text-sm mb-2">{t('admin.general.geo_ip_provider_desc')}</div>
          <Select
            value={formData.geo_ip_provider || "mmdb"}
            onValueChange={handleProviderChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('admin.general.provider_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mmdb">{t('admin.general.provider_mmdb')}</SelectItem>
              <SelectItem value="ip-api.com" disabled>
                {t('admin.general.provider_ipapi')}
              </SelectItem>
              <SelectItem value="ipinfo.io" disabled>
                {t('admin.general.provider_ipinfo')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mt-8 flex items-center gap-4">
        <Button onClick={handleSave} disabled={isUpdating || isFetching}>
          {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('admin.general.save')}
        </Button>
        <Button
          onClick={refetchSettings}
          variant="outline"
          disabled={isFetching || isUpdating}
        >
          {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('admin.general.refresh')}
        </Button>
      </div>
    </div>
  );
}