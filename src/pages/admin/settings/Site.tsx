import React, { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import type { SettingsData } from "@/contexts/SettingsContext";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function SiteSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings, refetchSettings, isUpdating, isFetching } =
    useSettings();

  const [formData, setFormData] = useState<Partial<SettingsData> | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (formData) {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSwitchChange = (checked: boolean) => {
    if (formData) {
      setFormData({ ...formData, allow_cors: checked });
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
    return <div>{t('admin.site.load_failed')}</div>;
  }

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <div className="font-semibold">{t('admin.site.sitename')}</div>
        <div className="text-gray-500 text-sm mb-2">
          {t('admin.site.sitename_desc')}
        </div>
        <Input
          name="sitename"
          value={formData.sitename || ""}
          onChange={handleInputChange}
          className="w-full"
        />
      </div>

      <div className="mb-6">
        <div className="font-semibold">{t('admin.site.description')}</div>
        <div className="text-gray-500 text-sm mb-2">
          {t('admin.site.description_desc')}
        </div>
        <Input
          name="description"
          value={formData.description || ""}
          onChange={handleInputChange}
          className="w-full"
        />
      </div>

      <div className="mb-6">
        <div className="font-semibold">{t('admin.site.allow_cors')}</div>
        <div className="text-gray-500 text-sm mb-2">
          {t('admin.site.allow_cors_desc')}
        </div>
        <Switch
          checked={formData.allow_cors || false}
          onCheckedChange={handleSwitchChange}
        />
      </div>

      <div className="mb-6">
        <div className="font-semibold">{t('admin.site.custom_head')}</div>
        <div className="text-gray-500 text-sm mb-2">
          {t('admin.site.custom_head_desc')}
        </div>
        <Input
          name="custom_head"
          value={formData.custom_head || ""}
          onChange={handleInputChange}
          className="w-full"
        />
      </div>

      <div className="mt-8 flex items-center gap-4">
        <Button onClick={handleSave} disabled={isUpdating || isFetching}>
          {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('admin.site.save')}
        </Button>
        <Button
          onClick={refetchSettings}
          variant="outline"
          disabled={isFetching || isUpdating}
        >
          {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('admin.site.refresh')}
        </Button>
      </div>
    </div>
  );
}