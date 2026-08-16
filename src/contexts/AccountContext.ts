import React from "react";

export type Account = {
  logged_in: boolean;
  sso_id: string;
  sso_type: string;
  username: string;
  uuid: string;
  "2fa_enabled": boolean;
};

export interface AccountContextType {
  account: Account | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export const AccountContext = React.createContext<
  AccountContextType | undefined
>(undefined);

export const useAccount = () => {
  const context = React.useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
};
