# ADR-003 Restore Behavior

- Status: Accepted
- Date: 2026-04-19

## Context

恢复行为会直接影响产品体验、数据模型和测试设计，必须提前固定规则。

## Decision

- 恢复整组标签时默认新建窗口
- 恢复单个标签后，从原组移除该标签
- 整组恢复后是否移除原组，遵循“恢复后删除原组”设置
- 会话组默认命名规则为 `保存于 YYYY-MM-DD HH:mm`

## Consequences

- 需要在恢复实现中优先保证顺序和窗口边界
- Manager 页面需要准确反映恢复后的组内剩余数据
