import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Badge, Button, Dialog, Flex } from "@radix-ui/themes";
import { Github, Globe, User } from "lucide-react";
import { useAccount } from "./accountData";
import { TogglePop } from "@/components/motion";
import { ApiError, api } from "@/lib/http";
import { getSSODisplayName, getSSOInfo } from "./sso";

function getSSOIcon(platform: string) {
  switch (platform.toLowerCase()) {
    case 'github':
      return <Github className="size-5" />;
    case 'google':
      return <Globe className="size-5" />;
    default:
      return <User className="size-5" />;
  }
}

/** 账户页：单点登录账户绑定 / 解绑 */
export default function SsoSection() {
  const { t } = useTranslation();
  const { account, refresh } = useAccount();

  const handleSSOAuth = async () => {
    try {
      const ssoInfo = getSSOInfo(account?.sso_id);
      if (ssoInfo?.isBound) {
        // 解绑SSO
        // 只看 HTTP 状态，不检查响应体的 status 字段
        const failure = await api
          .post("/api/admin/oauth2/unbind", undefined, { expectSuccess: false })
          .then(() => null)
          .catch((error) => {
            // 错误响应体不是 JSON（null）时与原来 response.json() 抛错一样走外层 catch
            if (error instanceof ApiError && error.body !== null) {
              return error.body as { message?: string };
            }
            throw error;
          });

        if (failure === null) {
          toast.success(t("account_settings.unbind_sso_success", { provider: getSSODisplayName(ssoInfo.platform) }));
          refresh(); // 刷新用户信息
        } else {
          const error = failure;
          toast.error(t("account_settings.unbind_sso_failed", { 
            provider: getSSODisplayName(ssoInfo.platform),
            error: error.message || t("common.unknownError")
          }));
        }
      } else {
        window.location.href = "/api/admin/oauth2/bind";
      }
    } catch (error) {
      console.error("处理SSO认证失败:", error);
      toast.error(t("account_settings.sso_auth_failed"));
    }
  };
  return (
    <Flex direction="column" className="gap-2">
      <label className="font-bold text-xl">
        {t("settings.sso.title")}
      </label>

      {/* SSO账户绑定/解绑 */}
      <div className="km-account-sso flex flex-col gap-2">
        {(() => {
          const ssoInfo = getSSOInfo(account?.sso_id);
          const platform = ssoInfo?.platform || '';
          const displayName = getSSODisplayName(platform);
          const icon = getSSOIcon(platform);
          
          return (
            <>
              <label className="text-lg font-semibold flex items-center gap-2">
                {ssoInfo?.isBound ? icon : <User className="size-5" />}
                {ssoInfo?.isBound ? t("account_settings.sso_account_bound", { name: displayName }) : t("account_settings.sso_account")}
              </label>
              <div className="p-4 bg-[var(--accent-2)] rounded-lg">
                {/* 原来是 <p> 包 <div>（非法嵌套，React 报错）；改成 div，样式不变 */}
                <div>
                  {ssoInfo?.isBound ? (
                    <div className="flex items-center gap-2">
                      {/* feedback 性格：绑定状态徽标只在真的绑定/解绑后翻转一次 */}
                      <TogglePop value="bound">
                        <Badge color="green">
                          {t("account_settings.sso_bound")}
                        </Badge>
                      </TogglePop>
                      {displayName} ID: {ssoInfo.uniqueId}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <TogglePop value="unbound">
                        <Badge color="gray">
                          {t("account_settings.sso_not_bound")}
                        </Badge>
                      </TogglePop>
                      {t("account_settings.sso_not_bound")}
                    </div>
                  )}
                </div>
              </div>
              <div>
                {ssoInfo?.isBound ? (
                  <Dialog.Root>
                    <Dialog.Trigger>
                      <Button>{t("account_settings.unbind_sso", { provider: displayName })}</Button>
                    </Dialog.Trigger>
                    <Dialog.Content>
                      <Dialog.Title>
                        {t("account_settings.confirm_unbind")}
                      </Dialog.Title>
                      <Dialog.Description>
                        {t("account_settings.unbind_sso_warning", { provider: displayName })}
                      </Dialog.Description>
                      <Flex gap="2" justify="end" mt="5">
                        <Dialog.Close>
                          <Button variant="soft">
                            {t("common.cancel")}
                          </Button>
                        </Dialog.Close>
                        <Button color="red" onClick={handleSSOAuth}>
                          {t("account_settings.confirm_unbind")}
                        </Button>
                      </Flex>
                    </Dialog.Content>
                  </Dialog.Root>
                ) : (
                  <Button onClick={handleSSOAuth}>
                    <User className="size-4" />
                    {t("account_settings.bind_sso")}
                  </Button>
                )}
              </div>
            </>
          );
        })()}
      </div>
    </Flex>
  );
}
