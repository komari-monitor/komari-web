import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ManageProvider } from "@/contexts/ManageContext";
import AdminSidebar from "@/layout/Sidebar";

import { Outlet } from "react-router";
import { DataTable } from "./Table";

export function ManageContent() {
  return <DataTable />;
}

export const Manage = () => {
  return (
    <ManageProvider>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </ManageProvider>
  );
};
