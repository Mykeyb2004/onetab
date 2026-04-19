# TabVault MVP 开发计划

## 1. 文档信息

- 文档版本：v1.1
- 文档日期：2026-04-19
- 关联 PRD：`docs/onetab-like-extension-prd.md`
- 适用范围：TabVault Chrome Extension MVP 开发阶段

## 2. 计划目标

本计划用于把现有 PRD 拆解为可执行的开发工作包，覆盖以下内容：

- 里程碑与阶段目标
- 模块拆分与任务清单
- 测试驱动要求
- 依赖关系与并行策略
- 人天估算
- 风险与关键需求决策

本计划默认以 MVP 范围为准，不包含 V1.1 与 V2 能力。

## 3. 计划假设

已确认并采用以下实现假设：

1. 首版只做本地优先，不做任何云同步、账号体系和服务端。
2. 技术栈遵循 `AGENTS.md`：Manifest V3 + TypeScript strict + React + Vitest + Playwright。
3. 开发排期使用“人天”估算，不直接绑定人数。
4. MVP 目标是可安装、可收纳、可恢复、可搜索、可导入导出、可通过基础测试。
5. 恢复整组时，默认新建窗口并按原始顺序恢复标签。
6. 单标签恢复后从原组移除；整组恢复后是否移除原组，遵循“恢复后删除原组”设置。
7. 会话组默认命名规则为 `保存于 YYYY-MM-DD HH:mm`。
8. 搜索范围包含组名、标签标题与 URL。
9. 纯文本导入遇到非法 URL 时跳过继续，并提示跳过数量。
10. 导出同时支持“导出全部”和“仅导出单组”。
11. MVP 不支持无痕窗口标签收纳。

## 4. MVP 范围冻结

本次计划按以下功能开发：

- F1 一键收纳当前窗口全部标签
- F2 收纳当前标签页或选中标签页
- F3 会话组列表管理
- F4 恢复能力
- F5 组管理
- F6 搜索
- F7 导入与导出
- F8 设置项
- F9 本地存储与隐私

明确排除：

- 拖拽排序
- 批量多选操作
- 地址栏搜索
- 去重提示
- 分享、云同步、自动规则、Side Panel、AI 命名

## 5. 总体交付策略

建议按“先底层、后交互；先主路径、后增强；先测试、后实现”的顺序推进：

1. 工程基建与约束先落地
2. 核心数据模型、存储、适配层优先完成
3. 收纳与恢复链路优先打通
4. 再补 Manager 页面、搜索、导入导出和设置
5. 最后做边界情况、性能和发布准备

## 6. 里程碑拆分

## M0. 需求澄清与工程基建

- 目标：
  - 冻结 MVP 范围
  - 初始化工程骨架与质量门禁
  - 为后续 TDD 提供测试运行环境
- 预计工作量：2-3 人天

### 交付物

- Manifest V3 工程初始化
- TypeScript strict、ESLint、Prettier、Vitest、Playwright 配置
- 基础目录结构
- CI 或本地统一检查脚本
- 首个 ADR
  - `adr-001-frontend-stack.md`
  - `adr-002-storage-model.md`
  - `adr-003-restore-behavior.md`

### 任务拆分

- 初始化 `src`、`tests`、`docs` 基础目录
- 配置 `build`、`lint`、`typecheck`、`test`、`test:e2e`
- 搭建 Popup、Manager、Options、Service Worker 的最小壳
- 引入测试基建和 mock 工具
- 建立 Chrome API adapter 抽象接口

### 测试要求

- 至少有 1 个 smoke test 确认测试环境可执行
- 至少有 1 个构建验证，确保扩展可被打包

### 完成标准

- 空壳工程可构建、可加载到 Chrome
- 基础脚本全部可运行
- 文档结构与工程目录符合 `AGENTS.md`

## M1. 核心域模型与存储层

- 目标：
  - 完成会话、标签、设置、迁移与持久化能力
- 预计工作量：3-4 人天

### 交付物

- `SessionGroup`、`SavedTab`、`Settings` 类型定义
- schema version 与迁移器
- `storage.local` 数据访问层
- 数据校验与容错读取逻辑

### 任务拆分

- 定义核心实体与 DTO
- 设计存储 schema
- 实现 repository 接口
- 实现默认设置加载逻辑
- 实现默认会话组命名规则
- 实现 schema migration runner
- 设计并实现不可收纳 URL 过滤规则

### TDD 清单

