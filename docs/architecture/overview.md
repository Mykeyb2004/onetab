# Architecture Overview

## Scope

本目录用于描述 TabVault MVP 的完整技术设计，而不只是初始化骨架。

## Design Map

- `system-design.md`
  - 系统边界、分层、核心设计原则、运行时组件
- `data-model.md`
  - Root state、会话模型、导入导出结构、数据约束
- `module-contracts.md`
  - 各模块职责、用例接口、adapter 契约、消息契约
- `runtime-flows.md`
  - 安装、收纳、恢复、搜索、导入导出、设置更新的运行时流程
- `permissions-and-security.md`
  - Manifest 权限、隐私边界、风险控制与限制说明

## Module Layout

- `src/background`
  - Service worker，负责扩展事件入口、命令分发和副作用编排
- `src/domain`
  - 纯业务规则，例如 URL 过滤、默认命名、会话组构造、恢复规则
- `src/storage`
  - 本地持久化、schema 和迁移
- `src/features`
  - 用例层，负责组合 domain、storage 和 adapter
- `src/adapters`
  - Chrome API、下载、通知等外部依赖适配层
- `src/ui`
  - Popup、Manager、Options 页面

## Core Principles

1. 本地优先。MVP 不依赖服务端即可完整运行。
2. 业务逻辑纯函数优先。核心规则不得散落在 UI 和 background 事件回调里。
3. Chrome API 必须经 adapter 隔离，保证测试性。
4. 存储结构必须版本化，可迁移，可回滚。
5. 主路径先行。优先保证收纳、恢复、搜索、导入导出稳定，再做增强功能。

## Primary Runtime Shape

1. Service worker 在安装和启动时引导本地 root state，并注册命令与右键菜单。
2. Popup 通过 runtime message 或 feature 调用触发收纳动作与页面跳转。
3. Manager 和 Options 通过 features 层读取和修改状态。
4. storage 层负责 schema 兼容、默认值和持久化原子写入。
5. capture / restore / import / export 等副作用都由 feature + adapter 配合完成。
