import React from "react";

export interface AdminNavigationContextValue {
  refreshVersion: number;
  refreshNavigation: () => void;
}

export const AdminNavigationContext = React.createContext<
  AdminNavigationContextValue | undefined
>(undefined);

export const useAdminNavigation = () => {
  const context = React.useContext(AdminNavigationContext);
  if (!context) {
    throw new Error(
      "useAdminNavigation must be used within an AdminNavigationProvider",
    );
  }
  return context;
};
