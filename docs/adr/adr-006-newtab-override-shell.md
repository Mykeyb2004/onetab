# ADR-006 New Tab Override Shell

- Status: Accepted
- Date: 2026-05-24

## Context

TabVault 需要一个浏览器级默认入口，而用户明确希望新标签页直接保持 `TabVault Manager` 的完整界面，而不是额外的轻量壳页。

Chrome 支持通过 `chrome_url_overrides.newtab` 接管新标签页，但这是 Manifest 静态声明能力，而不是运行时设置项。因此，该能力不能建模成“默认关闭、用户手动开启”的运行时开关。

## Decision

- 通过 `chrome_url_overrides.newtab` 直接将浏览器新标签页指向 `manager.html`。
- 不再维护单独的 `newtab.html` / `src/ui/newtab/*` 壳页实现。
- 保持 `manager.html` 同时作为显式管理页和浏览器默认新标签页界面。
- 不提供 new tab override 的运行时启停开关。

## Consequences

- 安装扩展后，新标签页和新窗口首个标签页直接进入完整 `TabVault Manager`。
- 不再需要为 new tab 维护单独的摘要选择器、轻量状态加载器和壳页样式。
- 产品和架构文档需要明确记录该入口直接复用 manager，而不是单独的 new tab 壳。
- incognito 场景下不继承该 override 行为。
