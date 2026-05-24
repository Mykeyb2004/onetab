# New Tab Manager Override Design

- 适用范围：TabVault 通过 Chrome 新标签页 override 提供默认入口壳页
- 最后更新时间：2026-05-24
- 关联文件：
  - `public/manifest.json`
  - `src/background/service-worker.ts`
  - `src/ui/manager/App.tsx`
  - `src/ui/popup/App.tsx`
  - `src/features/settings/load-settings.ts`
  - `docs/onetab-like-extension-prd.md`
  - `docs/architecture/runtime-flows.md`
  - `tests/e2e/extension-shell.spec.ts`

## 1. 背景

当前 TabVault 的入口结构已经比较明确：

- `Popup` 承载高频快捷操作
- `Manager` 承载完整的会话管理能力
- `Options` 承载配置能力

这套结构适合工具栏触发场景，但用户提出的新需求是：浏览器每次新建页面时，优先进入 TabVault 的 manager 体验，而不是 Chrome 默认新标签页。

在调研 Chrome 官方能力后，可以确认扩展支持通过 `chrome_url_overrides.newtab` 接管新标签页与新窗口首个标签页；但该能力属于 Manifest 静态声明，而不是运行时可切换行为。因此，“默认关闭、用户手动开启”的运行时开关不适合作为本次方案基础。

同时，现有 `manager.html` 是完整工作台，首屏会读取全部会话与设置并承载大量交互状态。若直接将它作为新标签页，会把“轻入口”与“重工作台”混在一起，也更容易放大性能和信息密度问题。

## 2. 目标与非目标

### 2.1 目标

- 让 TabVault 成为浏览器新标签页和新窗口首个页的默认入口。
- 保持 `Popup`、`Manager`、`Options` 的既有职责边界，不让新标签页直接吞并完整 manager 职责。
- 提供一个比 `manager.html` 更轻量的新标签页壳，支持高频动作和最近内容预览。
- 复用现有 background runtime message、capture、open manager、open options 等主链路。
- 明确记录平台限制，避免引入“看起来可配、实际上不可生效”的伪设置项。

### 2.2 非目标

- 不提供“是否启用 new tab override”的运行时开关。
- 不监听 `tabs.onCreated` 或其他动态事件去劫持普通网页导航。
- 不让 `newtab.html` 完整复制 `manager.html` 的所有交互和状态。
- 不在本次引入新权限。
- 不改变收纳、恢复、导入导出、帮助页等现有业务语义。

## 3. 方案对比

### 3.1 方案 A：直接将 `manager.html` 设为 new tab override

做法：Manifest 直接将 `manager.html` 注册为 `chrome_url_overrides.newtab` 的目标页。

优点：

- 技术路径最短。
- 用户进入后立即看到完整会话管理界面。

缺点：

- `manager.html` 过重，不符合新标签页入口“快速、小而明确”的使用预期。
- 会让新标签页承担过多状态与交互，放大首屏加载成本。
- 难以为“继续浏览”和“进入 TabVault 工作流”提供平衡的信息架构。

### 3.2 方案 B：用事件监听模拟“可开关”的新标签页跳转

做法：保留 Chrome 默认新标签页，使用 background 监听新建 tab 或导航事件，再手动跳转到 manager。

优点：

- 表面上更接近“默认关闭、手动开启”的产品诉求。
- 可以把开关塞进现有 settings 模型。

缺点：

- 不符合 Chrome 官方 override 模型。
- 容易误伤普通网页导航、恢复标签、帮助页和扩展内部 `tabs.create` 流程。
- 风险高于收益，且测试成本明显更高。

### 3.3 方案 C：新增轻量 `newtab.html` 壳页并静态 override（推荐）

做法：Manifest 静态注册 `newtab.html` 作为新标签页 override，`newtab.html` 只承担轻量入口壳职责，完整管理仍通过 `manager.html` 完成。

优点：

- 符合 Chrome 官方设计边界。
- 保持产品职责清晰：new tab 是默认入口壳，manager 是完整工作台。
- 更容易控制首屏体积、空状态和后续演进空间。

缺点：

- 需要新增一个页面入口和一层轻量视图逻辑。
- 用户不能在运行时关闭 override，只能接受“安装后接管新标签页”的产品事实。

## 4. 推荐设计

### 4.1 总体结构

- Manifest 新增 `chrome_url_overrides.newtab`，指向新的 `newtab.html`。
- `newtab.html` 对应一个独立的 React 页面，例如 `src/ui/newtab/App.tsx`。
- 新标签页页面只承担“轻量入口壳”职责，不复用 `manager.html` 的完整状态结构。
- `manager.html` 继续作为完整管理页，由显式动作进入。

### 4.2 信息架构

`newtab.html` 推荐保留 4 个区域：

- 顶部轻头部
  - 品牌标题 `TabVault`
  - `Open Manager`
  - `Settings`
- 主操作区
  - 高优先级快捷动作，例如 `Capture Current Window`、`Capture Current Tab`
- 最近内容区
  - 展示少量最近分组或固定分组摘要
- 空状态区
  - 当没有可展示内容时，显示简短 onboarding，而不是完整 manager 空壳

设计原则：

- 新标签页既要支持用户“回到 TabVault 工作流”，也不能妨碍“继续浏览”的心智。
- 页面只承载下一步动作，不承载完整会话管理与重编辑能力。

