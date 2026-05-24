# MVP Test Matrix

## 1. 目标

本矩阵用于把 PRD、开发计划和具体测试执行关联起来，避免只停留在“有测试”而没有覆盖重点行为。

## 2. 测试层级

- Unit
  - domain、parser、migration、排序和状态变换
- Integration
  - feature + adapter mock + storage
- E2E
  - 扩展主路径

## 3. 覆盖矩阵

| 功能 | Unit | Integration | E2E |
| --- | --- | --- | --- |
| 初始化 root state | Yes | Yes | No |
| 收纳当前窗口 | Yes | Yes | Yes |
| 收纳当前标签 | Yes | Yes | Optional |
| 收纳选中标签 | Yes | Yes | Optional |
| 恢复整组到新窗口 | Yes | Yes | Yes |
| 恢复单标签并移除 | Yes | Yes | Yes |
| 组重命名 / 固定 / 删除 | Yes | Yes | Yes |
| 搜索组名 / 标题 / URL | Yes | Yes | Yes |
| JSON 导入导出 | Yes | Yes | Yes |
| SPD 导入 | Yes | Yes | Optional |
| Text 导入 | Yes | Yes | Yes |
| 设置读写 | Yes | Yes | Optional |
| 拖拽调整组和标签顺序 | Yes | Yes | Optional |
| Migration | Yes | Yes | No |

## 4. 必测用例

### 4.1 Unit

- `should reject chrome internal urls during capture`
- `should create a session group with approved timestamp title`
- `should preserve originalIndex for restore ordering`
- `should remove restored tab from original group`
- `should delete group when last tab is removed`
- `should sort pinned groups before non-pinned groups`
- `should match search query against group title`
- `should match search query against tab title and url`
- `should skip invalid lines during text import`
- `should skip imported urls already saved in pinned groups`
- `should import spd categories as session groups and skip unsupported links`
- `should reject unsupported json schema version`
- `should reorder tabs within the same session when dropped before another tab`
- `should move tabs between active sessions before a target tab`

### 4.2 Integration

- `should persist a captured group before closing tabs`
- `should not close tabs when storage write fails`
- `should open restored group in a new window`
- `should keep group after restore when keep-group is enabled`
- `should export only the target group in single-group export`
- `should skip json, text, and spd urls already saved in pinned groups`
- `should import spd categories into persisted session groups`
- `should merge settings patch without touching sessions`
- `should persist a reordered tab within the same session`
- `should persist a moved tab before a target tab in another session`

### 4.3 E2E

- 安装扩展并打开 Popup
- 收纳当前窗口并验证 Manager 出现新组
- 从 Manager 恢复整组并验证新窗口打开
- 恢复单标签并验证原组剩余数减少
- 搜索组名并定位目标组
- 导出 JSON、清空数据、重新导入并验证恢复

## 5. 质量门禁

每次合并至少通过：

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

以下场景必须额外通过 `npm run test:e2e`：

- capture/restore 主路径变更
- import/export 逻辑变更
- Manager 关键交互变更

## 6. 测试数据建议

### 轻量数据集

- 1 组 / 3 标签

### 标准数据集

- 5 组 / 20 标签

### 压力数据集

- 50 组 / 500+ 标签

## 7. 非功能验证

- 收纳 50 标签耗时目标小于 2 秒
- 搜索 5000 标签目标小于 200ms
- 恢复大组时浏览器不应出现明显假死
