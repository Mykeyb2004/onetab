# System Design

- Scope: TabVault MVP 运行时分层、状态边界与持久化职责
- Last updated: 2026-04-19
- Related files:
  - `src/adapters/chrome/storage.ts`
  - `src/storage/local/repository.ts`
  - `src/storage/root-state/config.ts`
  - `src/storage/file-system/repository.ts`

## 1. 目标

本设计用于指导 TabVault MVP 的实现，覆盖以下目标：

- 支持收纳当前窗口、当前标签、选中标签
- 支持在新建窗口恢复整组标签
- 支持恢复单个标签并从原组移除
- 支持搜索组名、标签标题、URL
- 支持本地导入导出
- 默认使用 `chrome.storage.local`，并允许用户切换到自选目录

## 2. 运行时组件

### 2.1 Service Worker

职责：

- 处理 `chrome.runtime`、`chrome.commands`、`chrome.contextMenus` 事件
- 执行收纳与恢复的副作用用例
- 初始化本地状态
- 作为 Popup 与 Chrome API 之间的中转层

不负责：

- 持有长期内存状态
- 承载复杂 UI 逻辑
- 直接拼装界面数据结构

### 2.2 Popup

职责：

- 提供高频入口
- 展示操作结果与简要状态
- 把动作请求发送给 background

不负责：

- 直接调用 `chrome.tabs` 或 `chrome.storage`
- 承载会话全量管理逻辑

### 2.3 Manager

职责：

- 展示会话组列表
- 展示组内标签
- 执行恢复、重命名、删除、固定、搜索、单组导出

### 2.4 Options

职责：

- 编辑用户设置
- 展示隐私和能力边界

### 2.5 Storage Layer

职责：

- 持久化 root state
- 负责 schema migration
- 负责导入导出的结构兼容
- 负责选择当前激活的持久化后端
- 在目录后端下协调文件句柄、权限校验和同步信号

## 3. 分层设计

### 3.1 Domain 层

输入为普通数据对象，输出为普通数据对象，不依赖 Chrome API。

代表规则：

- URL 是否可收纳
- 会话组默认命名
- 会话组构造
- 恢复后组内数据变化
- 搜索匹配规则
- 导入内容校验规则

### 3.2 Features 层

负责把 domain、storage、adapter 串起来，形成用例。

代表用例：

- `captureCurrentWindow`
- `captureCurrentTab`
- `captureSelectedTabs`
- `restoreSessionGroup`
- `restoreSavedTab`
- `searchSessions`
- `exportAllSessions`
- `exportSingleSession`
- `importFromJson`
- `importFromText`

### 3.3 Adapters 层

隔离所有外部依赖。

MVP 需要的 adapter：

- tabs adapter
- windows adapter
- storage adapter
- runtime/page navigation adapter
- downloads adapter
- notifications adapter

### 3.4 UI 层

UI 只负责：

- 渲染状态
- 收集用户输入
- 调用 feature
- 展示成功 / 失败 / 跳过信息

## 4. 状态边界

### 4.1 持久化状态

root state 保存在当前激活后端：

- session groups
- settings
- schema version

始终保存在 `chrome.storage.local`：

- 当前 root state 存储后端配置
- 跨页面同步 revision

目录后端附加保存在 IndexedDB：

- 用户选择的目录句柄

### 4.2 瞬时状态

只存在于运行时：

- 当前页面的展开状态
- 搜索输入值
- 操作中的 loading 状态
- 当前反馈消息

### 4.3 派生状态

不单独持久化：

- 搜索结果
- 组内展示统计
- 今日已收纳数量

## 5. 设计原则

### 5.1 原子性优先

收纳操作必须先完成会话持久化，再关闭原标签，避免数据丢失。

### 5.2 可恢复性优先

所有会影响数据删除的操作，都必须能明确推导结果。

### 5.3 服务 worker 无状态假设

不能依赖 background 持有内存缓存。每次处理主路径时都要假设 worker 可能被销毁后重新唤起。

### 5.4 低权限原则

MVP 只申请当前功能必须权限，不提前为未来功能申请。

## 6. 性能策略

### 6.1 收纳

- 先过滤 unsupported URLs
- 只存储必须字段
- 关闭标签时批量执行，失败按标签粒度容错

### 6.2 恢复

- 整组恢复默认新建窗口
- 大量标签采用分批创建，避免瞬时卡顿

### 6.3 搜索

- MVP 搜索以 in-memory 过滤为主
- 不单独维护持久化全文索引
- 若数据规模明显增长，再评估增量索引

## 7. 未来扩展点

- 切换 root state 主数据到 IndexedDB
- 云同步
- 分享只读页面
- Side Panel
- 规则引擎自动收纳

这些能力都不应破坏当前的 domain / feature / adapter 边界。
