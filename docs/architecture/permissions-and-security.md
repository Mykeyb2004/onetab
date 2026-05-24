# Permissions And Security

- Scope: TabVault MVP 的权限边界、数据落盘边界与风险控制
- Last updated: 2026-04-19
- Related files:
  - `public/manifest.json`
  - `src/features/settings/persistence-directory.ts`
  - `src/storage/root-state/config.ts`
  - `src/storage/file-system/directory-handle-store.ts`

## 1. MVP 权限

### `tabs`

用途：

- 读取当前窗口、活动标签、选中标签
- 关闭已收纳标签
- 恢复单个标签

风险：

- 可读取标签标题和 URL

控制：

- 只用于用户主动触发的收纳与恢复动作
- 不读取页面正文、cookie、表单数据

### `storage`

用途：

- 保存会话组、设置和当前存储后端配置

风险：

- 本地会话数据长期保留

控制：

- 默认保存在 `chrome.storage.local`
- 若用户主动选择目录，`chrome.storage.local` 仅保留存储配置和同步信号
- 不上传服务端

### `chrome_url_overrides.newtab`

用途：

- 将 `manager.html` 作为浏览器默认新标签页入口

限制：

- 由 Manifest 静态声明控制，不能通过运行时设置关闭
- 在 incognito 中不生效
- 不应用于普通网页导航劫持

### File System Access API

用途：

- 让用户在设置页选择持久化目录
- 将 root state 写入用户指定目录下的 `tabvault-data.json`

风险：

- 用户选择的目录中会存在可读的本地 JSON 数据文件
- 目录访问依赖用户授权，授权失效后功能会中断

控制：

- 仅在用户主动选择目录时启用
- 不新增 Manifest 权限
- 目录句柄只保存在扩展同源 IndexedDB 中
- 设置页允许用户切回浏览器本地存储

### `contextMenus`

用途：

- 在扩展 action 上提供右键入口

风险：

- 极低

控制：

- 可通过设置页关闭

### `notifications`

用途：

- 在 `showCaptureFeedback` 开启时展示收纳结果反馈

风险：

- 会产生用户可见通知

控制：

- 仅用于用户主动触发的收纳动作反馈
- 可通过设置页关闭

## 2. 延后权限

MVP 不引入：

- `downloads`
  - 若浏览器下载能力可通过 URL / blob 方式满足，可继续延后
- `bookmarks`
- `history`
- `tabGroups`
- `sessions`
- `sidePanel`

## 3. 不支持收纳的页面

MVP 默认跳过：

- `chrome://*`
- `chrome-extension://*`
- `about:*`
- 无法解析的 URL
- 空 URL

设计原则：

- 跳过并提示，不做隐式失败

## 4. 隐私边界

TabVault MVP 的隐私边界如下：

- 保存的信息只有标签元数据：
  - 标题
  - URL
  - favicon URL
  - 创建与恢复时间
- 当启用目录持久化时，这些元数据会写入用户选定目录中的 JSON 文件
- 不保存页面正文
- 不分析页面内容
- 不上传远程服务器
- 不支持无痕窗口标签收纳

## 5. 导入导出安全

### JSON 导入

- 必须检查 schema version
- 必须做结构校验
- 不允许执行文件中的脚本或动态字段

### Text 导入

- 只按纯文本逐行处理
- 非法 URL 直接跳过

### 导出

- 文件名建议带时间戳
- JSON 保持结构可读
- 文本导出不携带额外元数据

## 6. 恢复安全

### 整组恢复

- 默认新建窗口恢复，避免污染当前工作上下文
- 需要限流打开，避免瞬时过多标签造成浏览器假死

### 单标签恢复

- 打开成功后再从原组移除

## 7. 风险与缓解

### 数据丢失风险

缓解：

- 先写入、后关闭
- 提供导入导出
- 关键路径补集成与 E2E

### 浏览器卡顿风险

缓解：

- 大批量恢复做分批打开
- 搜索不做全量重计算和多余写入

### 权限误解风险

缓解：

- 在设置页和 README 中写清权限用途
- 不申请与当前能力无关权限