- `should create a session group from valid tabs`
- `should assign a default session title using the configured timestamp format`
- `should skip unsupported urls when capturing tabs`
- `should migrate old schema to current version`
- `should preserve pin and restore settings after reload`
- `should reject malformed import payloads`

### 依赖关系

- 依赖 M0 完成
- M2、M3、M4 都依赖本阶段的 repository 与 schema 稳定

### 完成标准

- 本地存储读写闭环跑通
- schema version 生效
- 关键存储与迁移逻辑具备单元测试

## M2. 收纳链路

- 目标：
  - 打通“从浏览器标签到会话组”的主路径
- 预计工作量：3-4 人天

### 交付物

- 收纳当前窗口
- 收纳当前标签
- 收纳选中标签
- Service Worker 命令分发
- 快捷键与右键菜单入口
- 收纳成功反馈

### 任务拆分

- 实现 `captureCurrentWindow`
- 实现 `captureCurrentTab`
- 实现 `captureSelectedTabs`
- 实现 tabs 关闭与异常保护
- 实现 context menu 与 commands 注册
- 实现 Popup 主按钮动作绑定
- 实现通知或操作结果反馈

### TDD 清单

- `should capture all supported tabs in current window`
- `should capture only active tab when using current-tab action`
- `should keep unselected tabs open when capturing selected tabs`
- `should create a session before closing tabs`
- `should report skipped unsupported tabs to the user`

### 集成与 E2E

- 集成测试：adapter + repository + capture use case
- E2E：
  - 打开多个测试标签
  - 点击“收纳当前窗口”
  - 验证标签关闭与会话生成

### 完成标准

- Popup 可执行三类收纳动作
- Service Worker 与 UI 联动稳定
- 主路径 E2E 首次通过

## M3. Manager 页面与恢复链路

- 目标：
  - 提供可管理的会话列表和恢复能力
- 预计工作量：4-5 人天

### 交付物

- 会话组列表页
- 展开组内标签
- 恢复单个标签
- 恢复整组标签到新建窗口
- 重命名组、删除标签、删除组、固定组

### 任务拆分

- 搭建 Manager 页面布局
- 实现组卡片组件与标签列表组件
- 实现恢复 use case
- 实现新建窗口恢复整组逻辑
- 实现单标签恢复后从原组移除
- 实现恢复后删除或保留策略
- 实现重命名、固定、删除操作
- 增加空状态和错误状态

### TDD 清单

- `should restore a group into a new window in original order`
- `should remove restored tab from the original group by default`
- `should remove group after restoring all tabs when restore-remove is enabled`
- `should keep group after restore when setting is disabled`
- `should pin group to the top of the list`
- `should delete empty group after last tab is removed`

### 集成与 E2E

- 集成测试：restore use case + repository + adapter
- E2E：
  - 收纳一组标签
  - 进入 Manager
  - 执行“恢复单个”和“恢复全部”
  - 验证顺序与数据变化

### 完成标准

- 用户可以从 Manager 完成全部核心管理动作
- 恢复策略在设置与实际行为上保持一致

## M4. 搜索、导入导出与设置

- 目标：
  - 完成可用性增强与数据可迁移能力
- 预计工作量：3-4 人天

### 交付物

- 全局搜索（组名、标签标题、URL）
- JSON 导入导出
- 纯文本 URL 导入导出
- 设置页
- 默认行为配置项

### 任务拆分

- 实现搜索索引与搜索结果呈现
- 实现组名搜索匹配
- 实现 JSON 序列化/反序列化
- 实现纯文本 URL 解析器
- 实现下载与文件选择 adapter
- 实现“导出全部”和“导出单组”两种导出路径
- 实现设置页与配置读写
- 把设置接入收纳与恢复链路

### TDD 清单

- `should find session groups by group title`
- `should find saved tabs by title`
- `should find saved tabs by url`
- `should export current data with schema version`
- `should export a single session group without unrelated groups`
- `should import valid text urls as a new session group`
- `should skip invalid lines in text import`
- `should apply restore behavior from settings`

### 集成与 E2E

- 集成测试：import/export adapter + repository
- E2E：
  - 导出 JSON
  - 清空本地数据
  - 导入 JSON
  - 验证组与标签恢复

### 完成标准

- 用户可完整备份和恢复本地数据
- 搜索能直接帮助定位和打开目标标签
- 设置变更可即时影响功能行为

## M5. 质量加固与发布准备

- 目标：
  - 补齐边界情况、性能验证和发布最小准备
- 预计工作量：2-3 人天

### 交付物

