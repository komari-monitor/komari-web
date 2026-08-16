import React from "react";
import { AdminNavigationContext } from "./AdminNavigationContext";

export const AdminNavigationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [refreshVersion, setRefreshVersion] = React.useState(0);

  const refreshNavigation = React.useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  const value = React.useMemo(
    () => ({ refreshVersion, refreshNavigation }),
    [refreshVersion, refreshNavigation],
  );

  return (
    <AdminNavigationContext.Provider value={value}>
      {children}
    </AdminNavigationContext.Provider>
  );
};
