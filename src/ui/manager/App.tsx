import { useEffect, useMemo, useRef, useState } from "react";
import { downloadArtifact, readFileAsText } from "../../adapters/browser/file-transfer";
import { emptyTrash } from "../../features/sessions/empty-trash";
import { deleteSavedTab } from "../../features/sessions/delete-saved-tab";
import { deleteSessionGroup } from "../../features/sessions/delete-session-group";
import { deleteSessionGroupPermanently } from "../../features/sessions/delete-session-group-permanently";
import {
  exportAllSessions,
  exportSingleSession
} from "../../features/sessions/export-sessions";
import {
  importJsonContent,
  importTextContent
} from "../../features/sessions/import-sessions";
import { listSessionGroups } from "../../features/sessions/list-session-groups";
import { openSavedTab } from "../../features/sessions/open-saved-tab";
import { renameSessionGroup } from "../../features/sessions/rename-session-group";
import { restoreSavedTab } from "../../features/sessions/restore/restore-saved-tab";
import { restoreSessionGroup } from "../../features/sessions/restore/restore-session-group";
import { restoreSessionGroupFromTrash } from "../../features/sessions/restore-session-group-from-trash";
import { searchSessions } from "../../features/sessions/search-sessions";
import { togglePinSessionGroup } from "../../features/sessions/toggle-pin-session-group";
import { isSessionGroupTrashed } from "../../domain/sessions/session-groups";
import { ROOT_STORAGE_KEY } from "../../storage/local/schema";
import type { SearchHit } from "../../types/search";
import type { SessionGroup } from "../../types/session";
import { AppShell } from "../shared/AppShell";

type SessionBucket = "active" | "trash";

interface SessionCollections {
  activeSessions: SessionGroup[];
  trashedSessions: SessionGroup[];
}

function formatRelativeSessionTime(isoString: string): string {
  const targetDate = new Date(isoString);
  const diffMs = Date.now() - targetDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return "今天";
  }

  if (diffDays === 1) {
    return "1 天前";
  }

  if (diffDays < 30) {
    return `${diffDays} 天前`;
  }

  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths < 12) {
    return `${diffMonths} 个月前`;
  }

  return `${Math.floor(diffMonths / 12)} 年前`;
}

