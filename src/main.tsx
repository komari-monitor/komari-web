import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./index.css";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ModeToggle } from "./components/modeToggle";

const root = createRoot(document.getElementById("root")!);

root.render(
  <BrowserRouter>
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <StrictMode>
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
  return <Button onClick={() => alert("Hello, World!")}>Click Me</Button>;
}

function About() {
  return <ModeToggle />;
}

function NotFound() {
  return <h1>404 Not Found</h1>;
}
