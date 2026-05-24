# ADR-006 New Tab Override Shell

- Status: Accepted
- Date: 2026-05-24

## Context

TabVault 需要一个浏览器级默认入口，但 `manager.html` 是完整工作台，包含更重的状态加载与编辑交互，不适合作为新标签页的唯一形态。

Chrome 支持通过 `chrome_url_overrides.newtab` 接管新标签页，但这是 Manifest 静态声明能力，而不是运行时设置项。因此，“默认关闭、用户手动开启”的开关模型不适用于这项能力。

同时，`newtab` 页面自身是扩展页，不能作为“收纳当前标签页”这类动作的优先落点；更合理的默认动作是快速恢复最近分组并跳转到完整 manager。

## Decision

- 通过 `chrome_url_overrides.newtab` 注册独立的 `newtab.html` 入口壳。
- 保持 `manager.html` 作为完整的会话管理工作台。
- 不提供 new tab override 的运行时启停开关。
- `newtab` 以快速恢复、最近分组预览和 manager 深链为主要能力，不复刻 manager 的完整编辑交互。

## Consequences

- 安装扩展后，TabVault 会接管新标签页和新窗口首个标签页。
- 产品和架构文档需要明确记录静态 override 的边界和限制。
- incognito 场景下不继承该 override 行为。
- E2E 需要覆盖新标签页入口、快速恢复和 manager 深链场景。
