# ADR-002 Storage Model

- Status: Accepted
- Date: 2026-04-19

## Context

MVP 以本地优先为原则，需要在没有服务端的前提下保存会话、设置与后续迁移信息。

## Decision

- 首版使用 `chrome.storage.local`
- 所有持久化数据聚合在单一 root state 下
- root state 必须带 `schemaVersion`
- 迁移逻辑集中放在 `storage/local/schema.ts`

## Consequences

- 读取路径简单，便于测试
- 后续迁移到 IndexedDB 时可保留 domain 与 features 层接口
