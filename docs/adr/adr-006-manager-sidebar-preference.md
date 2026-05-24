# ADR-006 Manager Sidebar Preference

- Status: Accepted
- Date: 2026-05-24

## Context

Manager 页左侧分组边栏需要新增整栏折叠/展开能力，并且用户明确要求该状态在刷新和重新打开页面后仍然保持。

这个需求可以通过单独 local storage key 或复用现有 `ExtensionSettings` 完成。由于 manager 已经有 `managerGridDensityPreference` 这类页面级持久化偏好，继续复用统一 settings 模型可以避免第二套设置读写路径和迁移入口。

同时，边栏折叠状态不属于纯运行时布局细节，而是稳定的用户偏好，因此需要纳入 schema 管理。

## Decision

- 在 `ExtensionSettings` 中新增 `managerSidebarPreference` 字段。
- 字段取值限定为 `expanded | collapsed`。
- 默认值为 `expanded`。
- 旧数据通过 `migrateRootState()` 自动补默认值，不重置其他设置。
- Manager 页运行时读取该字段，并在用户切换折叠状态后写回。

## Consequences

- Manager 页的边栏偏好能在刷新、重开和多页面同步后保持一致。
- `migrateRootState()` 需要增加一个 additive migration 分支，并由 repository 测试保护。
- Manager UI 需要同时处理“当前是否展开”和“如何把状态写回 settings”这两个关注点。
