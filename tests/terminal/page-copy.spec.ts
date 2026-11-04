import { expect, test } from "@playwright/test";

const output = "first line: 0123456789\r\n中文 mixed text: ABCDEFG\r\nlast line: copy all of this";

for (const shortcut of ["Control+c", "Meta+c"]) {
  test(`full terminal page copies a mouse selection with ${shortcut}`, async ({ page }) => {
    test.skip(shortcut === "Meta+c" && process.platform !== "darwin", "Cmd+C is a native macOS shortcut.");
    let dimensions = { cols: 0, rows: 0 };
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = path === "/api/admin/client/list"
        ? [{ uuid: "test-client", name: "Test server", os: "linux" }]
        : path === "/api/me"
          ? { logged_in: false, "2fa_enabled": false }
          : path === "/api/public"
            ? { data: { theme: "default", theme_settings: {} } }
            : {};
      await route.fulfill({ json });
    });
    await page.routeWebSocket("**/api/rpc2", (socket) => {
      socket.onMessage((data) => {
        const request = JSON.parse(data.toString());
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: {} }));
      });
    });
    await page.routeWebSocket("**/api/admin/client/test-client/terminal", (socket) => {
      socket.send(JSON.stringify({ request_id: "test-session" }));
      socket.send(output);
      socket.onMessage((data) => {
        try {
          const control = JSON.parse(data.toString());
          if (control.type === "resize") dimensions = control;
        } catch {
          // Binary key input is not a control message.
        }
      });
    });
    await page.goto("/terminal?uuid=test-client");
    await expect(page.locator(".xterm-rows")).toContainText("last line: copy all of this");
    await expect.poll(() => dimensions.cols).toBeGreaterThan(0);
    await page.evaluate(() => navigator.clipboard.writeText("terminal-copy-sentinel"));
    const screen = await page.locator(".xterm-screen").boundingBox();
    const cellWidth = screen!.width / dimensions.cols;
    const cellHeight = screen!.height / dimensions.rows;
    await page.mouse.move(screen!.x + cellWidth * 0.1, screen!.y + cellHeight * 0.5);
    await page.mouse.down();
    await page.mouse.move(screen!.x + cellWidth * 27.1, screen!.y + cellHeight * 2.5, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.press(shortcut);
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(output.replaceAll("\r\n", "\n"));
  });
}
