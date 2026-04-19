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

## 4. 加载扩展

1. 执行 `npm run build`
2. 打开 Chrome 扩展管理页
3. 开启开发者模式
4. 选择“加载已解压的扩展程序”
5. 选择仓库下的 `dist/`

## 5. 调试入口

- Popup：点击工具栏扩展图标
- Manager：打开 `manager.html`
- Options：打开 `options.html`
- Service worker：在扩展详情页查看背景页 / Service worker 控制台

## 6. 推荐开发顺序

1. 先写 unit test
2. 再写 feature 和 domain
3. 再接 adapter
4. 最后接 UI

## 7. 本地验证顺序

推荐最少验证链路：

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. 手动加载 `dist/` 并验证页面能打开

## 8. 当前限制

- 已有真实扩展 E2E harness，但默认不开启；当前 CLI 沙箱环境无法稳定直接拉起带扩展的系统 Chrome
- 如需执行真实扩展 E2E，请在具备本地 Chrome 权限的开发机上使用 `RUN_EXTENSION_E2E=1`