function formatAbsoluteSessionTime(isoString: string): string {
  return new Date(isoString).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function buildSelection(
  collections: SessionCollections,
  preferredBucket: SessionBucket,
  preferredSessionId: string | null
): { bucket: SessionBucket; sessionId: string | null } {
  const preferredSessions =
    preferredBucket === "trash" ? collections.trashedSessions : collections.activeSessions;

  if (preferredSessionId && preferredSessions.some((session) => session.id === preferredSessionId)) {
    return {
      bucket: preferredBucket,
      sessionId: preferredSessionId
    };
  }

  if (preferredSessions.length > 0) {
    return {
      bucket: preferredBucket,
      sessionId: preferredSessions[0].id
    };
  }

  const fallbackBucket: SessionBucket = preferredBucket === "trash" ? "active" : "trash";
  const fallbackSessions =
    fallbackBucket === "trash" ? collections.trashedSessions : collections.activeSessions;

  return {
    bucket: fallbackBucket,
    sessionId: fallbackSessions[0]?.id ?? null
  };
}

export function ManagerApp() {
  const [sessionCollections, setSessionCollections] = useState<SessionCollections>({
    activeSessions: [],
    trashedSessions: []
  });
  const [selectedBucket, setSelectedBucket] = useState<SessionBucket>("active");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("正在加载 TabVault 分组...");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showImportExportTools, setShowImportExportTools] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [isActiveExpanded, setIsActiveExpanded] = useState(true);
  const [isTrashExpanded, setIsTrashExpanded] = useState(true);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const allSessions = useMemo(
    () => [...sessionCollections.activeSessions, ...sessionCollections.trashedSessions],
    [sessionCollections]
  );

  const searchHits: SearchHit[] = useMemo(
    () => searchSessions(query, allSessions),
    [query, allSessions]
  );

  const selectedSessions =
    selectedBucket === "trash" ? sessionCollections.trashedSessions : sessionCollections.activeSessions;
  const selectedSession =
    selectedSessions.find((session) => session.id === selectedSessionId) ?? null;

  const activeTabCount = sessionCollections.activeSessions.reduce(
    (sum, session) => sum + session.tabCount,
    0
  );

  async function loadSessionCollections(
    preferredBucket: SessionBucket = selectedBucket,
    preferredSessionId: string | null = selectedSessionId
  ) {
    try {
      const nextCollections = await listSessionGroups();
      const nextSelection = buildSelection(nextCollections, preferredBucket, preferredSessionId);

      setSessionCollections(nextCollections);
      setSelectedBucket(nextSelection.bucket);
      setSelectedSessionId(nextSelection.sessionId);
      setError(null);
    } catch (nextError: unknown) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "无法从本地存储中读取 TabVault 分组。"
      );
    }
  }

  useEffect(() => {
    let alive = true;

    listSessionGroups()
      .then((collections) => {
        if (!alive) {
          return;
        }

        const nextSelection = buildSelection(collections, "active", null);

        setSessionCollections(collections);
        setSelectedBucket(nextSelection.bucket);
        setSelectedSessionId(nextSelection.sessionId);
        setStatus(
          `已加载 ${collections.activeSessions.length} 个分组，回收站中有 ${collections.trashedSessions.length} 个分组。`
        );
      })
      .catch((nextError: unknown) => {
        if (!alive) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "无法从本地存储中读取 TabVault 分组。"
        );
        setStatus("加载 Session Manager 失败。");
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) {
      if (areaName !== "local" || !changes[ROOT_STORAGE_KEY]) {
        return;
      }

      void loadSessionCollections(selectedBucket, selectedSessionId)
        .then(() => {
          setStatus("Session Manager 已同步最新分组内容。");
        })
        .catch((nextError: unknown) => {
          setStatus(
            nextError instanceof Error
              ? nextError.message
              : "Session Manager 自动同步最新分组内容时失败。"
          );
        });
    }

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [selectedBucket, selectedSessionId]);

  function selectBucket(bucket: SessionBucket) {
    const sessions = bucket === "trash" ? sessionCollections.trashedSessions : sessionCollections.activeSessions;
    setShowMoreActions(false);
    setSelectedBucket(bucket);
    setSelectedSessionId(sessions[0]?.id ?? null);
  }

  function selectSession(bucket: SessionBucket, sessionId: string) {
    setShowMoreActions(false);
    setSelectedBucket(bucket);
    setSelectedSessionId(sessionId);
  }

  function focusSearchHit(searchHit: SearchHit) {
    const matchedSession = allSessions.find((session) => session.id === searchHit.sessionId);

    if (!matchedSession) {
      return;
    }

    const bucket: SessionBucket = isSessionGroupTrashed(matchedSession) ? "trash" : "active";
    setShowMoreActions(false);
    setSelectedBucket(bucket);
    setSelectedSessionId(matchedSession.id);
    document.getElementById(`session-node-${matchedSession.id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  async function handleRestoreGroup(sessionId: string) {
    setBusyKey(`group:${sessionId}`);

    try {
      const result = await restoreSessionGroup(sessionId);
      setStatus(result.message);
      await loadSessionCollections("active", null);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "还原整个分组失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRestoreTab(sessionId: string, tabId: string) {
    setBusyKey(`tab:${tabId}`);

    try {
      const result = await restoreSavedTab(sessionId, tabId);
      setStatus(result.message);
      await loadSessionCollections(selectedBucket, sessionId);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "还原标签页失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleOpenTab(sessionId: string, tabId: string) {
    setBusyKey(`open:${tabId}`);

    try {
      const result = await openSavedTab(sessionId, tabId);
      setStatus(result.message);
      await loadSessionCollections(selectedBucket, sessionId);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "打开标签页失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRenameGroup(sessionId: string, currentTitle: string) {
    const nextTitle = window.prompt("重命名分组", currentTitle);

    if (nextTitle === null) {
      return;
    }

    setBusyKey(`rename:${sessionId}`);

    try {
      await renameSessionGroup(sessionId, nextTitle);
      setStatus("已重命名当前分组。");
      await loadSessionCollections(selectedBucket, sessionId);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "重命名分组失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleTogglePin(sessionId: string) {
    setBusyKey(`pin:${sessionId}`);

    try {
      const updatedSession = await togglePinSessionGroup(sessionId);
      setStatus(updatedSession.pinned ? "已固定当前分组。" : "已取消固定当前分组。");
      await loadSessionCollections(selectedBucket, sessionId);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "更新固定状态失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleMoveGroupToTrash(sessionId: string) {
    const shouldDelete = window.confirm("将当前分组移动到回收站？");

    if (!shouldDelete) {
      return;
    }

    setBusyKey(`trash:${sessionId}`);

    try {
      await deleteSessionGroup(sessionId);
      setStatus("已将当前分组移动到回收站。");
      await loadSessionCollections("active", null);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "移动到回收站失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRestoreGroupFromTrash(sessionId: string) {
    setBusyKey(`restore-trash:${sessionId}`);

    try {
      const restoredSession = await restoreSessionGroupFromTrash(sessionId);
      setStatus(`已从回收站恢复“${restoredSession.title}”。`);
      await loadSessionCollections("active", restoredSession.id);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "从回收站恢复失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteSessionPermanently(sessionId: string) {
    const shouldDelete = window.confirm("永久删除当前分组？此操作无法撤销。");

    if (!shouldDelete) {
      return;
    }

    setBusyKey(`permanent-delete:${sessionId}`);

    try {
      await deleteSessionGroupPermanently(sessionId);
      setStatus("已永久删除当前分组。");
      await loadSessionCollections("trash", null);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "永久删除失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleEmptyTrash() {
    const shouldEmpty = window.confirm("清空回收站？此操作无法撤销。");

    if (!shouldEmpty) {
      return;
    }

    setBusyKey("empty-trash");

    try {
      const removedCount = await emptyTrash();
      setStatus(`已清空回收站，共删除 ${removedCount} 个分组。`);
      await loadSessionCollections("active", null);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "清空回收站失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteTab(sessionId: string, tabId: string) {
    const shouldDelete = window.confirm("删除这个标签页？");

    if (!shouldDelete) {
      return;
    }

    setBusyKey(`delete-tab:${tabId}`);

    try {
      const updatedSession = await deleteSavedTab(sessionId, tabId);
      setStatus(
        updatedSession
          ? `已删除标签页，当前分组剩余 ${updatedSession.tabCount} 个标签页。`
          : "已删除最后一个标签页，空分组已被移除。"
      );
      await loadSessionCollections(selectedBucket, sessionId);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "删除标签页失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleExportAll(format: "json" | "text") {
    setBusyKey(`export-all:${format}`);

    try {
      const artifact = await exportAllSessions(format);
      downloadArtifact(artifact);
      setStatus(`已导出全部分组（${format.toUpperCase()}）。`);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "导出全部分组失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleExportSession(sessionId: string, format: "json" | "text") {
    setBusyKey(`export-session:${sessionId}:${format}`);

    try {
      const artifact = await exportSingleSession(sessionId, format);
      downloadArtifact(artifact);
      setStatus(`已导出当前分组（${format.toUpperCase()}）。`);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "导出当前分组失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusyKey("import");

    try {
      const content = await readFileAsText(file);
      const result = file.name.toLowerCase().endsWith(".json")
        ? await importJsonContent(content)
        : await importTextContent(content);

      setStatus(result.message);
      await loadSessionCollections("active", null);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "导入文件失败。");
    } finally {
      setBusyKey(null);
      event.target.value = "";
    }
  }

  function handleOpenImportPicker() {
    importInputRef.current?.click();
  }

  async function handleOpenOptions() {
    await chrome.runtime.openOptionsPage();
  }

  function handleOpenHelp() {
    window.open(chrome.runtime.getURL("help.html"), "_blank");
  }

  function handleShowPrivacyInfo() {
    setStatus("TabVault 当前是本地优先模式：标签元数据仅保存在本机，不上传服务端。");
  }

  async function handleBackupSync() {
    await handleExportAll("json");
    setStatus("已下载本地备份。云同步暂未实现，当前建议使用导入与导出完成备份。");
  }

  const detailAreaLabel = selectedBucket === "trash" ? "回收站" : "全部";

  return (
    <AppShell
      eyebrow="Manager"
      title="TabVault Manager"
      description=""
    >
      <div className="manager-topbar card">
        <div className="manager-brand">
          <img alt="TabVault" className="manager-brand__logo" src={chrome.runtime.getURL("icon.svg")} />
          <div className="manager-brand__copy">
            <strong className="manager-brand__title">TabVault</strong>
            <span className="muted">Session Manager</span>
          </div>
        </div>

        <div className="manager-search">
          <label className="visually-hidden" htmlFor="manager-search">
            搜索分组、标题或 URL
          </label>
          <input
            id="manager-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索分组、标题或 URL"
            type="search"
            value={query}
          />
        </div>

        <div className="manager-links">
          <button className="manager-link" onClick={handleShowPrivacyInfo} type="button">
            隐私优先
          </button>
          <button className="manager-link" onClick={() => void handleBackupSync()} type="button">
            备份与同步
          </button>
          <button className="manager-link" onClick={handleOpenHelp} type="button">
            帮助
          </button>
          <button
            className={`manager-link ${showImportExportTools ? "manager-link--active" : ""}`}
            onClick={() => setShowImportExportTools((current) => !current)}
            type="button"
          >
            导入与导出
          </button>
          <button className="manager-link" onClick={() => void handleOpenOptions()} type="button">
            选项
          </button>
        </div>
      </div>

      {showImportExportTools ? (
        <div className="card stack">
          <strong>导入与导出</strong>
          <div className="toolbar__actions">
            <button
              className="button button--secondary"
              disabled={busyKey !== null}
              onClick={() => void handleExportAll("json")}
              type="button"
            >
              {busyKey === "export-all:json" ? "导出中..." : "导出全部 JSON"}
            </button>
            <button
              className="button button--secondary"
              disabled={busyKey !== null}
              onClick={() => void handleExportAll("text")}
              type="button"
            >
              {busyKey === "export-all:text" ? "导出中..." : "导出全部文本"}
            </button>
            <button
              className="button button--quiet"
              disabled={busyKey !== null}
              onClick={handleOpenImportPicker}
              type="button"
            >
              {busyKey === "import" ? "导入中..." : "导入文件"}
            </button>
          </div>
          <input
            accept=".json,.txt,.text"
            className="visually-hidden"
            onChange={handleImportFile}
            ref={importInputRef}
            type="file"
          />
        </div>
      ) : null}

      <div className="manager-status card">
        <strong>状态</strong>
        <p className="muted">{error ?? status}</p>
      </div>

      <div className="manager-workbench">
        <aside className="manager-sidebar card">
          <div className="manager-sidebar__section">
            <button
              className={`manager-tree__section ${selectedBucket === "active" ? "manager-tree__section--active" : ""}`}
              onClick={() => selectBucket("active")}
              type="button"
            >
              <span className="manager-tree__section-title">
                <span>{isActiveExpanded ? "▾" : "▸"}</span>
                <span>全部</span>
              </span>
              <span className="manager-tree__count">{activeTabCount}</span>
            </button>

            <button
              className="manager-tree__toggle"
              onClick={() => setIsActiveExpanded((current) => !current)}
              type="button"
            >
              {isActiveExpanded ? "收起" : "展开"}
            </button>

            {isActiveExpanded ? (
              <ul className="manager-tree__children">
                {sessionCollections.activeSessions.map((session) => (
                  <li key={session.id}>
                    <button
                      className={`manager-tree__node ${selectedSessionId === session.id && selectedBucket === "active" ? "manager-tree__node--selected" : ""}`}
                      id={`session-node-${session.id}`}
                      onClick={() => selectSession("active", session.id)}
                      type="button"
                    >
                      <span className="manager-tree__node-title">
                        {session.pinned ? "📌 " : ""}
                        {session.title}
                      </span>
                      <span className="manager-tree__count">{session.tabCount}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="manager-sidebar__section">
            <button
              className={`manager-tree__section ${selectedBucket === "trash" ? "manager-tree__section--active" : ""}`}
              onClick={() => selectBucket("trash")}
              type="button"
            >
              <span className="manager-tree__section-title">
                <span>{isTrashExpanded ? "▾" : "▸"}</span>
                <span>回收站</span>
              </span>
              <span className="manager-tree__count">{sessionCollections.trashedSessions.length}</span>
            </button>

            <button
              className="manager-tree__toggle"
              onClick={() => setIsTrashExpanded((current) => !current)}
              type="button"
            >
              {isTrashExpanded ? "收起" : "展开"}
            </button>

            {isTrashExpanded ? (
              <ul className="manager-tree__children">
                {sessionCollections.trashedSessions.map((session) => (
                  <li key={session.id}>
                    <button
                      className={`manager-tree__node ${selectedSessionId === session.id && selectedBucket === "trash" ? "manager-tree__node--selected" : ""}`}
                      id={`session-node-${session.id}`}
                      onClick={() => selectSession("trash", session.id)}
                      type="button"
                    >
                      <span className="manager-tree__node-title">{session.title}</span>
                      <span className="manager-tree__count">{session.tabCount}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </aside>

        <section className="manager-main">
          {query.trim() ? (
            <div className="card stack">
              <strong>搜索结果</strong>
              {searchHits.length === 0 ? (
                <p className="muted">没有找到“{query}”的匹配项。</p>
              ) : (
                <ul className="list">
                  {searchHits.map((searchHit, index) => {
                    const matchedSession = allSessions.find((session) => session.id === searchHit.sessionId);
                    const matchedBucket = matchedSession && isSessionGroupTrashed(matchedSession) ? "回收站" : "全部";
                    const matchedTabId = searchHit.tabId;

                    return (
                      <li
                        className="list__item"
                        key={`${searchHit.sessionId}:${searchHit.tabId ?? "group"}:${searchHit.matchField}:${index}`}
                      >
                        <strong>{searchHit.label}</strong>
                        <p className="muted search-hit__meta">
                          {matchedBucket} · {searchHit.sessionTitle} · {searchHit.matchField}
                        </p>
                        <div className="inline-actions">
                          <button
                            className="button button--quiet button--small"
                            onClick={() => focusSearchHit(searchHit)}
                            type="button"
                          >
                            定位分组
                          </button>
                          {matchedTabId && matchedSession && !isSessionGroupTrashed(matchedSession) ? (
                            <>
                              <button
                                className="button button--secondary button--small"
                                disabled={busyKey !== null}
                                onClick={() => void handleOpenTab(searchHit.sessionId, matchedTabId)}
                                type="button"
                              >
                                {busyKey === `open:${matchedTabId}` ? "打开中..." : "打开匹配标签"}
                              </button>
                              <button
                                className="button button--quiet button--small"
                                disabled={busyKey !== null}
                                onClick={() => void handleRestoreTab(searchHit.sessionId, matchedTabId)}
                                type="button"
                              >
                                {busyKey === `tab:${matchedTabId}` ? "还原中..." : "还原并移除"}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {selectedSession ? (
            <div className="card manager-detail">
              <div className="manager-detail__meta-row">
                <span className="manager-detail__location">位置：{detailAreaLabel}</span>
                <span className="manager-detail__date">
                  {formatAbsoluteSessionTime(selectedBucket === "trash" ? selectedSession.trashedAt ?? selectedSession.updatedAt : selectedSession.updatedAt)}
                  {" · "}
                  {formatRelativeSessionTime(selectedBucket === "trash" ? selectedSession.trashedAt ?? selectedSession.updatedAt : selectedSession.updatedAt)}
                </span>
              </div>

              <div className="manager-detail__header">
                <div>
                  <h2 className="manager-detail__title">
                    {selectedSession.pinned ? "📌 " : ""}
                    {selectedSession.title}
                  </h2>
                  <p className="muted manager-detail__subline">
                    {selectedSession.tabCount} 个标签页 · 创建于 {formatAbsoluteSessionTime(selectedSession.createdAt)}
                  </p>
                </div>

                <div className="inline-actions">
                  {selectedBucket === "trash" ? (
                    <>
                      <button
                        className="button"
                        disabled={busyKey !== null}
                        onClick={() => void handleRestoreGroupFromTrash(selectedSession.id)}
                        type="button"
                      >
                        {busyKey === `restore-trash:${selectedSession.id}` ? "恢复中..." : "恢复分组"}
                      </button>
                      <button
                        className="button button--secondary"
                        disabled={busyKey !== null}
                        onClick={() => void handleDeleteSessionPermanently(selectedSession.id)}
                        type="button"
                      >
                        {busyKey === `permanent-delete:${selectedSession.id}` ? "删除中..." : "永久删除"}
                      </button>
                      <button
                        className="button button--quiet"
                        disabled={busyKey !== null}
                        onClick={() => void handleEmptyTrash()}
                        type="button"
                      >
                        {busyKey === "empty-trash" ? "清空中..." : "清空回收站"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="button"
                        disabled={busyKey !== null}
                        onClick={() => void handleRestoreGroup(selectedSession.id)}
                        type="button"
                      >
                        {busyKey === `group:${selectedSession.id}` ? "还原中..." : "全部还原"}
                      </button>
                      <button
                        className="button button--quiet"
                        onClick={() => setShowMoreActions((current) => !current)}
                        type="button"
                      >
                        {showMoreActions ? "收起操作" : "更多操作"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showMoreActions && selectedBucket === "active" ? (
                <div className="manager-more-actions">
                  <button
                    className="button button--secondary button--small"
                    disabled={busyKey !== null}
                    onClick={() => void handleRenameGroup(selectedSession.id, selectedSession.title)}
                    type="button"
                  >
                    {busyKey === `rename:${selectedSession.id}` ? "重命名中..." : "重命名"}
                  </button>
                  <button
                    className="button button--quiet button--small"
                    disabled={busyKey !== null}
                    onClick={() => void handleTogglePin(selectedSession.id)}
                    type="button"
                  >
                    {busyKey === `pin:${selectedSession.id}` ? "处理中..." : selectedSession.pinned ? "取消固定" : "固定分组"}
                  </button>
                  <button
                    className="button button--quiet button--small"
                    disabled={busyKey !== null}
                    onClick={() => void handleExportSession(selectedSession.id, "json")}
                    type="button"
                  >
                    {busyKey === `export-session:${selectedSession.id}:json` ? "导出中..." : "导出 JSON"}
                  </button>
                  <button
                    className="button button--quiet button--small"
                    disabled={busyKey !== null}
                    onClick={() => void handleExportSession(selectedSession.id, "text")}
                    type="button"
                  >
                    {busyKey === `export-session:${selectedSession.id}:text` ? "导出中..." : "导出文本"}
                  </button>
                  <button
                    className="button button--quiet button--small"
                    disabled={busyKey !== null}
                    onClick={() => void handleMoveGroupToTrash(selectedSession.id)}
                    type="button"
                  >
                    {busyKey === `trash:${selectedSession.id}` ? "移动中..." : "移到回收站"}
                  </button>
                </div>
              ) : null}

              <div className="manager-tabs">
                {selectedSession.tabs.map((savedTab) => (
                  <div className="manager-tab" key={savedTab.id}>
                    <div className="manager-tab__icon">
                      {savedTab.favIconUrl ? (
                        <img alt="" src={savedTab.favIconUrl} />
                      ) : (
                        <span>{savedTab.title.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="manager-tab__copy">
                      <button
                        className="manager-tab__title"
                        disabled={busyKey !== null || selectedBucket === "trash"}
                        onClick={() => void handleRestoreTab(selectedSession.id, savedTab.id)}
                        type="button"
                      >
                        {savedTab.title}
                      </button>
                      <span className="manager-tab__url muted">{savedTab.url}</span>
                    </div>

                    <div className="manager-tab__actions">
                      {selectedBucket === "trash" ? (
                        <span className="muted">回收站中的标签页仅随分组一起恢复</span>
                      ) : (
                        <>
                          <button
                            className="button button--secondary button--small"
                            disabled={busyKey !== null}
                            onClick={() => void handleOpenTab(selectedSession.id, savedTab.id)}
                            type="button"
                          >
                            {busyKey === `open:${savedTab.id}` ? "打开中..." : "打开"}
                          </button>
                          <button
                            className="button button--quiet button--small"
                            disabled={busyKey !== null}
                            onClick={() => void handleRestoreTab(selectedSession.id, savedTab.id)}
                            type="button"
                          >
                            {busyKey === `tab:${savedTab.id}` ? "还原中..." : "还原并移除"}
                          </button>
                          <button
                            className="button button--quiet button--small"
                            disabled={busyKey !== null}
                            onClick={() => void handleDeleteTab(selectedSession.id, savedTab.id)}
                            type="button"
                          >
                            {busyKey === `delete-tab:${savedTab.id}` ? "删除中..." : "删除"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card manager-empty-state">
              <strong>{selectedBucket === "trash" ? "回收站为空" : "还没有分组"}</strong>
              <p className="muted">
                {selectedBucket === "trash"
                  ? "当你把分组移到回收站后，会在这里看到它们。"
                  : "先从 Popup 或网页右键菜单把标签页发送到 TabVault，然后这里会出现分组树和详情面板。"}
              </p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
