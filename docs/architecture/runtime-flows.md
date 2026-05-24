# Runtime Flows

- Scope: TabVault MVP 的关键运行时流程、失败处理与设置更新路径
- Last updated: 2026-05-24
- Related files:
  - `src/background/service-worker.ts`
  - `src/domain/sessions/select-page-target-groups.ts`
  - `src/features/settings/persistence-directory.ts`
  - `src/storage/root-state/config.ts`
  - `src/storage/file-system/repository.ts`

## 1. Install / Startup

### Flow

1. `chrome.runtime.onInstalled` 触发
2. background 先引导 root state 存储配置
3. background 调用 `bootstrapRootState`
4. storage 层读取当前激活后端
5. 若不存在 root state，则写入默认 root state
6. 注册 context menus

### Failure Handling

- storage 初始化失败时记录错误，并停止后续副作用
- context menu 注册失败不应破坏已有持久化数据

## 1.1 New Tab Entry Shell

### Flow

1. 用户打开浏览器新标签页或新窗口首个页
2. Chrome 通过 `chrome_url_overrides.newtab` 加载 `newtab.html`
3. new tab 页面读取最小会话摘要
4. 用户可直接恢复最近分组，或跳转到 manager / settings

### Failure Handling

- 如果本地状态读取失败，new tab 页面显示降级提示，不影响后续打开 manager
- new tab 页面只做轻量状态读取，不承担完整 manager 的重交互恢复

## 2. Capture Current Window

### Flow

1. Popup / command / context menu 触发 `capture/current-window`
2. background 调用 capture use case
3. tabs adapter 获取当前窗口全部标签
4. domain 过滤 unsupported URLs
5. domain 生成 `SessionGroup`
6. storage 先写入 root state
7. tabs adapter 关闭已收纳标签
8. background 返回结果并决定是否展示反馈

### Critical Rule

- 必须先保存，后关闭

### Failure Handling

- 某些标签不支持收纳时计入 `skippedCount`
- 写入失败时绝不能关闭标签
- 关闭部分标签失败时返回部分成功结果，并保留已写入会话

## 3. Capture Current Tab

### Flow

1. 获取当前活动标签
2. 判断 URL 是否支持
3. 构造单标签会话组
4. 写入 root state
5. 关闭该标签

### Failure Handling

- 若当前标签不支持收纳，则直接反馈，不创建空组

## 4. Capture Selected Tabs

### Flow

1. tabs adapter 获取用户选中标签
2. 过滤 unsupported URLs
3. 生成会话组
4. 写入 root state
5. 只关闭被成功收纳的选中标签
6. 未选中标签保持打开

## 4.1 Send Page To Existing Group

### Flow

1. Background 注册页面右键菜单
2. 固定分组来自 `pinned === true` 的 active sessions，不受最近分组数量限制
3. 最近分组来自非固定 active sessions，并按配置数量限制
4. 用户在页面右键菜单中选择固定分组或最近分组
5. feature 将当前页面追加到目标组，随后尝试关闭原标签

### Data Rule

- 固定分组复用 `SessionGroup.pinned` 字段；读取旧数据时缺失字段迁移为 `false`，不清空已有保存数据

## 5. Restore Session Group

### Flow

1. Manager 页面点击“恢复全部”
2. feature 从 storage 读取目标组
3. 按 `originalIndex` 升序得到 URL 列表
4. windows / tabs adapter 新建窗口并分批打开标签
5. 更新组内 `lastOpenedAt`
6. 若 `restoreBehavior === "remove-group"`，移除该组
7. 若为 `keep-group`，仅更新 `updatedAt`

### Failure Handling

- 会话组不存在时返回 `session-not-found`
- 打开部分标签失败时返回部分成功信息
- 若恢复阶段失败，不得无条件删除整组

## 6. Restore Single Tab

### Flow

1. Manager 点击单个标签恢复
2. feature 读取目标组与目标 tab
3. tabs adapter 在新标签页打开 URL
4. 从原组移除该标签
5. 若原组已空，则删除该组
6. 否则更新 `tabCount` 与 `updatedAt`

### Failure Handling

- 打开失败时不得移除原 tab 记录

## 7. Search

### Flow

1. Manager 输入查询词
2. feature 读取当前 sessions
3. 运行时构造搜索候选
4. 依次匹配组名、标签标题、URL
5. 返回结构化 `SearchHit[]`

### Notes

- MVP 不需要异步索引构建
- 查询词为空时直接返回空结果或完整列表视图

## 8. Import JSON

### Flow

1. 用户选择 JSON 文件
2. adapter 读取文件内容
3. feature 解析 payload
4. 校验 `schemaVersion`
5. 校验 sessions 结构
6. 合法则合并或追加到 root state
7. 返回导入结果

### Failure Handling

- schema 不兼容时整体拒绝
- 结构损坏时整体拒绝

## 9. Import Text

### Flow

1. 用户选择文本文件或粘贴文本
2. 按行拆分
3. 去掉空行
4. 逐行校验 URL
5. 合法 URL 生成单一新会话组
6. 非法行跳过并累计数量
7. 写入 root state

## 10. Export

### Export All

1. 用户点击导出全部
2. feature 读取全部 sessions
3. 组装 JSON 或纯文本内容
4. downloads adapter 触发下载

### Export Single Session

1. 用户在组操作菜单中点击导出本组
2. feature 只读取目标组
3. 导出内容中不应携带无关会话组

## 11. Settings Update

### Flow

1. Options 页面加载设置
2. 用户修改单项设置
3. feature 合并 patch 并写回 root state
4. 若影响 background 行为，例如 context menu，可额外触发重新注册

### Notes

- Options 页面永远只写 patch，不重写整个 root state 的其他部分

## 12. Persistence Directory Switch

### Flow

1. 用户在 Options 页面点击选择目录
2. 页面通过目录选择器获得 `FileSystemDirectoryHandle`
3. storage 层检查所选目录中是否已有 `tabvault-data.json`
4. 若已有文件，则直接切换并以该文件作为新的 root state 来源
5. 若目录为空，则读取当前激活后端中的 root state，并用它初始化 `tabvault-data.json`
6. 目录句柄写入 IndexedDB
7. root state 存储配置写入 `chrome.storage.local`
8. 清理 `chrome.storage.local` 中旧的 root state
9. 通过同步 revision 通知 Manager、background 等上下文刷新

### Failure Handling

- 如果目录权限未授予，不切换后端
- 如果当前 root state 无法读取，不允许静默迁移为新目录，避免状态分叉
- 切回浏览器本地存储时，保留原目录中的文件副本，不做隐式删除
