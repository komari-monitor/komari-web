import React, { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import type { SettingsData } from "@/contexts/SettingsContext";
import { Loader2 } from "lucide-react";

export default function SiteSettings() {
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
    return <div>无法加载设置。</div>;
  }

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <div className="font-semibold">站点名称</div>
        <div className="text-gray-500 text-sm mb-2">
          用于显示在页面标题和导航栏
        </div>
        <Input
          name="sitename"
          value={formData.sitename || ""}
          onChange={handleInputChange}
          className="w-full"
        />
      </div>

      <div className="mb-6">
        <div className="font-semibold">站点描述</div>
        <div className="text-gray-500 text-sm mb-2">用于 SEO 和页面副标题</div>
        <Input
          name="description"
          value={formData.description || ""}
          onChange={handleInputChange}
          className="w-full"
        />
      </div>

      <div className="mb-6">
        <div className="font-semibold">允许跨域请求</div>
        <div className="text-gray-500 text-sm mb-2">
          是否允许其他域名访问 API
        </div>
        <Switch
          checked={formData.allow_cors || false}
          onCheckedChange={handleSwitchChange}
        />
      </div>

      <div className="mb-6">
        <div className="font-semibold">自定义头部</div>
        <div className="text-gray-500 text-sm mb-2">
          插入到每个页面的 &lt;head&gt; 标签内
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
