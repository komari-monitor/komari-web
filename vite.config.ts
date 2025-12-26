import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import Pages from "vite-plugin-pages";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
import type { UserConfig } from "vite";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

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
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "assets/pwa-icon.png"],
        manifest: {
          name: "Komari Monitor",
          short_name: "Komari Monitor",
          description: "A simple server monitor tool",
          theme_color: "#2563eb",
          background_color: "#ffffff",
          display: "standalone",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "/assets/pwa-icon.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable any",
            },
            {
              src: "/assets/pwa-icon.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable any",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\./i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
      visualizer({
        open: false,
        filename: "bundle-analysis.html",
        gzipSize: true,
        brotliSize: true,
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
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          // go embed ignore files start with '_'
          chunkFileNames: "assets/chunk-[name]-[hash].js",
          entryFileNames: "assets/entry-[name]-[hash].js",
          // Do not use manualChunks, use React.lazy() and <Suspense> instead
        }
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
    if (!process.env.VITE_API_TARGET) {
      process.env.VITE_API_TARGET = "http://127.0.0.1:25774";
    }
    baseConfig.server = {
      proxy: {
        "/api": {
          target: process.env.VITE_API_TARGET,
          changeOrigin: true,
          rewriteWsOrigin: true,
          ws: true,
        },
        "/themes": {
          target: process.env.VITE_API_TARGET,
          changeOrigin: true,
        },
      },
    };
  }

  return baseConfig;
});
