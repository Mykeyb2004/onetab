# Default Notes Capture Design

- 适用范围：TabVault 页面右键菜单与 Popup 中“单页发送到 TabVault”的默认归档行为
- 最后更新时间：2026-06-18
- 关联文件：
  - `src/features/sessions/capture/capture-browser-tab.ts`
  - `src/features/sessions/capture/capture-current-tab.ts`
  - `src/features/sessions/capture/capture-tabs.ts`
  - `src/features/sessions/add-browser-tab-to-session-group.ts`
  - `src/background/service-worker.ts`
  - `src/domain/sessions/create-session-group.ts`
  - `src/storage/local/repository.ts`
  - `docs/architecture/runtime-flows.md`
  - `tests/integration/features/capture.test.ts`

## 1. 背景

当前未指定目标分组的 capture 流程会创建标题为 `保存于 YYYY-MM-DD` 的自动日期分组。代码已经会合并同一天的自动日期分组，因此同一天不会无限新增分组；但长期使用后，每天仍会留下一个日期分组。

用户希望把“不发送到 Fixed Groups 的页面内容”默认收纳到一个长期的 `笔记` 分组中，减少日期分组数量。这里的 Fixed Groups 对应现有 `SessionGroup.pinned === true` 的固定分组。

## 2. 目标与非目标

### 2.1 目标

- 用户保存单个当前页面时，若没有显式选择 Fixed Groups 或 Recent Groups，默认写入一个名为 `笔记` 的普通分组。
- 如果 active sessions 中已经存在未删除的 `笔记` 分组，则追加到按现有分组排序规则选出的第一个候选分组。
- 如果不存在未删除的 `笔记` 分组，则创建一个新的 `笔记` 分组，再写入当前页面。
- Fixed Groups 和 Recent Groups 的显式目标选择继续保持现有行为。
- 批量收纳当前窗口、选中标签、左右侧标签、全部窗口等操作继续使用自动日期分组。
- 保持“先保存，后关闭原标签”的可靠性规则。

### 2.2 非目标

- 不修改持久化 schema，不新增 migration。
- 不把所有 `createSessionGroup` 的默认标题改成 `笔记`。
- 不把导入文本、导入文件、手动创建空分组等流程改成 `笔记`。
- 不把批量收纳结果混入 `笔记`，避免大批标签污染长期单页笔记分组。
- 不自动迁移历史 `保存于 YYYY-MM-DD` 分组到 `笔记`。
- 不新增运行时设置项；本次把 `笔记` 作为默认产品行为。

## 3. 方案对比

### 3.1 方案 A：把默认标题从日期改成 `笔记`

做法：修改 `formatSessionTitle` 或 `createSessionGroup` 的默认 title。

优点：

- 改动最少。

缺点：

- 会影响所有创建分组的调用方，包括批量 capture、导入和手动空分组。
- 当前同名合并逻辑只针对 `保存于 YYYY-MM-DD`，直接改标题不会自动合并多个 `笔记` 分组。
- 产品语义过粗，容易把“批量临时收纳”和“单页笔记收藏”混在一起。

结论：不采用。

### 3.2 方案 B：扩大同名合并规则，让 `笔记` 也自动合并

做法：修改 `mergeSessionGroupsByTitle`，让 `笔记` 像自动日期组一样合并。

优点：

- 可以避免重复 `笔记` 分组。

缺点：

- 合并规则属于读取层和存储层通用行为，影响范围大于需求本身。
- 如果用户手动创建了多个同名 `笔记` 分组，读取层会隐式合并，可能违背用户对手动分组的预期。
- 仍无法解决哪些 capture 动作应该进入 `笔记` 的产品边界。

结论：不作为本次主方案。

### 3.3 方案 C：为单页默认 capture 增加“找到或创建 `笔记` 分组并追加”用例（推荐）

做法：新增或调整单页 capture 的 feature 层逻辑，显式查找 active `笔记` 分组；找到则追加，找不到则创建；批量 capture 不变。

优点：

- 精准覆盖用户痛点，不扩大到批量 capture 和导入流程。
- 不需要改变存储 schema。
- 不依赖读取层隐式合并，行为更可测试、更可解释。
- Fixed Groups 和 Recent Groups 的显式选择天然保持不变。

缺点：

- 需要从当前通用 `captureBrowserTabs` 路径中拆出单页默认路径，测试要覆盖更多分支。

结论：采用。

## 4. 推荐设计

### 4.1 默认目标分组

- 默认笔记分组标题固定为 `笔记`。
- 只匹配 active sessions：`trashedAt` 为空的分组才可作为默认目标。
- 如果存在多个 active `笔记` 分组，先复用现有 `sortSessionGroups` 排序，再选择第一个候选分组，并只追加到这一个分组。
- 新创建的 `笔记` 分组保持 `pinned: false`，不自动进入 Fixed Groups。

