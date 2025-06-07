import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AdminSidebar from "@/layout/Sidebar";

import { Outlet } from "react-router";
import { DataTableProvider } from "@/contexts/DataTableContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SessionProvider } from "@/contexts/SessionContext";

export const Manage = () => {
  return (
    <SettingsProvider>
      <SessionProvider>
        <DataTableProvider>
          <SidebarProvider>
            <AdminSidebar />
            <SidebarInset>
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </DataTableProvider>
      </SessionProvider>
    </SettingsProvider>
  );
};
