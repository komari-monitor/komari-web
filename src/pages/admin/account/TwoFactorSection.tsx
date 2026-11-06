import { useAccount } from "./accountData";
import { Flex } from "@radix-ui/themes";
import { Swap } from "@/components/motion";
import TwoFactorDisabled from "./TwoFactorDisabled";
import TwoFactorEnabled from "./TwoFactorEnabled";

/** 账户页：2FA 开启 / 关闭 */
export default function TwoFactorSection() {
  const { account, loading } = useAccount();
  return (
    <Flex direction="column" align="start" className="km-account-2fa gap-2">
      <label className="font-bold text-xl">2FA</label>
      {/*
        overlay 性格：2FA 开启/关闭后整块状态区换内容：旧的淡出、新的淡入上浮，高度弹簧过渡。
        账户首次到达时若已开启 2FA，会从骨架里的「未开启」交接一次（与骨架淡出同时发生）。
      */}
      <Swap swapKey={!loading && account?.["2fa_enabled"] ? "2fa-on" : "2fa-off"}>
        {!loading && account?.["2fa_enabled"] ? (
          <TwoFactorEnabled />
        ) : (
          <TwoFactorDisabled></TwoFactorDisabled>
        )}
      </Swap>
    </Flex>
  );
}
