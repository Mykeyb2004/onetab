# MVP Implementation Backlog

## 1. 说明

本 backlog 用于把开发计划进一步压缩为可落 issue 的任务列表。粒度以“1 个开发者可在 0.5 到 2 天内完成”为目标。

## 2. Epic 列表

### EPIC-01 工程与基础设施

- TASK-001 初始化 MV3 构建与多页面入口
- TASK-002 建立 ESLint / TypeScript / Vitest / Playwright 基线
- TASK-003 建立 docs / tests / src 标准目录
- TASK-004 补首批 ADR 与测试策略

### EPIC-02 Root State 与存储

- TASK-101 定义 `RootState`、`SessionGroup`、`SavedTab`、`ExtensionSettings`
- TASK-102 实现 default root state
- TASK-103 实现 migration runner
- TASK-104 实现 repository 读写接口
- TASK-105 为 storage 层补集成测试

### EPIC-03 Capture

- TASK-201 实现 tabs adapter 的查询接口
- TASK-202 实现 unsupported URL 过滤规则
- TASK-203 实现 `captureCurrentWindow`
- TASK-204 实现 `captureCurrentTab`
- TASK-205 实现 `captureSelectedTabs`
- TASK-206 实现“先保存后关闭”保护
- TASK-207 接入 Popup / command / context menu

### EPIC-04 Manager 与恢复

- TASK-301 实现 sessions 列表查询与排序
- TASK-302 实现 Manager 页面组列表 UI
- TASK-303 实现 `restoreSessionGroup`
- TASK-304 实现 `restoreSavedTab`
- TASK-305 实现恢复后的组内删除与空组回收
- TASK-306 实现组重命名
- TASK-307 实现组固定
- TASK-308 实现删除组 / 删除单标签

### EPIC-05 搜索

- TASK-401 设计搜索候选结构
- TASK-402 实现组名匹配
- TASK-403 实现标签标题与 URL 匹配
- TASK-404 接入 Manager 搜索 UI

### EPIC-06 导入导出

- TASK-501 实现 JSON 导出全部
- TASK-502 实现 JSON 导出单组
- TASK-503 实现文本导出
- TASK-504 实现 JSON 导入校验与写入
- TASK-505 实现文本导入与非法 URL 跳过
- TASK-506 接入文件下载和文件选择 adapter

### EPIC-07 设置与权限联动

- TASK-601 实现设置读取与 patch 写入
- TASK-602 接入 Options 页面
- TASK-603 实现 context menu 开关联动
- TASK-604 实现恢复策略联动

### EPIC-08 质量与发布准备

- TASK-701 把 E2E 占位壳升级为真实扩展 harness
- TASK-702 补主路径 E2E
- TASK-703 补性能验证
- TASK-704 补 README / runbook / release checklist
- TASK-705 手动 smoke test 与回归

## 3. 依赖关系

- EPIC-01 是其他 Epic 前置
- EPIC-02 是 EPIC-03 / 04 / 05 / 06 / 07 前置
- EPIC-03 与 EPIC-04 强耦合，但可部分并行
- EPIC-05 依赖 EPIC-04 的列表与状态读取
- EPIC-06 依赖 EPIC-02
- EPIC-08 放在最后，但 E2E harness 可在 EPIC-03 前启动

## 4. 建议 issue 颗粒度

- 单个 issue 最多跨一个模块边界
- 每个 issue 必须写清：
  - 来源 PRD 条目
  - 验收标准
  - 单元 / 集成 / E2E 要求

## 5. 当前优先级

### P0

- TASK-101
- TASK-102
- TASK-103
- TASK-104
- TASK-201
- TASK-202
- TASK-203
- TASK-301
- TASK-303
- TASK-304

### P1

- TASK-204
- TASK-205
- TASK-306
- TASK-307
- TASK-308
- TASK-401
- TASK-402
- TASK-403
- TASK-501
- TASK-504
- TASK-601
- TASK-602

### P2

- TASK-502
- TASK-503
- TASK-505
- TASK-603
- TASK-702
- TASK-703
- TASK-705
