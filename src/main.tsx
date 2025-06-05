import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./global.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NavBar from "./layout/NavBar";
import "./i18n/config";
import { Dashboard, DashboardContent } from "./pages/Server";
import { ServerDetail } from "./pages/ServerDetail";

const root = createRoot(document.getElementById("root")!);

root.render(
  <BrowserRouter>
    <ThemeProvider
      defaultThemeMode="system"
      storageKeyMode="theme-mode"
      defaultColorTheme="default"
      storageKeyColor="theme-color"
    >
      <StrictMode>
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard />}>
            <Route index element={<DashboardContent />} />
            <Route path="/server/:uuid" element={<ServerDetail />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </StrictMode>
    </ThemeProvider>
  </BrowserRouter>
);

function NotFound() {
  return <h1>404 Not Found</h1>;
}
