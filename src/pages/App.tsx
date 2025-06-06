import { StrictMode } from "react";
import { Routes, Route } from "react-router";
import NavBar from "@/layout/NavBar";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { Dashboard, DashboardContent } from "./Server";
import { ServerDetail } from "./ServerDetail";
import { Manage, ManageContent } from "./admin/Manage";
import { NotFound } from "./404";

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
          <Route index element={<ManageContent />} />
          {/* <Route path="account" element={<Component />} /> */}
        </Route>
        <Route path="/terminal" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </StrictMode>
  );
}
