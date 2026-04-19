# TabVault

TabVault 是一个按 `AGENTS.md` 约束初始化的 Manifest V3 Chrome 插件工程骨架，目标是实现类似 OneTab 的本地优先标签收纳工具。

## 当前状态

- 已初始化 MV3 + TypeScript strict + React + Vite
- 已建立 `background`、`domain`、`storage`、`features`、`ui`、`tests` 目录
- 已提供 Popup / Manager / Options / Service Worker 的最小壳
- 已实现当前窗口、当前标签、选中标签的收纳主链路
- 已实现网页内容区域右键菜单“Send Current Page To TabVault”
- 已实现整组恢复到新窗口、单标签恢复、组排序
- 已实现 Manager 搜索、重命名、固定、删除、导入导出
- 已实现设置对默认点击动作和右键菜单的行为联动
- 已实现基于 `showCaptureFeedback` 的通知反馈
- 已补充首批 ADR、架构说明和测试策略文档

## 本地开发

```bash
npm install
npm run build
```

构建后可在 Chrome 的扩展管理页中以“加载已解压的扩展程序”方式加载 `dist/`。

开发时使用：

```bash
npm run dev
```

它会持续监听并重建 `dist/`，适合配合 Chrome 扩展页手动刷新调试。

## 质量检查

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

端到端测试脚手架也已建立：

```bash
npm run test:e2e
```

默认会跳过真实扩展浏览器用例。要在具备本地 Chrome 访问能力的机器上执行真实扩展 E2E，请使用：

```bash
RUN_EXTENSION_E2E=1 npm run test:e2e
```
