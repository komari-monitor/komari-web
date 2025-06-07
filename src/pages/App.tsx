import { StrictMode } from "react";
import { Routes, Route } from "react-router";
import NavBar from "@/layout/NavBar";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { Dashboard, DashboardContent } from "./Server";
import { ServerDetail } from "./ServerDetail";
import { Manage } from "./admin/Manage";
import { NotFound } from "./404";
import { DataTableComponent } from "./admin/ServerTable";
import SiteSettings from "./admin/settings/Site";
import SsoSettings from "./admin/settings/Sso";
import GeneralSettings from "./admin/settings/General";
import { SessionPage } from "./admin/Session";

export function AppContent() {
  const { publicInfo, loading } = usePublicInfo();

  if (loading) {
    return <div>loading...</div>;
  }

  if (!publicInfo) {
    return <div>无法获取站点配置。</div>;
  }

  return (
    <StrictMode>
      <NavBar />
      <Routes>
        <Route path="/" element={<Dashboard />}>
          <Route index element={<DashboardContent />} />
          <Route path="/server/:uuid" element={<ServerDetail />} />
        </Route>
        <Route path="/manage" element={<Manage />}>
          <Route index element={<DataTableComponent />} />
          <Route path="settings/site" element={<SiteSettings />} />
          <Route path="settings/sso" element={<SsoSettings />} />
          <Route path="settings/general" element={<GeneralSettings />} />
          <Route path="sessions" element={<SessionPage />} />
          <Route path="account" element={<SessionPage />} />

          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/terminal" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </StrictMode>
  );
}
