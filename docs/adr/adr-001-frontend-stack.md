# ADR-001 Frontend Stack

- Status: Accepted
- Date: 2026-04-19

## Context

TabVault 需要一套适合 Manifest V3、可测试、能支撑多页面扩展界面的前端栈。

## Decision

采用以下栈：

- TypeScript strict
- React
- Vite
- Vitest
- Playwright

## Consequences

- Popup、Manager、Options 可共享同一套组件和构建链
- 单元测试与集成测试运行成本较低
- E2E 需要针对 Chrome 扩展场景做额外 harness
