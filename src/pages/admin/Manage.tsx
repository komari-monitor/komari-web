import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ManageProvider } from "@/contexts/ManageContext";
import AdminSidebar from "@/layout/Sidebar";

import { Outlet } from "react-router";

export function ManageContent() {
  return (
    <div className="h-full p-4 w-full">
      <h1 className="text-2xl font-bold mb-4">管理面板</h1>
    </div>
  );
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