### 4.2 单页默认 capture 行为

适用入口：

- Popup 的 `Capture Current Tab`
- 页面右键菜单的 `Only Send This Tab To TabVault`

流程：

1. 获取当前 tab。
2. 过滤 unsupported URL。
3. 读取 root state。
4. 查找 active `笔记` 分组。
5. 找到则追加一个 saved tab，并更新 `tabCount`、`updatedAt`。
6. 找不到则创建 `笔记` 分组，写入当前 tab。
7. 存储写入成功后关闭原 tab。
8. 返回包含目标分组名称的反馈，例如 `Added the current page to "笔记".`

### 4.3 显式目标选择保持不变

页面右键菜单中的 Fixed Groups 和 Recent Groups 继续调用现有追加到目标组的逻辑。

- Fixed Groups：用户明确选择固定分组时，仍写入该固定分组。
- Recent Groups：用户明确选择最近分组时，仍写入该最近分组。
- 这些路径不应被默认 `笔记` 规则拦截。

### 4.4 批量 capture 保持日期分组

以下入口继续使用现有自动日期分组：

- Capture Current Window
- Send All Tabs In This Window To TabVault
- Send All Tabs In This Tab Group To TabVault
- Send Selected Tabs To TabVault
- Send All Tabs Except This One To TabVault
- Send Tabs To The Left To TabVault
- Send Tabs To The Right To TabVault
- Send All Tabs In All Windows To TabVault
- Exclude Current Site From This Send

原因：这些动作更接近 OneTab 式批量临时收纳，用日期分组保留上下文更清楚。

## 5. 错误处理与边界

- Unsupported URL：不创建 `笔记` 分组，不关闭原 tab。
- 存储写入失败：不关闭原 tab。
- 关闭原 tab 失败：保留已写入数据，并返回部分成功信息。
- 已存在 trashed `笔记` 分组：不复用，创建新的 active `笔记` 分组。
- 用户手动固定 `笔记` 分组后：它会作为 Fixed Group 展示；默认单页 capture 是否继续写入该组应按 active 标题匹配处理，不因为 `pinned` 而排除。这样用户可以把 `笔记` 固定到顶部，同时默认 capture 仍然归档到同一个长期分组。

## 6. 影响范围

### 6.1 Feature 层

需要为单页默认 capture 增加一个清晰用例，例如 `captureBrowserTabToDefaultNotesGroup` 或等价函数。该用例可以复用现有 tab 过滤、saved tab 构造和 close tab 规则，但不应把复杂逻辑塞进 React 或 background 事件处理器。

### 6.2 Background

`service-worker.ts` 只负责把单页默认入口接到新用例：

- runtime message `capture/current-tab`
- context menu `pageCaptureCurrentTab`

批量入口继续走现有 `captureBrowserTabs`。

### 6.3 Domain / Storage

不修改 root state schema。

可新增纯函数用于：

- 判断默认笔记分组标题。
- 从 session 列表中选择可写入的默认笔记分组。
- 构造追加后的 `SessionGroup`。

如能保持 feature 层足够简单，也可以先不抽象过度。

### 6.4 文档

更新 `docs/architecture/runtime-flows.md`：

- `Capture Current Tab` 从“构造单标签会话组”改为“写入或创建默认 `笔记` 分组”。
- `Send Page To Existing Group` 继续说明 Fixed Groups / Recent Groups 是显式目标选择。

## 7. 测试策略

### 7.1 集成测试

在 `tests/integration/features/capture.test.ts` 增加或调整测试：

- should add current tab to default notes group when no explicit target is chosen
- should reuse existing active notes group when capturing another current tab
- should create a new notes group when only trashed notes group exists
- should keep current-window capture using date group
- should not close the tab when storage write fails

### 7.2 单元测试

如果新增纯 selector 或 append helper，补充对应单元测试，覆盖：

- 选择 active `笔记` 分组。
- 忽略 trashed `笔记` 分组。
- 多个候选分组时选择规则稳定。

### 7.3 回归验证

实现完成后至少运行：

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

若触达 browser context menu 行为或端到端主路径，再运行 `npm run test:e2e`。

## 8. 验收标准

- 默认保存当前 tab 时，manager 中出现或复用 `笔记` 分组。
- 连续多天保存当前 tab，不再每天新增日期分组。
- 选择 Fixed Groups 时，页面仍保存到用户选择的固定分组。
- 选择 Recent Groups 时，页面仍保存到用户选择的最近分组。
- 批量收纳仍按日期分组。
- Unsupported URL、写入失败、关闭失败的可靠性行为不退化。
- 文档与测试同步更新。

## 9. ADR 判断

本次不改变技术栈、权限模型、持久化 schema、导入导出格式或 service worker 通信模型，因此不需要新增 ADR。若后续把默认目标分组做成可配置设置，或引入新的持久化字段，再补充对应 ADR 或迁移说明。
