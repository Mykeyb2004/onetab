# Runtime Flows

## 1. Install / Startup

### Flow

1. `chrome.runtime.onInstalled` 触发
2. background 调用 `bootstrapRootState`
3. storage 层读取 `chrome.storage.local`
4. 若不存在 root state，则写入默认 root state
5. 注册 context menus

### Failure Handling

- storage 初始化失败时记录错误，并停止后续副作用
- context menu 注册失败不应破坏已有持久化数据

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
