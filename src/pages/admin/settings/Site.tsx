import React from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";

export default function SiteSettings() {
  const settings = useSettings();

  if (!settings) {
    return <div>加载中...提示之后改</div>;
  }

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <div className="font-semibold">站点名称</div>
        <div className="text-gray-500 text-sm mb-2">
          用于显示在页面标题和导航栏
        </div>
        <Input defaultValue={settings.sitename} className="w-full" />
      </div>

      <div className="mb-6">
        <div className="font-semibold">站点描述</div>
        <div className="text-gray-500 text-sm mb-2">用于 SEO 和页面副标题</div>
        <Input defaultValue={settings.description} className="w-full" />
      </div>

      <div className="mb-6">
        <div className="font-semibold">允许跨域请求</div>
        <div className="text-gray-500 text-sm mb-2">
          是否允许其他域名访问 API
        </div>
        <Switch defaultChecked={settings.allow_cors} />
      </div>

      <div className="mb-6">
        <div className="font-semibold">自定义头部</div>
        <div className="text-gray-500 text-sm mb-2">
          插入到每个页面的 &lt;head&gt; 标签内
        </div>
        <Input defaultValue={settings.custom_head} className="w-full" />
      </div>
    </div>
  );
}