### 4.3 行为联动

- `Capture Current Window`、`Capture Current Tab` 等高频动作继续发送现有 runtime message。
- `Open Manager` 继续复用已有 `open/manager` 链路。
- `Settings` 继续复用已有 `open/options` 链路。
- 如果展示最近分组摘要，点击行为应进入完整 manager 并定位到相关分组，而不是在 new tab 壳内重建 manager 的编辑能力。

### 4.4 数据读取策略

- `newtab.html` 只读取展示所需的最小数据集，例如：
  - 是否存在会话组
  - 少量最近分组摘要
  - 少量固定分组摘要
- 不直接搬运 `manager.html` 的全量运行时状态。
- 摘要转换逻辑应尽量保持纯函数，便于单元测试。

### 4.5 设置策略

- 不新增 `enableNewTabOverride` 或等价的启停开关。
- 若后续需要新增 `newtab` 页面内部展示偏好，可单独增加真正可运行时生效的设置项，例如：
  - 是否展示最近分组
  - 是否优先展示固定分组
  - 是否显示快捷收纳按钮
- 本次设计不要求引入这些展示偏好字段，避免需求扩散。

### 4.6 文档语义调整

产品文档需要补充如下结论：

- `Popup` 仍然是工具栏快捷入口。
- `Manager` 仍然是完整管理页。
- `newtab` 成为浏览器级默认入口壳，但不替代 popup 与 manager 的职责。

## 5. 风险与边界控制

### 5.1 不劫持普通网页导航

- 只通过 `chrome_url_overrides.newtab` 接管浏览器新标签页。
- 不通过事件监听去拦截普通 URL 打开、恢复标签、帮助页打开等流程。

### 5.2 保持入口轻量

- new tab 页面的目标是快速呈现与快速行动。
- 复杂管理动作仍应留在 manager 中处理。
- 若摘要信息过多，应优先裁剪摘要，而不是把 manager 逻辑整体搬入 new tab。

### 5.3 平台限制显式化

实现与文档中都需要明确说明：

- override 属于 Manifest 静态声明，不提供运行时关闭开关。
- incognito 场景下不生效。
- 地址栏焦点由浏览器控制，扩展页面不应试图模拟完整默认新标签页输入行为。

### 5.4 主路径回归保护

必须确保以下现有行为不受影响：

- 收纳当前窗口、当前标签、选中标签
- 打开 manager
- 打开 settings
- 打开帮助页
- 恢复单标签与整组标签

## 6. 影响范围

### 6.1 `public/manifest.json`

- 新增 `chrome_url_overrides.newtab`。
- 需要同步确认现有页面入口与构建产物路径。

### 6.2 新增 `src/ui/newtab/*`

- 新增 `newtab` 页面入口与轻量 UI。
- 尽量复用共享壳和按钮风格，但不复制 manager 的完整交互。

### 6.3 `src/background/service-worker.ts`

- 不需要改变核心 capture / restore 逻辑。
- 如有必要，只补充 new tab 页面复用的显式打开入口，不重写主链路。

### 6.4 `docs/onetab-like-extension-prd.md`

- 更新产品入口说明，纳入 new tab 默认入口壳角色。

### 6.5 `docs/architecture/runtime-flows.md`

- 新增或更新新标签页入口相关运行时流。

### 6.6 `docs/architecture/permissions-and-security.md`

- 补充 new tab override 的用途、限制与用户预期说明。

### 6.7 `tests/e2e/extension-shell.spec.ts`

- 增加浏览器新标签页加载 TabVault newtab 页面及基础动作联通性验证。

### 6.8 ADR

- 本次属于入口与 Manifest 行为边界变化，实施前应补一份 ADR，记录：
  - 为什么选择静态 override
  - 为什么不提供运行时开关
  - 为什么新增壳页而不是直接复用 manager

## 7. 验收标准

- 安装扩展后，新建标签页和新窗口首个页进入 TabVault `newtab` 页面。
- `newtab` 页面在不进入 manager 的情况下，至少能完成 1 个高频动作。
- `Open Manager`、`Settings`、收纳动作都复用现有主链路，不新增重复业务实现。
- 普通网页导航、恢复标签、打开帮助页不受影响。
- 文档、Manifest 和 E2E 同步更新，并明确该能力是静态 override，不提供运行时关闭开关。

## 8. 测试策略

### 8.1 单元测试

- 如果新增最近分组摘要选择逻辑，应验证：
  - 空数据时返回空状态
  - 有数据时只截取约定数量的摘要
  - 固定分组与最近分组的优先级符合设计

### 8.2 集成测试

- 验证 new tab 页面触发的 runtime message 继续走现有 background 链路。
- 验证设置、manager 打开入口仍与当前实现一致。
- 若引入 new tab 专用摘要查询逻辑，应验证其不依赖 manager 的重状态结构。

### 8.3 端到端测试

- 扩展加载后打开浏览器新标签页，应看到 TabVault `newtab` 核心 UI。
- 从 `newtab` 点击 `Open Manager`，应进入完整 manager。
- 从 `newtab` 触发高频收纳动作，应走通既有 capture 主链路。
- 无历史数据时，应看到清晰空状态，不得白屏或回退为重型 manager 空壳。
