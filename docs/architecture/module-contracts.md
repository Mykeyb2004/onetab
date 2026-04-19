# Module Contracts

## 1. 目录与所有权

- `src/background`
  - 负责事件入口和副作用调度
- `src/domain`
  - 负责纯业务规则
- `src/features`
  - 负责业务用例
- `src/adapters`
  - 负责 Chrome API 和外部能力封装
- `src/storage`
  - 负责持久化与迁移
- `src/ui`
  - 负责界面渲染

## 2. Feature Contracts

以下为 MVP 预期的用例接口，不要求一字不差，但职责边界应保持一致。

### 2.1 Capture

```ts
captureCurrentWindow(): Promise<CaptureResult>
captureCurrentTab(): Promise<CaptureResult>
captureSelectedTabs(): Promise<CaptureResult>
```

`CaptureResult` 至少应包含：

- `createdGroupId`
- `capturedCount`
- `skippedCount`
- `skippedReasons`
- `closedCount`

### 2.2 Restore

```ts
restoreSessionGroup(sessionId: string): Promise<RestoreGroupResult>
restoreSavedTab(sessionId: string, tabId: string): Promise<RestoreTabResult>
```

`RestoreGroupResult` 至少应包含：

- `sessionId`
- `restoredCount`
- `windowId`
- `removedGroup`

`RestoreTabResult` 至少应包含：

- `sessionId`
- `tabId`
- `restored`
- `remainingTabCount`
- `removedGroup`

### 2.3 Session Management

```ts
listSessions(): Promise<SessionGroup[]>
renameSessionGroup(sessionId: string, title: string): Promise<SessionGroup>
pinSessionGroup(sessionId: string, pinned: boolean): Promise<SessionGroup>
deleteSessionGroup(sessionId: string): Promise<void>
deleteSavedTab(sessionId: string, tabId: string): Promise<SessionGroup | null>
```

### 2.4 Search

```ts
searchSessions(query: string): Promise<SearchHit[]>
```

### 2.5 Import / Export

```ts
exportAllSessions(format: "json" | "text"): Promise<ExportArtifact>
exportSingleSession(sessionId: string, format: "json" | "text"): Promise<ExportArtifact>
importFromJson(file: string | ArrayBuffer): Promise<ImportResult>
importFromText(file: string): Promise<ImportResult>
```

### 2.6 Settings

```ts
loadSettings(): Promise<ExtensionSettings>
saveSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings>
```

## 3. Adapter Contracts

### 3.1 Tabs Adapter

```ts
listCurrentWindowTabs(): Promise<BrowserTab[]>
listSelectedTabs(): Promise<BrowserTab[]>
getActiveTab(): Promise<BrowserTab | null>
closeTabs(tabIds: number[]): Promise<void>
openTab(url: string): Promise<number>
openTabsInNewWindow(urls: string[]): Promise<number>
```

### 3.2 Storage Adapter

```ts
readRootState(): Promise<RootState>
writeRootState(state: RootState): Promise<void>
```

### 3.3 Navigation Adapter

```ts
openManagerPage(): Promise<void>
openOptionsPage(): Promise<void>
```

### 3.4 Downloads Adapter

```ts
downloadFile(fileName: string, content: BlobPart, mimeType: string): Promise<void>
pickFile(): Promise<File | null>
```

### 3.5 Notifications Adapter

```ts
showCaptureResult(message: string): Promise<void>
showError(message: string): Promise<void>
```

## 4. Runtime Message Contracts

当前和后续建议统一在一处声明 runtime message：

```ts
type RuntimeMessage =
  | { type: "capture/current-window" }
  | { type: "capture/current-tab" }
  | { type: "capture/selected-tabs" }
  | { type: "open/manager" }
  | { type: "open/options" };
```

后续扩展建议：

- `restore/group`
- `restore/tab`
- `export/all`
- `import/text`

原则：

- 只放需要跨上下文调用的动作
- Manager 纯本地可完成的行为优先直接走 feature，而不是绕 background

## 5. 错误模型

所有 feature 层结果都应优先返回结构化错误，而不是只抛字符串。

建议错误分类：

- `unsupported-url`
- `storage-read-failed`
- `storage-write-failed`
- `tabs-close-failed`
- `tabs-open-failed`
- `invalid-import-format`
- `unsupported-schema-version`
- `session-not-found`
- `tab-not-found`

## 6. 排序与展示契约

### 6.1 组排序

- 先按 `pinned` 排序
- 再按 `updatedAt` 倒序

### 6.2 组内标签排序

- 默认按 `originalIndex` 升序展示和恢复

## 7. 约束

1. UI 不得绕过 feature 直接写 storage。
2. Feature 不得直接写 DOM。
3. Background 不得复制 domain 规则。
4. Adapter 不得包含业务规则，只做转换和调用。
