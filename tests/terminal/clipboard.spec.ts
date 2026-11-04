import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const output = "first line: 0123456789\r\n中文 mixed text: ABCDEFG\r\nlast line: copy all of this";
const expected = output.replaceAll("\r\n", "\n");
let received: string[];

async function selectOutput(page: Page) {
  await page.evaluate(() => {
    const term = window.terminalApi!.terminal;
    term.select(0, 0, term.cols * 2 + "last line: copy all of this".length);
    term.focus();
  });
  await expect.poll(() => page.evaluate(() => window.terminalApi!.terminal.getSelection())).toBe(expected);
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.startsWith("right-click")) {
    // Exercise xterm's macOS default even when CI runs on Linux.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "platform", { value: "MacIntel" });
    });
  }
  received = [];
  await page.routeWebSocket("**/api/admin/client/test-client/terminal", (socket) => {
    socket.send(JSON.stringify({ request_id: "test-session" }));
    socket.onMessage((message) => {
      received.push(typeof message === "string" ? message : message.toString());
    });
  });
  await page.goto("/tests/terminal/fixture.html");
  await page.waitForFunction(() => window.terminalApi?.terminal.cols !== 80);
  await page.evaluate(async (text) => {
    const term = window.terminalApi!.terminal;
    await new Promise<void>((resolve) => term.write(`${text}\r\noutside_selection`, resolve));
  }, output);
});

test("right-click outside the selection copies the full selection", async ({ page }) => {
  await selectOutput(page);
  const screen = await page.locator(".xterm-screen").boundingBox();
  const rows = await page.evaluate(() => window.terminalApi!.terminal.rows);
  await page.mouse.click(screen!.x + 10, screen!.y + screen!.height / rows * 3.5, { button: "right" });
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
});

test("copy preserves the selection for repeated copies", async ({ page }) => {
  await selectOutput(page);
  await page.keyboard.press("Control+Alt+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  await expect.poll(() => page.evaluate(() => window.terminalApi!.terminal.getSelection())).toBe(expected);
});

test("Ctrl+Shift+C copies all selected lines", async ({ page }) => {
  await selectOutput(page);
  await page.evaluate(() => navigator.clipboard.writeText("sentinel"));
  await page.keyboard.press("Control+Shift+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
});

test("copy falls back when the Clipboard API is unavailable", async ({ page }) => {
  await selectOutput(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    document.addEventListener("copy", (event) => {
      // Observe the real browser copy event without replacing execCommand.
      const target = event.target;
      if (target instanceof HTMLTextAreaElement) {
        document.body.dataset.copied = target.value;
      }
    });
  });
  await page.keyboard.press("Control+Alt+c");
  await expect(page.locator("body")).toHaveAttribute("data-copied", expected);
  await expect.poll(() => page.evaluate(() => window.terminalApi!.terminal.getSelection())).toBe(expected);
});

test("mouse selection copies mixed Chinese and ASCII across lines", async ({ page }) => {
  const screen = await page.locator(".xterm-screen").boundingBox();
  const { cols, rows } = await page.evaluate(() => {
    const { cols, rows } = window.terminalApi!.terminal;
    return { cols, rows };
  });
  const cellWidth = screen!.width / cols;
  const cellHeight = screen!.height / rows;
  await page.mouse.move(screen!.x + cellWidth * 0.1, screen!.y + cellHeight * 0.5);
  await page.mouse.down();
  await page.mouse.move(screen!.x + cellWidth * 27.1, screen!.y + cellHeight * 2.5, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.terminalApi!.terminal.getSelection())).toBe(expected);
  await page.keyboard.press("Control+Alt+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
});

test("system copy shortcut preserves a long soft-wrapped line", async ({ page }) => {
  const text = `START:${"0123456789abcdef".repeat(100)}:END`;
  await page.evaluate(async (text) => {
    const term = window.terminalApi!.terminal;
    term.reset();
    await new Promise<void>((resolve) => term.write(text, resolve));
    term.select(0, 0, text.length);
    term.focus();
  }, text);
  await page.keyboard.press("ControlOrMeta+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  await expect.poll(() => page.evaluate(() => window.terminalApi!.terminal.getSelection())).toBe(text);
});

test("Ctrl+C interrupts only when no text is selected", async ({ page }) => {
  await selectOutput(page);
  await page.keyboard.press("Control+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  expect(received).not.toContain("\x03");
  await page.evaluate(() => window.terminalApi!.terminal.clearSelection());
  await page.keyboard.press("Control+c");
  await expect.poll(() => received.includes("\x03")).toBe(true);
});

test("denied clipboard permission uses the browser copy fallback", async ({ page }) => {
  await selectOutput(page);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new DOMException("Denied", "NotAllowedError"); };
  });
  await page.keyboard.press("Control+Alt+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
});

test("copy failure is visible and keeps the selection", async ({ page }) => {
  await selectOutput(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    document.execCommand = () => false;
  });
  await page.keyboard.press("Control+Alt+c");
  await expect(page.locator("[data-sonner-toast]")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.terminalApi!.terminal.getSelection())).toBe(expected);
});
