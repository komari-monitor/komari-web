import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./global.css";
import NavBar from "./layout/NavBar";
import "./i18n/config";
import { Dashboard, DashboardContent } from "./pages/Server";
import { ServerDetail } from "./pages/ServerDetail";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PublicInfoProvider, usePublicInfo } from "./contexts/PublicInfoContext"; // 导入 usePublicInfo

const root = createRoot(document.getElementById("root")!);

function AppContent() {
  const { publicInfo, loading, error } = usePublicInfo();

  if (loading) {
    return <div>loading...</div>;
  }

  if (error) {
    return <div>加载站点配置失败: {error.message}</div>;
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
        <Route path="/server" element={<DashboardContent />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </StrictMode>
  );
}

root.render(
  <BrowserRouter>
    <PublicInfoProvider>
      <ThemeProvider
        defaultThemeMode="system"
        storageKeyMode="theme-mode"
        defaultColorTheme="default"
        storageKeyColor="theme-color"
      >
        <AppContent />
      </ThemeProvider>
    </PublicInfoProvider>
  </BrowserRouter>
);

function NotFound() {
  return <h1>404 Not Found</h1>;
}