import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/terminal",
  use: {
    baseURL: "http://127.0.0.1:4173",
    permissions: ["clipboard-read", "clipboard-write"],
    // Set PLAYWRIGHT_CHROMIUM_CHANNEL=chrome to use an installed Chrome.
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/tests/terminal/fixture.html",
    reuseExistingServer: !process.env.CI,
  },
});
