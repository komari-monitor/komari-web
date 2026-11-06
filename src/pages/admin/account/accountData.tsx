import React from "react";
import { useRouteQuery } from "@/lib/routeData";
import { accountQuery, type AccountInfo } from "@/routeQueries/settings";

/**
 * 账户页自己的账户数据（接口与 @/contexts/AccountContext 相同：account / loading / error / refresh）。
 * 请求换成 routeQueries/settings 的 accountQuery：切换到本页时已由 routePreload 提前发出，
 * 等待预算内到达直接显示真实内容；每次进入页面都重新请求，保存后再进来读到的是新值。
 * 原来的 AccountProvider 别处也在用（导航栏、登录页、后台布局），不动它。
 */
interface AccountPageContextType {
  account: AccountInfo | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

const AccountPageContext = React.createContext<AccountPageContextType | undefined>(undefined);

export function AccountPageProvider({ children }: { children: React.ReactNode }) {
  const result = useRouteQuery(accountQuery);
  const { reload } = result;
  const value = React.useMemo<AccountPageContextType>(
    () => ({
      account: result.data ?? null,
      loading: result.loading,
      error: result.error ? (result.error as Error) : null,
      refresh: () => void reload(),
    }),
    [result.data, result.loading, result.error, reload],
  );
  return <AccountPageContext.Provider value={value}>{children}</AccountPageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAccount = () => {
  const context = React.useContext(AccountPageContext);
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
};
