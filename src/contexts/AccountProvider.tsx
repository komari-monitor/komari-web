import React from "react";
import { AccountContext, type Account } from "./AccountContext";

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [account, setAccount] = React.useState<Account | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/me");
      if (!response.ok) {
        throw new Error("Failed to fetch account data");
      }
      const data: Account = await response.json();
      setAccount(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AccountContext.Provider value={{ account, loading, error, refresh }}>
      {children}
    </AccountContext.Provider>
  );
};
