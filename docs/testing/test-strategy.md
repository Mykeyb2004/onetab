# Test Strategy

## Scope

本文件定义测试策略，详细测试用例矩阵见 `mvp-test-matrix.md`。

## Current Baseline

初始化阶段先建立三层测试壳：

- `tests/unit`
  - 验证纯函数和领域规则
- `tests/integration`
  - 验证 repository 与存储边界
- `tests/e2e`
  - 预留给扩展主路径的真实浏览器测试

## Immediate Coverage

- URL 过滤规则
- 会话组默认命名和组装
- 本地 root state 默认值与设置持久化

## Next Step

M2 与 M3 完成后，需要把 E2E 从占位壳升级为真实用例：

- 收纳当前窗口
- 在新建窗口恢复整组
- 单标签恢复后从原组移除

## Quality Gate

每次合并至少通过：

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

主路径改动还必须跑 `npm run test:e2e`。
