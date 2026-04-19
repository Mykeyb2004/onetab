# Data Model

## 1. Root State

MVP 持久化数据统一收敛到单一 root state：

```ts
interface RootState {
  schemaVersion: number;
  sessions: SessionGroup[];
  settings: ExtensionSettings;
}
```

设计理由：

- 读取路径简单
- migration 单入口
- 导入导出容易建立版本约束

## 2. SessionGroup

```ts
interface SessionGroup {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tabCount: number;
  pinned: boolean;
  sourceWindowId: number | null;
  tabs: SavedTab[];
}
```

字段约束：

- `id`
  - root state 内唯一
- `title`
  - 默认格式为 `保存于 YYYY-MM-DD HH:mm`
- `createdAt`
  - 组首次创建时间
- `updatedAt`
  - 组最近变更时间
- `tabCount`
  - 必须等于 `tabs.length`
- `pinned`
  - `true` 时排序优先于普通组
- `sourceWindowId`
  - 仅作为来源记录，不作为恢复目标

## 3. SavedTab

```ts
interface SavedTab {
  id: string;
  title: string;
  url: string;
  favIconUrl: string | null;
  createdAt: string;
  lastOpenedAt: string | null;
  originalIndex: number;
}
```

字段约束：

- `title`
  - 若原标签标题为空，则回退为 URL
- `url`
  - 必须是允许收纳的 URL
- `lastOpenedAt`
  - 初始为 `null`
  - 单标签或整组恢复后更新
- `originalIndex`
  - 用于整组恢复时保持顺序

## 4. ExtensionSettings

```ts
interface ExtensionSettings {
  restoreBehavior: "remove-group" | "keep-group";
  defaultClickAction: "capture-current-window" | "open-manager";
  showCaptureFeedback: boolean;
  enableContextMenu: boolean;
}
```

默认值：

- `restoreBehavior`: `remove-group`
- `defaultClickAction`: `capture-current-window`
- `showCaptureFeedback`: `true`
- `enableContextMenu`: `true`

## 5. 导入导出模型

### 5.1 JSON 导出结构

```ts
interface ExportPayloadV1 {
  schemaVersion: number;
  exportedAt: string;
  sessions: SessionGroup[];
  settings?: ExtensionSettings;
}
```

规则：

- 导出全部时带全部会话组
- 导出单组时 `sessions` 长度为 1
- MVP 允许携带 `settings`，但导入时可选择只导入会话组

### 5.2 纯文本导入格式

每行一个 URL：

```text
https://example.com/a
https://example.com/b
```

规则：

- 空行忽略
- 非法 URL 跳过继续
- 最终生成一个新会话组

## 6. 搜索视图模型

MVP 搜索结果不单独落盘，使用运行时派生结构：

```ts
interface SearchHit {
  sessionId: string;
  tabId: string | null;
  matchField: "group-title" | "tab-title" | "url";
  label: string;
}
```

规则：

- 若匹配组名，可跳转到对应组
- 若匹配标签标题或 URL，可直接恢复该标签或定位其所属组

## 7. 不变式

实现中必须保持以下不变式：

1. `tabCount === tabs.length`
2. `sessions` 中 `id` 唯一
3. 同一组内 `SavedTab.id` 唯一
4. 所有时间字段使用 ISO 8601 字符串
5. pinned 组始终排在普通组之前
6. 恢复单个标签后，该标签从原组移除
7. 恢复整组后，是否移除组由设置决定

## 8. Migration 规则

### 8.1 入口

- 所有读取 root state 的代码都必须先经过 migration

### 8.2 策略

- 未知结构回退到默认 root state
- 可识别的旧字段尽量向前兼容
- 导入 JSON 若 `schemaVersion` 不支持，应拒绝导入而不是猜测修复

### 8.3 版本策略

- root state 版本与导出 payload 版本保持一致的 schema 语义
- 每次结构性变更都必须新增 migration 测试
