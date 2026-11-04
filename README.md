# Komari Web UI

参与翻译Komari？
- 直接提PR

We use AI to assist with translations. If you find any issues, please let us know!

How to contribute to Komari translations?
- Directly PR

## 开发环境配置

> 我不是计科专业的，代码质量可能达不到平均水平，React是边学边写的，在此之前我从未接触过前端开发，请多包涵。

### 前置 Nodejs

如果未安装，请访问 [Node.js 官网](https://nodejs.org/) 下载并安装。版本建议为 22 及以上。

### 安装依赖

```bash
npm install
```

> 所有指令均在项目根目录下执行

### 修改API地址

1. 复制 `.env.example` 文件并重命名为 `.env.development`。

2. 修改 `.env.development` 文件中的 `VITE_API_TARGET` 为你的开发环境地址。

### 启动开发服务器

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 终端复制与回归测试

选中文字后使用系统复制快捷键（`Ctrl+C` / `Cmd+C`）、`Ctrl+Shift+C`、`Ctrl+Alt+C` 或右键复制；无选区时 `Ctrl+C` 仍向终端发送中断。复制后保留选区，右键不会将已有选区替换成光标下的单词。Clipboard API 不可用时会尝试浏览器兼容复制，失败时显示提示。

```bash
npx playwright install chromium
npm run test:terminal
# 已安装 Chrome 时可复用本机浏览器：
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npm run test:terminal
```

测试使用真实 xterm 组件及本地模拟 WebSocket，不连接服务器或执行远程命令。

## 主题相关

如果你需要基于本项目进行二次开发，可以参考以下步骤：

1. 完成开发环境配置

> 如果你是在 Linux 系统下开发，可以直接运行脚本 `build-theme.sh` 快速生成主题包。

2. 修改 `komari-theme.json` 中的相关配置，具体可参考 [主题配置文件 | Komari](https://komari-document.pages.dev/dev/theme.html#%E4%B8%BB%E9%A2%98%E9%85%8D%E7%BD%AE%E6%96%87%E4%BB%B6)

   `configuration` 会根据 `type` 复用 `data` 字段：

   - `managed`: `data` 为配置项数组，后台会生成主题设置表单。
   - `raw`: `data` 为 HTML 字符串，后台会在主内容区域渲染该 HTML。
   - `redirect`: `data` 为站内相对路径，以实际部署的站点根目录（如 `VITE_BASE_URL`）为基准；例如根目录为 `/` 时 `settings` 或 `../settings` 会导航到 `/settings`，根目录为 `/abc/` 时会导航到 `/abc/settings`。

3. 发挥你的想象和创造力，设计并实现你独特的主题风格！

4. 构建主题

   ```bash
   npm run build
   ```

5. 生成的主题文件位于 `dist` 目录下，创建一个新的文件夹 `my-theme`（名称自定），将 `dist` 目录下复制到 `my-theme` 文件夹中。

6. 将 `komari-theme.json` 文件复制到 `my-theme` 文件夹中。

7. 将 `my-theme` 文件夹打包为 ZIP 文件。

8. 在 Komari 的主题管理页面上传并应用你的自定义主题。
