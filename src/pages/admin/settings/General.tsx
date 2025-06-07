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

export default function GeneralSettings() {
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
    return <div>无法加载通用设置。</div>;
  }

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <div className="font-semibold">启用地理位置信息</div>
        <div className="text-gray-500 text-sm mb-2">
          根据 IP 地址获取和丰富用户地理位置数据
        </div>
        <Switch
          checked={formData.geo_ip_enabled || false}
          onCheckedChange={handleGeoIpEnabledChange}
        />
      </div>

      {formData.geo_ip_enabled && (
        <div className="mb-6">
          <div className="font-semibold">地理位置数据提供商</div>
          <div className="text-gray-500 text-sm mb-2">选择一个数据源</div>
          <Select
            value={formData.geo_ip_provider || "mmdb"}
            onValueChange={handleProviderChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择一个提供商..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mmdb">mmdb</SelectItem>
              <SelectItem value="ip-api.com" disabled>
                ip-api.com (未实现)
              </SelectItem>
              <SelectItem value="ipinfo.io" disabled>
                ipinfo.io (未实现)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mt-8 flex items-center gap-4">
        <Button onClick={handleSave} disabled={isUpdating || isFetching}>
          {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存更改
        </Button>
        <Button
          onClick={refetchSettings}
          variant="outline"
          disabled={isFetching || isUpdating}
        >
          {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          刷新
        </Button>
      </div>
    </div>
  );
}
