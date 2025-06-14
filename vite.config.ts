import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import Pages from "vite-plugin-pages";

// https://vite.dev/config/
import type { UserConfig } from "vite";
import * as path from "path";

export default defineConfig(({ mode }) => {
  const buildTime = new Date().toISOString();
  
  const baseConfig: UserConfig = {
    plugins: [
      react(),
      tailwindcss(),
      Pages({
        dirs: "src/pages",
        extensions: ["tsx", "jsx"],
      }),
    ],
    define: {
      __BUILD_TIME__: JSON.stringify(buildTime),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      assetsDir: "assets",

      outDir: "dist",
      rollupOptions: {
        output: {
          // go embed ignore files start with '_'
          chunkFileNames: "assets/chunk-[name]-[hash].js",
          entryFileNames: "assets/entry-[name]-[hash].js",
        },
      },
    },
  };

  if (mode === "development") {
    baseConfig.server = {
      proxy: {
        "/api": {
          target: "http://localhost:25774",
          changeOrigin: true,
          ws: true,
        },
      },
    };
  }

  return baseConfig;
});
