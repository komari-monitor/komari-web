import React, { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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

export default function SsoSettings() {
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

  const handleEnableSsoChange = (checked: boolean) => {
    if (formData) {
      setFormData({ ...formData, o_auth_enabled: checked });
    }
  };
  const handleDisablePasswordLoginChange = (checked: boolean) => {
    if (formData) {
      setFormData({ ...formData, disable_password_login: checked });
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
    return <div>无法加载 SSO 设置。</div>;
  }

  return (
    <div className="max-w-lg p-6">
      <div className="mb-6">
        <div className="font-semibold">启用单点登录 (SSO)</div>
        <div className="text-gray-500 text-sm mb-2">
          允许用户通过第三方服务进行身份验证
        </div>
        <Switch
          checked={formData.o_auth_enabled || false}
          onCheckedChange={handleEnableSsoChange}
        />
      </div>

      {formData.o_auth_enabled && (
        <>
          <div className="mb-6">
            <div className="font-semibold">单点登录提供商</div>
            <div className="text-gray-500 text-sm mb-2">
              选择一个 OAuth 提供商
            </div>
            <Select
              value={formData.geo_ip_provider || "github"}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择一个提供商..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github">GitHub</SelectItem>
                <SelectItem value="google" disabled>
                  Google (未实现)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-6">
            <div className="font-semibold">客户端 ID</div>
            <div className="text-gray-500 text-sm mb-2">
              从您的 OAuth 提供商获取的客户端 ID
            </div>
            <Input
              name="o_auth_client_id"
              value={formData.o_auth_client_id || ""}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>

          <div className="mb-6">
            <div className="font-semibold">客户端密钥</div>
            <div className="text-gray-500 text-sm mb-2">
              从您的 OAuth 提供商获取的客户端密钥
            </div>
            <Input
              name="o_auth_client_secret"
              type="password"
              value={formData.o_auth_client_secret || ""}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
          <div className="mb-6">
            <div className="font-semibold">禁用密码登录</div>
            <div className="text-gray-500 text-sm mb-2">
              如果启用，用户将只能通过 SSO 登录。请确保 SSO 正确配置后启用。
            </div>
            <Switch
              checked={formData.disable_password_login || false}
              onCheckedChange={handleDisablePasswordLoginChange}
              disabled={!formData.o_auth_enabled}
            />
          </div>
        </>
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
