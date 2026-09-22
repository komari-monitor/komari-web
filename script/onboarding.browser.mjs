import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Run against the Vite dev server. All API traffic is mocked; no server settings are changed.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
});
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
const output = new URL("../.codex/onboarding/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
await mkdir(output, { recursive: true });
const key = "_komari_onboarding_v1";
let settings;
let clients;
let eulaAccepted = true;
let writes;
let failWrites = false;
const errors = [];

function reset(seen = [], count = 0, opened = false) {
  settings = { unrelated: "keep-me", [key]: { seen, workbenchOpened: opened } };
  clients = Array.from({ length: count }, (_, index) => ({
    uuid: `node-${index}`, name: `Server ${index + 1}`, os: "Ubuntu", weight: index,
    cpu_cores: 2, mem_total: 4096, disk_total: 10240, swap_total: 0, tags: "",
  }));
  writes = [];
}

function rpc(request) {
  const result = request.method === "common:getNodes" ? Object.fromEntries(clients.map((c) => [c.uuid, c]))
    : request.method === "common:getVersion" ? { version: "snapshot", hash: "test" }
    : request.method === "admin:listPlugins" ? []
    : request.method.includes("queryMetrics") ? { series: [] }
    : request.method.toLowerCase().includes("ping") ? []
    : {};
  return { jsonrpc: "2.0", id: request.id, result };
}

async function context(viewport = { width: 1440, height: 960 }, dark = false) {
  const context = await browser.newContext({ viewport, locale: "zh-CN", serviceWorkers: "block" });
  await context.addInitScript(({ dark }) => {
    if (!location.protocol.startsWith("http")) return;
    localStorage.setItem("language", "zh-CN");
    localStorage.setItem("appearance", JSON.stringify(dark ? "dark" : "light"));
  }, { dark });
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname === "/api/me") body = { logged_in: true, uuid: "test-admin", username: "admin", "2fa_enabled": true };
    else if (url.pathname === "/api/public") body = { data: { theme: "default", theme_settings: settings, sitename: "Komari" } };
    else if (url.pathname === "/api/admin/settings") body = { data: { theme: "default", eula_accepted: eulaAccepted } };
    else if (url.pathname === "/api/admin/client/list") body = clients;
    else if (url.pathname === "/api/admin/theme/settings") {
      if (failWrites) return route.fulfill({ status: 500, json: { message: "Test failure" } });
      settings = route.request().postDataJSON();
      writes.push(settings);
      body = { status: "success" };
    } else if (url.pathname === "/api/rpc2") body = rpc(route.request().postDataJSON());
    else body = { status: "success", data: [] };
    await route.fulfill({ json: body });
  });
  await context.route("https://api.github.com/**", (route) => route.fulfill({ json: [] }));
  await context.routeWebSocket("**/api/**", (socket) => {
    socket.onMessage((message) => {
      try { socket.send(JSON.stringify(rpc(JSON.parse(message)))); } catch { /* Terminal protocol is not needed. */ }
    });
  });
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  return context;
}

async function guide(page, title) {
  await page.locator('.km-guide-layer[data-ready="true"]').waitFor({ timeout: 20000 });
  assert.equal(await page.locator(".km-guide-title").innerText(), title);
  const box = await page.locator(".km-guide-content").boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
  assert.equal(await page.locator(".km-guide-content").evaluate((el) => el.scrollWidth > el.clientWidth), false);
  const spotlight = await page.locator(".km-guide-spotlight").boundingBox();
  assert.ok(spotlight && (
    box.x >= spotlight.x + spotlight.width || box.x + box.width <= spotlight.x ||
    box.y >= spotlight.y + spotlight.height || box.y + box.height <= spotlight.y
  ), "tutorial must not cover its highlighted target");
}

