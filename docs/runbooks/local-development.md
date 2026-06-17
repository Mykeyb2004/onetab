# Local Development Runbook

## 1. 环境要求

- Node.js LTS
- npm
- Chrome 最新稳定版

## 2. 安装依赖

```bash
npm install
```

## 3. 常用命令

```bash
npm run dev
npm run dev:preview
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

若要执行真实扩展浏览器 E2E：

```bash
RUN_EXTENSION_E2E=1 npm run test:e2e
```

## 4. 网页预览入口

无需把扩展加载到 Chrome 时，可以先用网页预览查看 Manager 主界面和大部分 UI 交互：

```bash
npm run dev:preview
```

启动后打开：

```text
http://127.0.0.1:5173/preview.html
```

预览入口会自动用仓库根目录的 `export20260524.spd` 初始化本地预览数据。数据保存在当前浏览器的 `localStorage` 中，刷新页面后仍会保留；如需重新从 `export20260524.spd` 载入，打开 `http://127.0.0.1:5173/preview.html?reset=1`。

预览环境会模拟 `chrome.storage.local`、`chrome.storage.onChanged`、`chrome.runtime`、`chrome.tabs` 和 `chrome.windows` 的最小行为。它适合检查 Manager 布局、搜索、分组管理、导入导出、回收站、密度和侧边栏偏好；真实标签收纳、关闭标签、恢复窗口、右键菜单、快捷键、通知和 Manifest 权限仍需使用扩展模式验证。

## 5. 加载扩展

1. 执行 `npm run build`
2. 打开 Chrome 扩展管理页
3. 开启开发者模式
4. 选择“加载已解压的扩展程序”
5. 选择仓库下的 `dist/`

## 6. 调试入口

- Popup：点击工具栏扩展图标
- Manager：打开 `manager.html`
- Options：打开 `options.html`
- Service worker：在扩展详情页查看背景页 / Service worker 控制台

## 7. 推荐开发顺序

1. 先写 unit test
2. 再写 feature 和 domain
3. 再接 adapter
4. 最后接 UI

## 8. 本地验证顺序

推荐最少验证链路：

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. 手动加载 `dist/` 并验证页面能打开

## 9. 当前限制

- 已有真实扩展 E2E harness，但默认不开启；当前 CLI 沙箱环境无法稳定直接拉起带扩展的系统 Chrome
- 如需执行真实扩展 E2E，请在具备本地 Chrome 权限的开发机上使用 `RUN_EXTENSION_E2E=1`
