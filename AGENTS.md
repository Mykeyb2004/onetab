# AGENTS.md

本文件定义本仓库的人类开发者与 AI Agent 共用的执行规范。除非有明确的 ADR（Architecture Decision Record）批准变更，否则默认遵守本文件。

当前项目目标是实现一个类似 OneTab 的 Chrome 插件，核心能力是标签收纳、恢复、搜索、分组管理与本地优先的数据持久化。

## 1. 总原则

1. 先保证正确性，再追求速度与炫技。
2. 先保证本地优先和可恢复性，再扩展同步、分享、AI 等高级能力。
3. 业务逻辑必须可测试，不能把核心逻辑直接埋在 UI 事件和 Chrome API 回调里。
4. 每个功能都应有对应文档入口、测试入口和验收标准。
5. 小步提交，避免一次性引入大范围不透明改动。

## 2. 技术基线

若后续没有 ADR 明确替换，默认采用以下技术基线：

- Chrome Extension：Manifest V3
- 语言：TypeScript，必须开启 `strict`
- UI：React
- 构建工具：Vite 或等价的现代前端构建链
- 单元测试：Vitest
- 端到端测试：Playwright
- 代码质量：ESLint + Prettier

工程初始化后，仓库必须提供这些标准脚本：

- `lint`
- `typecheck`
- `test`
- `test:watch`
- `test:e2e`
- `build`

## 3. 架构规范

### 3.1 模块边界

- `background` / `service worker`
  - 只负责 Chrome 事件响应、命令分发、权限交互和副作用编排。
- `features`
  - 承载按业务切分的功能模块，例如 `sessions`、`restore`、`search`、`import-export`。
- `domain`
  - 承载纯业务规则、实体、转换逻辑、排序、过滤、校验。
- `storage`
  - 承载存储接口、数据读写、版本迁移、序列化和反序列化。
- `ui`
  - 承载 Popup、Options、Manager 页面以及共享组件。
- `adapters`
  - 承载 Chrome API、浏览器能力、下载、通知等外部依赖适配层。

禁止把以下内容直接耦合在一起：

- React 组件直接读写 `chrome.storage`
- React 组件直接实现复杂恢复逻辑
- Service worker 直接持有大量业务判断和数据变换

### 3.2 设计原则

- 核心业务逻辑优先写成纯函数。
- 所有持久化结构必须有明确的 schema version。
- 数据迁移必须可重复执行，并有测试覆盖。
- 持久化数据结构演进默认采用升级式迁移，优先兼容历史数据，禁止无迁移地整体重置已有记录。
- 对 Chrome API 的调用必须经过一层可替换的 adapter，方便测试。
- 对特殊页面的过滤逻辑必须集中管理，不能散落在多个组件中。

### 3.3 数据与状态规范

- 时间统一使用 ISO 8601 字符串存储。
- ID 使用稳定、可序列化的字符串 ID。
- 存储层写入前做 schema 校验，读取后做容错和迁移。
- `settings` 结构变更必须基于已有配置做合并升级：新增字段补默认值，保留可兼容旧字段，废弃字段通过迁移逐步收敛，不得因版本升级整份覆盖用户已有配置。
- UI 状态与持久化状态分离，临时筛选/展开状态不得污染存储模型。

## 4. 代码规范

### 4.1 TypeScript 规范

- 禁止新增裸 `any`。确有必要时，必须附带注释说明边界和后续消除计划。
- 优先使用精确类型、联合类型、判别联合与显式返回类型。
- 导出公共函数时，参数和返回值类型必须清晰可见。
- 不允许用类型断言掩盖真实建模问题。

### 4.2 代码组织规范

- 单个文件应只关注一个明确职责。
- 复杂逻辑优先拆到 `domain` 或 `features` 中，不堆在组件里。
- 共享工具函数放在 `shared` 或 `lib`，禁止为复用而过早抽象。
- 新增依赖前先判断标准库、已有工具或少量自实现是否足够。

### 4.3 命名规范

- 目录和模块名使用小写加连字符或按既有约定统一。
- React 组件使用 `PascalCase`。
- 函数名优先体现动作和意图，例如 `captureTabsToSession`、`restoreSessionGroup`。
- 测试名必须描述行为，而不是实现细节。

### 4.4 注释规范

- 注释只解释“为什么”，不解释显而易见的“做了什么”。
- 临时 workaround 注释必须带原因和退出条件。
- 不保留失效注释、注释掉的大段旧代码或 AI 生成痕迹。

## 5. 目录规范

项目初始化后，默认目录结构如下：

```text
.
├── AGENTS.md
├── README.md
├── docs/
│   ├── prd/
│   ├── adr/
│   ├── architecture/
│   ├── testing/
│   ├── runbooks/
│   └── releases/
├── src/
│   ├── background/
│   ├── adapters/
│   ├── domain/
│   ├── features/
│   ├── storage/
│   ├── shared/
│   ├── ui/
│   │   ├── popup/
│   │   ├── options/
│   │   └── manager/
│   └── types/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── scripts/
```

补充约定：

- `docs` 只放文档，不放临时代码和导出产物。
- `scripts` 只放工程脚本，不放业务实现。
- 测试数据、fixture、mock 数据放到 `tests/fixtures` 或对应测试目录下。
- 构建产物必须进入 `dist`，且不得手工编辑。

## 6. 文档存放规范

### 6.1 文档分类

- `docs/prd/`
  - 产品需求文档、范围说明、里程碑说明
