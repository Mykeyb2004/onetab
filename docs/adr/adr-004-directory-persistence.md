# ADR-004 Directory Persistence

- Status: Accepted
- Date: 2026-04-19
- Scope: 为 TabVault 增加用户可选的数据目录，并保持现有本地优先能力
- Related files:
  - `src/adapters/chrome/storage.ts`
  - `src/storage/root-state/config.ts`
  - `src/storage/file-system/repository.ts`
  - `src/features/settings/persistence-directory.ts`

## Context

现有 MVP 把 root state 统一保存在 `chrome.storage.local`。这满足了本地优先，但用户无法控制持久化数据实际保存的位置，也不方便把数据交给外部备份工具直接管理。

Chrome 扩展的 `chrome.storage.local` 不能存储目录句柄，因此如果要把主数据写入用户选择的目录，必须把目录授权与 root state 数据分开管理。

## Decision

- 默认后端仍然是 `chrome.storage.local`
- 在设置页允许用户通过目录选择器指定一个持久化目录
- 选定目录后，用户目录中的 `tabvault-data.json` 成为 root state 的唯一读写位置
- 若目标目录已存在 `tabvault-data.json`，则直接以该文件为准
- 若目标目录尚无 `tabvault-data.json`，则用当前 root state 初始化该文件
- 目录句柄保存在扩展同源的 IndexedDB 中
- `chrome.storage.local` 只保留：
  - 当前 root state 存储后端配置
  - 同步 revision 信号
- 切换到目录后，会移除 `chrome.storage.local` 中旧的 root state 记录，避免保留第二份活动数据
- 所有 feature 继续通过统一的根状态存储 adapter 访问数据，不直接感知后端差异

## Consequences

- 用户可以把持久化数据落到自己选定的目录，仍然保持离线可用
- 目录后端需要依赖 File System Access API 和用户授权
- 如果目录授权失效，后台与页面会报出明确错误，并要求在设置页重新选择目录或切回浏览器本地存储
- `chrome.storage.onChanged` 不再只监听 root state 本身，而要监听存储配置 revision，才能兼容目录后端的跨页面同步
