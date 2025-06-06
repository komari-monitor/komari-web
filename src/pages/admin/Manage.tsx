import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AdminSidebar from "@/layout/Sidebar";

import { Outlet } from "react-router";
import { DataTableProvider } from "@/contexts/ManageContext";


export const Manage = () => {
  return (
    <DataTableProvider>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </DataTableProvider>
  );
};