try {
  reset();
  const desktop = await context();
  const page = await desktop.newPage();
  await page.goto(`${base}/admin/dashboard`);
  await guide(page, "接入第一台服务器");
  await page.screenshot({ path: `${output}/install-desktop.png` });
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await guide(page, "添加节点，安装 Agent");
  assert.ok(page.url().endsWith("/admin/servers"));
  await page.getByRole("button", { name: "上一步", exact: true }).click();
  await guide(page, "接入第一台服务器");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await guide(page, "添加节点，安装 Agent");
  await page.getByRole("button", { name: "添加节点", exact: true }).last().click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.locator(".km-guide-content").count(), 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  assert.equal(await page.locator(".km-guide-content").count(), 0);
  assert.deepEqual(settings[key].seen, ["install"]);
  assert.equal(settings.unrelated, "keep-me");
  console.log("PASS install navigation, previous, action, persistence, one guide per entry");

  await page.reload();
  await guide(page, "让服务器主动通知你");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await guide(page, "服务器离线，及时知晓");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await guide(page, "按需配置通知规则");
  await page.keyboard.press("Escape");
  await page.reload();
  await guide(page, "逛逛主题市场");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await guide(page, "用插件扩展 Komari");
  await page.screenshot({ path: `${output}/market-desktop.png` });
  await page.getByRole("button", { name: "跳过指引", exact: true }).last().click();
  await page.reload();
  await page.waitForTimeout(1800);
  assert.equal(await page.locator(".km-guide-content").count(), 0);
  console.log("PASS deferred notifications/markets, escape, skip, no repeats");

  await page.goto(`${base}/admin/theme_managed`);
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.waitForTimeout(500);
  assert.equal(settings.unrelated, "keep-me");
  assert.deepEqual(settings[key].seen, ["install", "notifications", "markets"]);
  console.log("PASS theme form preserves tutorial and undeclared settings");
  await desktop.close();

  reset([], 1);
  const mobile = await context({ width: 390, height: 844 }, true);
  const phone = await mobile.newPage();
  await phone.goto(`${base}/admin/dashboard`);
  await guide(phone, "试试远程工作台");
  await phone.screenshot({ path: `${output}/workbench-mobile-dark.png` });
  await phone.getByRole("button", { name: "下一步", exact: true }).click();
  await guide(phone, "文件管理也在这里");
  const popupPromise = phone.waitForEvent("popup");
  await phone.getByRole("button", { name: "打开工作台", exact: true }).click();
  const terminal = await popupPromise;
  await terminal.waitForURL("**/terminal");
  await terminal.waitForTimeout(1000);
  assert.equal(settings[key].workbenchOpened, true);
  assert.equal(await terminal.locator(".km-guide-content").count(), 0);
  await terminal.goto(`${base}/terminal?uuid=node-0`);
  await guide(terminal, "终端 Tab 还有更多功能");
  await terminal.screenshot({ path: `${output}/terminal-mobile.png` });
  await terminal.getByRole("button", { name: "下一步", exact: true }).click();
  await guide(terminal, "文件、搜索与资源监控");
  await terminal.getByRole("button", { name: "知道了", exact: true }).click();
  await terminal.locator('[data-guide="terminal-tab"]').click({ button: "right" });
  await terminal.getByRole("menu").waitFor();
  await terminal.reload();
  await terminal.waitForTimeout(1800);
  assert.equal(await terminal.locator(".km-guide-content").count(), 0);
  console.log("PASS mobile/dark, workbench action/visit, terminal menu and no repeats");
  await mobile.close();

  reset();
  const narrow = await context({ width: 320, height: 568 });
  const small = await narrow.newPage();
  await small.goto(`${base}/admin/dashboard`);
  await guide(small, "接入第一台服务器");
  await small.getByRole("button", { name: "下一步", exact: true }).click();
  await guide(small, "添加节点，安装 Agent");
  await small.screenshot({ path: `${output}/install-mobile.png` });
  const spotlight = await small.locator(".km-guide-spotlight").boundingBox();
  const add = await small.locator('[data-guide="add-node"]').boundingBox();
  assert.ok(add && spotlight && Math.abs(add.x - spotlight.x) <= 6);
  await small.keyboard.press("Escape");
  await narrow.close();
  console.log("PASS narrow mobile install target");

  reset();
  eulaAccepted = false;
  const agreement = await context();
  const agreed = await agreement.newPage();
  await agreed.goto(`${base}/admin/dashboard`);
  await agreed.getByRole("dialog").first().waitFor();
  await agreed.waitForTimeout(1300);
  assert.equal(await agreed.locator(".km-guide-content").count(), 0);
  assert.equal(writes.length, 0);
  await agreement.close();
  eulaAccepted = true;
  console.log("PASS EULA waits without consuming tutorials");

  reset([], 1, true);
  failWrites = true;
  const failed = await context();
  const failurePage = await failed.newPage();
  await failurePage.goto(`${base}/admin/dashboard`);
  await guide(failurePage, "让服务器主动通知你");
  await failurePage.getByText("指引记录保存失败，下次进入时可能会再次展示。", { exact: true }).waitFor();
  await failurePage.keyboard.press("Escape");
  assert.equal(await failurePage.locator(".km-guide-content").count(), 0);
  await failed.close();
  console.log("PASS failed saves remain dismissible and are reported");
  assert.deepEqual(errors, []);
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
