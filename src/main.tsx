import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./global.css";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ModeToggle } from "./components/modeToggle";
import { ColorThemeToggle } from "./components/ColorThemeToggle";
import NavBar from "./layout/NavBar";

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
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </StrictMode>
    </ThemeProvider>
  </BrowserRouter>
);

function Home() {
  return (
    <div>
      <Button onClick={() => alert("Hello, World!")}>Click Me</Button>
     
    </div>
  );
}

function About() {
  return (
    <div>
      <h1>About Page</h1>
      <ModeToggle />
      <ColorThemeToggle />
    </div>
  );
}

function NotFound() {
  return <h1>404 Not Found</h1>;
}