- `docs/adr/`
  - 技术决策记录，例如选型、架构调整、存储模型变更
- `docs/architecture/`
  - 模块图、数据流、事件流、权限设计
- `docs/testing/`
  - 测试策略、关键场景、覆盖要求、测试环境说明
- `docs/runbooks/`
  - 开发、调试、发布、回滚、数据修复操作手册
- `docs/releases/`
  - 发布说明、迁移说明、破坏性变更说明

### 6.2 文档规则

- 每个新功能在实现前，至少能追溯到一个 PRD 条目或 issue 描述。
- 每个跨模块技术决策都要有 ADR。
- 每次修改存储结构、权限模型、恢复流程，必须同步更新相应文档。
- 文档文件名优先使用英文、小写、连字符风格。
- 文档必须写清楚适用范围、最后更新时间和关联文件。

### 6.3 当前仓库的文档迁移约定

当前已有 PRD 文件：

- `docs/onetab-like-extension-prd.md`

后续若整理目录，新 PRD 应放入 `docs/prd/`。迁移旧文档时不要丢失链接和上下文。

## 7. 测试驱动规范

### 7.1 基本要求

- 默认采用 TDD 或至少测试先行的方式开发核心逻辑。
- 新功能必须先写失败测试，再写实现，再重构。
- 修复 Bug 时，必须先补一个能复现问题的回归测试。
- 没有测试保护的重构，不算完成。

### 7.2 测试分层

- 单元测试
  - 覆盖纯函数、业务规则、过滤逻辑、排序逻辑、数据转换、schema 校验、迁移逻辑。
- 集成测试
  - 覆盖 storage adapter、Chrome adapter、消息分发、导入导出流程。
- 端到端测试
  - 覆盖关键用户路径：收纳当前窗口、恢复整组、搜索已保存标签、导入导出。

### 7.3 测试编写规则

- 测试名称使用“should ... when ...”或等价清晰表达。
- 一个测试只验证一个清晰行为。
- 禁止只依赖快照判断正确性。
- 测试必须可重复执行，不能依赖真实网络和随机时间。
- 涉及时间、ID、Chrome API 的逻辑必须可注入或可 mock。

### 7.4 覆盖与门禁

- 关键业务模块必须有单元测试。
- 存储迁移必须有单元测试和至少一个集成测试。
- 每个 P0 功能至少有 1 个端到端测试场景覆盖。
- 合并前至少通过：
  - `lint`
  - `typecheck`
  - `test`
  - `build`

若本次修改触达关键主路径，还必须通过 `test:e2e`。

## 8. Chrome 插件专项规范

### 8.1 权限原则

- 只申请当前功能必需的最小权限。
- 新增权限时必须更新文档，并说明用途、风险和替代方案。
- 若某权限只服务于可选功能，应延后到对应版本再引入。

### 8.2 标签收纳规范

- 收纳逻辑必须过滤不可持久化或不可恢复页面。
- 过滤规则必须统一维护，并给出用户可理解的反馈。
- 恢复时尽量保留原顺序；若做不到，必须文档说明。
- 批量恢复需要考虑节流，避免瞬间打开大量标签导致卡顿。

### 8.3 存储规范

- 默认本地优先，不依赖远程服务才能工作。
- 导入导出数据格式必须带版本字段。
- 导出文件应足够简单，允许用户进行人工检查和迁移。
- 修改持久化 schema、历史记录或用户 `settings` 时，必须尽量保留原有数据；若存在不可兼容变更，必须提供显式迁移逻辑、迁移说明，并优先给出备份或导出方案。

## 9. 开发流程规范

### 9.1 开发顺序

推荐顺序：

1. 明确需求和验收标准
2. 更新或补充 PRD / ADR / 测试策略
3. 先写测试
4. 写最小实现
5. 重构
6. 补充必要文档
7. 运行质量门禁

### 9.2 Definition of Done

一个任务只有在以下条件同时满足时才算完成：

- 需求有来源
- 代码已实现
- 测试已覆盖
- 文档已更新
- 本地质量检查通过
- 没有留下未说明的临时方案

## 10. 变更控制规范

以下变更必须新增 ADR：

- 技术栈替换
- 存储模型或 schema 变化
- Manifest 权限变化
- Service worker 与页面通信模型变化
- 引入云同步、分享、账户体系等会改变产品边界的能力

以下变更必须补迁移说明：

- 导入导出格式变化
- 本地数据结构变化
- 恢复行为变化
- `settings` 字段、默认值或行为语义变化

## 11. AI Agent 额外约束

- 不得假设不存在的目录、脚本和依赖已经存在。
- 在空仓库中新增结构时，优先遵守本文件的目录约定。
- 不得为了“看起来完整”而引入未经验证的复杂基础设施。
- 任何大于一个模块边界的结构性改动，都要同步更新文档。
- 如果发现规范与现状冲突，应优先读代码，再通过 ADR 或文档修订解决，不要悄悄绕过。

## 12. 默认裁决规则

当两个方案都可行但没有额外上下文时，默认选择：

- 更简单的方案
- 更容易测试的方案
- 更少权限的方案
- 更少状态耦合的方案
- 更本地优先的方案

如果必须偏离这些默认规则，先记录原因，再实施变更。

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **onetab** (1870 symbols, 3570 relationships, 157 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/onetab/context` | Codebase overview, check index freshness |
| `gitnexus://repo/onetab/clusters` | All functional areas |
| `gitnexus://repo/onetab/processes` | All execution flows |
| `gitnexus://repo/onetab/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
