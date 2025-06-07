import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AdminSidebar from "@/layout/Sidebar";

import { Outlet } from "react-router";
import { DataTableProvider } from "@/contexts/DataTableContext";
import { SettingsProvider } from "@/contexts/SettingsContext";

export const Manage = () => {
  return (
    <SettingsProvider>
      <DataTableProvider>
        <SidebarProvider>
          <AdminSidebar />
          <SidebarInset>
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </DataTableProvider>
    </SettingsProvider>
  );
};
