import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";
import fs from "fs";
import dotenv from "dotenv";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const baseConfig: UserConfig = {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };

  if (mode === "development") {
    const envPath = path.resolve(process.cwd(), ".env.development");
    if (fs.existsSync(envPath)) {
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      for (const k in envConfig) {
        process.env[k] = envConfig[k];
      }
    }
    baseConfig.server = {
      proxy: {
        "/api": {
          target: process.env.VITE_API_TARGET,
          changeOrigin: true,
          ws: true,
        },
      },
    };
  }

  return baseConfig;
});