- 边界情况处理
- 基础性能验证
- 隐私说明与 README
- 发布清单

### 任务拆分

- 补齐特殊页面跳过提示
- 验证 50/100 标签场景性能
- 补充空状态、异常文案、失败回退
- 审核 Manifest 权限最小化
- 整理 README 和本地开发说明
- 整理首次发布 checklist

### 测试清单

- 大量标签收纳性能测试
- 特殊 URL 跳过回归测试
- 恢复大量标签节流测试
- 导入损坏文件失败测试
- 设置持久化回归测试

### 完成标准

- `lint`、`typecheck`、`test`、`build`、`test:e2e` 全部通过
- MVP 主路径稳定
- 发布资料达到内测可交付水平

## 7. 模块级工作分解结构

### A. 工程与基础设施

- 工程初始化
- Manifest 组织
- 脚本与构建
- lint/typecheck/test/e2e 门禁

### B. Domain

- 会话实体
- 标签实体
- 设置实体
- URL 过滤规则
- 恢复顺序规则
- 导入导出校验规则

### C. Storage

- local storage repository
- schema version
- migration
- settings store

### D. Adapters

- Chrome tabs adapter
- Chrome storage adapter
- commands adapter
- context menus adapter
- downloads adapter
- notifications adapter

### E. UI

- Popup
- Manager
- Options / Settings
- 通知与反馈

### F. Testing

- unit fixtures
- integration harness
- Playwright extension e2e

## 8. 并行开发建议

若有 2-3 名开发者，可按下面方式并行：

- 方向 1：工程基建 + storage/domain
- 方向 2：Popup + capture + service worker
- 方向 3：Manager + search + settings

并行前提：

- 先冻结实体模型和 adapter 接口
- 先确定恢复策略和默认设置
- 先明确 import/export schema

## 9. 人天估算

### MVP 总估算

- M0：2-3 人天
- M1：3-4 人天
- M2：3-4 人天
- M3：4-5 人天
- M4：3-4 人天
- M5：2-3 人天

总计：17-23 人天

### 日历时间参考

- 1 名开发者：约 4-5 周
- 2 名开发者：约 2.5-3 周
- 3 名开发者：约 2 周

说明：

- 上述时间未计入 Chrome Web Store 上架审核等待时间
- 若在工程初始化阶段遇到 MV3 构建或 Playwright 扩展调试问题，排期需预留 1-2 人天缓冲

## 10. 测试策略落地

### 单元测试重点

- 过滤不可保存 URL
- 默认会话组命名
- 组与标签的创建和删除规则
- 单标签恢复后的组内数据变化
- 恢复顺序
- schema migration
- import/export parser

### 集成测试重点

- repository + migration
- capture use case + tabs adapter
- restore use case + tabs adapter
- settings 与行为联动

### E2E 主路径

1. 首次安装后打开 Popup 并执行收纳当前窗口
2. 进入 Manager 并在新建窗口恢复整组标签
3. 恢复单个标签并检查组内剩余数据
4. 按组名或标签信息搜索已保存标签并直接打开
5. 导出 JSON 后重新导入

## 11. Definition of Done

每个里程碑完成时必须满足：

- 关联 PRD 条目已覆盖
- 代码已实现
- 对应测试已存在并通过
- 文档已更新
- 无未说明的临时方案残留

## 12. 风险与缓冲

### 主要风险

- MV3 下 service worker 生命周期导致状态或消息问题
- Playwright 对扩展场景的调试成本高于普通 Web 项目
- 特殊页面过滤与恢复行为存在浏览器限制
- 大量标签恢复可能造成性能抖动

### 建议缓冲

- 为 M0 和 M5 各预留 0.5-1 人天
- 首轮内测前安排至少 1 次专门的回归测试日

## 13. 已确认需求决策

1. 恢复整组时，默认新建窗口恢复。
2. 恢复单个标签后，从原组移除该标签。
3. 会话组默认命名规则为 `保存于 YYYY-MM-DD HH:mm`。
4. 搜索范围包含组名、标签标题和 URL。
5. 纯文本导入遇到非法 URL 时跳过继续，并提示跳过数量。
6. 导出同时支持“导出全部”和“仅导出单组”。
7. MVP 不支持无痕窗口标签收纳。

## 14. 下一步建议

建议按下面顺序继续推进：

1. 按第 13 节的已确认决策冻结 MVP 规则
2. 基于已确认需求补第一批 ADR
3. 直接初始化工程骨架
4. 从 M0 和 M1 开始，以测试先行推进
