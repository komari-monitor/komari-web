import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
import type { Plugin, UserConfig } from "vite";
import * as fs from "fs";
import * as path from "path";

function localKomariThemePlugin(): Plugin {
  const themeRequestPath = "/themes/default/komari-theme.json";
  const localThemeFile = path.resolve(__dirname, "komari-theme.json");

  return {
    name: "local-komari-theme",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const url = new URL(req.url, "http://localhost");
        if (!url.pathname.endsWith(themeRequestPath)) return next();

        fs.readFile(localThemeFile, (err, data) => {
          if (err) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                error: "Local theme file not found",
                file: localThemeFile,
              })
            );
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(data);
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const buildTime = new Date().toISOString();

  // Supports configuring BASE_URL via environment variables, defaulting to the root path.
  const base: string = process.env.VITE_BASE_URL ? process.env.VITE_BASE_URL : "/";
  const baseConfig: UserConfig = {
    base: base,
    plugins: [
      localKomariThemePlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        manifestFilename: "manifest.json",
        includeAssets: ["favicon.ico", "assets/pwa-icon.webp"],
        manifest: {
          name: "Komari Monitor",
          short_name: "Komari Monitor",
          description: "A simple server monitor tool",
          theme_color: "#2563eb",
          background_color: "#ffffff",
          display: "standalone",
          categories: ["utilities", "productivity"],
          prefer_related_applications: false,
          scope: base,
          start_url: base,
          icons: [
            {
              src: `${base}assets/pwa-icon.webp`,
              sizes: "192x192",
              type: "image/webp",
              purpose: "maskable any",
            },
            {
              src: `${base}assets/pwa-icon.webp`,
              sizes: "512x512",
              type: "image/webp",
              purpose: "maskable any",
            },
          ],
        },
        workbox: {
          // HTML is rendered dynamically with theme, plugin, and site settings.
          // Precache only the lightweight app shell; lazy route/editor/xterm chunks
          // and country flags are cached on demand via runtimeCaching instead of
          // downloading ~9.5 MB / 550 files on every first visit.
          globPatterns: ["assets/entry-*.js", "assets/index-*.css"],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin, url }) =>
                sameOrigin &&
                url.pathname.includes("/assets/") &&
                !url.pathname.includes("/assets/flags/") &&
                !url.pathname.includes("/assets/logo/") &&
                (request.destination === "script" ||
                  request.destination === "style" ||
                  request.destination === "font" ||
                  request.destination === "worker" ||
                  /\.(?:js|css|ttf|woff2?)$/i.test(url.pathname)),
              handler: "CacheFirst",
              options: {
                cacheName: "komari-hashed-assets",
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [200],
                },
              },
            },
            {
              urlPattern: ({ request, sameOrigin, url }) =>
                sameOrigin &&
                (url.pathname.includes("/assets/flags/") ||
                  url.pathname.includes("/assets/logo/") ||
                  (request.destination === "image" &&
                    /\.(?:webp|png|svg|ico)$/i.test(url.pathname))),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "komari-static-media",
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [200],
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
      alias: [
        { find: "@", replacement: path.resolve(__dirname, "./src") },
        {
          find: /^monaco-editor-codicon\.css$/,
          replacement: path.resolve(
            __dirname,
            "node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css",
          ),
        },
        // Force xterm to use the CJS build to avoid a rollup bug where `||=` in
        // xterm.mjs is incorrectly lowered to `void 0||(i={})` with an undeclared `i`,
        // causing `ReferenceError: i is not defined` at requestMode when vi sends DECRQM sequences.
        // Regex to match only the bare specifier, not subpaths like @xterm/xterm/css/xterm.css.
        { find: /^@xterm\/xterm$/, replacement: path.resolve(__dirname, "node_modules/@xterm/xterm/lib/xterm.js") },
      ],
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
          // Do not use manualChunks or aggressive chunk merging (can pull unrelated lazy
          // chunks like eula into the homepage); use React.lazy() and <Suspense> instead.
        },
      },
    },
  };

  if (mode === "development") {
    const env = loadEnv(mode, process.cwd(), "");
    const apiTarget = process.env.VITE_API_TARGET || env.VITE_API_TARGET || "http://127.0.0.1:25774";
    baseConfig.server = {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewriteWsOrigin: true,
          ws: true,
        },
        "/themes": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    };
  }

  return baseConfig;
});
