import AdminSidebar from "@/layout/Sidebar";

import { Outlet } from "react-router";
import { DataTableProvider } from "@/contexts/DataTableContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SessionProvider } from "@/contexts/SessionContext";

export const Manage = () => {
  return (
    <SettingsProvider>
      <DataTableProvider>
        <SessionProvider>
          <div className="flex h-[calc(100vh-4rem)]">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto">
              <Outlet />
            </main>
          </div>
        </SessionProvider>
      </DataTableProvider>
    </SettingsProvider>
  );
};
