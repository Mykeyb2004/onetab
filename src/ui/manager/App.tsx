import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadArtifact, readFileAsText } from "../../adapters/browser/file-transfer";
import { emptyTrash } from "../../features/sessions/empty-trash";
import { createEmptySessionGroup } from "../../features/sessions/create-empty-session-group";
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
import { repositionSavedTab } from "../../features/sessions/reposition-saved-tab";
import { renameSessionGroup } from "../../features/sessions/rename-session-group";
import { reorderSessionGroups } from "../../features/sessions/reorder-session-groups";
import { restoreSavedTab } from "../../features/sessions/restore/restore-saved-tab";
import { restoreSessionGroup } from "../../features/sessions/restore/restore-session-group";
import { restoreSessionGroupFromTrash } from "../../features/sessions/restore-session-group-from-trash";
import { searchSessions } from "../../features/sessions/search-sessions";
import { togglePinSessionGroup } from "../../features/sessions/toggle-pin-session-group";
import { loadExtensionSettings } from "../../features/settings/load-settings";
import { saveSettings } from "../../features/settings/save-settings";
import { isSessionGroupTrashed } from "../../domain/sessions/session-groups";
import { ROOT_STATE_STORAGE_CONFIG_KEY } from "../../storage/root-state/config";
import type { SearchHit } from "../../types/search";
import type { ManagerGridDensityPreference } from "../../types/settings";
import type { SessionGroup } from "../../types/session";
import { AppShell } from "../shared/AppShell";
import { ManagerTabGrid } from "./ManagerTabGrid";
import { resolveManagerGridDensity } from "./grid-density";

type SessionBucket = "active" | "trash";
const SESSION_DRAG_TYPE = "application/x-tabvault-session";
const TAB_DRAG_TYPE = "application/x-tabvault-tab";

interface SessionCollections {
  activeSessions: SessionGroup[];
  trashedSessions: SessionGroup[];
}

interface DraggedTabPayload {
  sourceSessionId: string;
  tabId: string;
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

function parseDraggedTabPayload(rawPayload: string): DraggedTabPayload | null {
  if (!rawPayload) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(rawPayload);

    if (typeof payload !== "object" || payload === null) {
      return null;
    }

    const candidate = payload as Record<string, unknown>;

    if (typeof candidate.sourceSessionId !== "string" || typeof candidate.tabId !== "string") {
      return null;
    }

    return {
      sourceSessionId: candidate.sourceSessionId,
      tabId: candidate.tabId
    };
  } catch {
    return null;
  }
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
  const [densityPreference, setDensityPreference] =
    useState<ManagerGridDensityPreference>("enhanced");
  const [managerMainWidth, setManagerMainWidth] = useState(0);
  const [showImportExportTools, setShowImportExportTools] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [isActiveExpanded, setIsActiveExpanded] = useState(true);
  const [isTrashExpanded, setIsTrashExpanded] = useState(true);
  const [hoveredActiveSessionMenuId, setHoveredActiveSessionMenuId] = useState<string | null>(
    null
  );
  const [hoveredTrashSessionMenuId, setHoveredTrashSessionMenuId] = useState<string | null>(null);
  const [dragOverSessionId, setDragOverSessionId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [isTabDropAtEnd, setIsTabDropAtEnd] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const managerMainRef = useRef<HTMLElement | null>(null);

  const allSessions = useMemo(
    () => [...sessionCollections.activeSessions, ...sessionCollections.trashedSessions],
    [sessionCollections]
  );

  const searchHits: SearchHit[] = useMemo(
    () => searchSessions(query, allSessions),
    [query, allSessions]
  );
  const densityState = useMemo(
    () =>
      resolveManagerGridDensity({
        preference: densityPreference,
        containerWidth: managerMainWidth
      }),
    [densityPreference, managerMainWidth]
  );

  const selectedSessions =
    selectedBucket === "trash" ? sessionCollections.trashedSessions : sessionCollections.activeSessions;
  const selectedSession =
    selectedSessions.find((session) => session.id === selectedSessionId) ?? null;

  const activeTabCount = sessionCollections.activeSessions.reduce(
    (sum, session) => sum + session.tabCount,
    0
  );

  const liveStatusMessage = error ?? status;

  const loadSessionCollections = useCallback(async (
    preferredBucket: SessionBucket = selectedBucket,
    preferredSessionId: string | null = selectedSessionId
  ) => {
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
  }, [selectedBucket, selectedSessionId]);

  useEffect(() => {
    let alive = true;

    Promise.all([listSessionGroups(), loadExtensionSettings()])
      .then(([collections, settings]) => {
        if (!alive) {
          return;
        }

        const nextSelection = buildSelection(collections, "active", null);

        setSessionCollections(collections);
        setSelectedBucket(nextSelection.bucket);
        setSelectedSessionId(nextSelection.sessionId);
        setDensityPreference(settings.managerGridDensityPreference);
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
      if (areaName !== "local" || !changes[ROOT_STATE_STORAGE_CONFIG_KEY]) {
        return;
      }

      void loadSessionCollections(selectedBucket, selectedSessionId)
        .then(async () => {
          const settings = await loadExtensionSettings();
          setDensityPreference(settings.managerGridDensityPreference);
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
  }, [loadSessionCollections, selectedBucket, selectedSessionId]);

  useEffect(() => {
    const element = managerMainRef.current;

    if (!element) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      setManagerMainWidth(element.getBoundingClientRect().width);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      setManagerMainWidth(entry.contentRect.width);
    });

    observer.observe(element);
    setManagerMainWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  function closeSessionMenus() {
    setHoveredActiveSessionMenuId(null);
    setHoveredTrashSessionMenuId(null);
  }

  function toggleActiveSessionMenu(sessionId: string) {
    setHoveredActiveSessionMenuId((current) => {
      setHoveredTrashSessionMenuId(null);
      return current === sessionId ? null : sessionId;
    });
  }

  function closeActiveSessionMenu(sessionId: string) {
    setHoveredActiveSessionMenuId((current) => (current === sessionId ? null : current));
  }

  function handleActiveSessionItemBlur(
    event: React.FocusEvent<HTMLLIElement>,
    sessionId: string
  ) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    closeActiveSessionMenu(sessionId);
  }

  function toggleTrashSessionMenu(sessionId: string) {
    setHoveredTrashSessionMenuId((current) => {
      setHoveredActiveSessionMenuId(null);
      return current === sessionId ? null : sessionId;
    });
  }

  function closeTrashSessionMenu(sessionId: string) {
    setHoveredTrashSessionMenuId((current) => (current === sessionId ? null : current));
  }

  function handleTrashSessionItemBlur(
    event: React.FocusEvent<HTMLLIElement>,
    sessionId: string
  ) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    closeTrashSessionMenu(sessionId);
  }

  function selectBucket(bucket: SessionBucket) {
    const sessions = bucket === "trash" ? sessionCollections.trashedSessions : sessionCollections.activeSessions;
    setShowMoreActions(false);
    closeSessionMenus();
    setSelectedBucket(bucket);
    setSelectedSessionId(sessions[0]?.id ?? null);
  }

  function selectSession(bucket: SessionBucket, sessionId: string) {
    setShowMoreActions(false);
    closeSessionMenus();
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
    closeSessionMenus();
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

  async function handleDensityPreferenceChange(nextPreference: ManagerGridDensityPreference) {
    if (nextPreference === densityPreference) {
      return;
    }

    const previousPreference = densityPreference;
    setDensityPreference(nextPreference);

    try {
      await saveSettings({ managerGridDensityPreference: nextPreference });
      setStatus(`已切换到${nextPreference === "compact" ? "简洁" : "增强"}卡片密度。`);
    } catch (nextError: unknown) {
      setDensityPreference(previousPreference);
      setStatus(nextError instanceof Error ? nextError.message : "保存卡片密度偏好失败。");
    }
  }

  async function handleRenameGroup(sessionId: string, currentTitle: string) {
    const nextTitle = window.prompt("重命名分组", currentTitle);

    if (nextTitle === null) {
      return;
    }

    setBusyKey(`rename:${sessionId}`);
    closeSessionMenus();

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

  async function handleCreateGroup() {
    const nextTitle = window.prompt("新建分组", "新分组");

    if (nextTitle === null) {
      return;
    }

    setBusyKey("create-group");

    try {
      const sessionGroup = await createEmptySessionGroup(nextTitle);
      setStatus(`已创建分组“${sessionGroup.title}”。`);
      await loadSessionCollections("active", sessionGroup.id);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "新建分组失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleTogglePin(sessionId: string) {
    setBusyKey(`pin:${sessionId}`);
    closeSessionMenus();

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
    closeSessionMenus();

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
    closeSessionMenus();

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
    closeSessionMenus();

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
    closeSessionMenus();

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

  async function handleRepositionTab(
    sourceSessionId: string,
    tabId: string,
    targetSessionId: string,
    targetTabId: string | null = null
  ) {
    setBusyKey(`move-tab:${tabId}`);

    try {
      const result = await repositionSavedTab(sourceSessionId, tabId, targetSessionId, {
        targetTabId
      });
      setStatus(result.message);
      await loadSessionCollections("active", targetSessionId);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "移动标签页失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleReorderSessionGroup(
    sourceSessionId: string,
    targetSessionId: string
  ) {
    setBusyKey(`reorder:${sourceSessionId}`);

    try {
      await reorderSessionGroups(sourceSessionId, targetSessionId);
      setStatus("已更新分组顺序。");
      await loadSessionCollections("active", targetSessionId);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "更新分组顺序失败。");
    } finally {
      setBusyKey(null);
    }
  }

  function clearDragState() {
    setDragOverSessionId(null);
    setDragOverTabId(null);
    setDraggedSessionId(null);
    setDraggedTabId(null);
    setIsTabDropAtEnd(false);
  }

  function handleSessionDragStart(
    event: React.DragEvent<HTMLButtonElement>,
    sessionId: string
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(SESSION_DRAG_TYPE, sessionId);
    setDraggedSessionId(sessionId);
    setDraggedTabId(null);
    setDragOverTabId(null);
    setIsTabDropAtEnd(false);
    setShowMoreActions(false);
    closeSessionMenus();
  }

  function handleTabDragStart(
    event: React.DragEvent<HTMLDivElement>,
    sourceSessionId: string,
    tabId: string
  ) {
    const payload: DraggedTabPayload = {
      sourceSessionId,
      tabId
    };

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(TAB_DRAG_TYPE, JSON.stringify(payload));
    setDraggedTabId(tabId);
    setDraggedSessionId(null);
    setDragOverSessionId(null);
    closeSessionMenus();
  }

  function handleSessionDragOver(
    event: React.DragEvent<HTMLElement>,
    targetSessionId: string
  ) {
    if (selectedBucket !== "active") {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverSessionId(targetSessionId);
    setDragOverTabId(null);
    setIsTabDropAtEnd(false);
  }

  function handleSessionDragLeave() {
    setDragOverSessionId(null);
  }

  async function handleSessionDrop(
    event: React.DragEvent<HTMLElement>,
    targetSessionId: string
  ) {
    event.preventDefault();

    const droppedSessionId = event.dataTransfer.getData(SESSION_DRAG_TYPE);
    const droppedTabPayloadRaw = event.dataTransfer.getData(TAB_DRAG_TYPE);

    clearDragState();

    if (droppedSessionId) {
      await handleReorderSessionGroup(droppedSessionId, targetSessionId);
      return;
    }

    if (!droppedTabPayloadRaw) {
      return;
    }

    const droppedTabPayload = parseDraggedTabPayload(droppedTabPayloadRaw);

    if (!droppedTabPayload) {
      setStatus("无法识别拖拽过来的标签页数据。");
      return;
    }

    await handleRepositionTab(
      droppedTabPayload.sourceSessionId,
      droppedTabPayload.tabId,
      targetSessionId
    );
  }

  function handleTabDragOver(
    event: React.DragEvent<HTMLElement>,
    targetSessionId: string,
    targetTabId: string | null
  ) {
    if (selectedBucket !== "active" || !draggedTabId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOverSessionId(null);
    setDragOverTabId(targetTabId);
    setIsTabDropAtEnd(targetTabId === null && targetSessionId === selectedSessionId);
  }

  async function handleTabDrop(
    event: React.DragEvent<HTMLElement>,
    targetSessionId: string,
    targetTabId: string | null
  ) {
    event.preventDefault();
    event.stopPropagation();

    const droppedTabPayload = parseDraggedTabPayload(event.dataTransfer.getData(TAB_DRAG_TYPE));

    clearDragState();

    if (!droppedTabPayload) {
      setStatus("无法识别拖拽过来的标签页数据。");
      return;
    }

    await handleRepositionTab(
      droppedTabPayload.sourceSessionId,
      droppedTabPayload.tabId,
      targetSessionId,
      targetTabId
    );
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

  async function handleBackupSync() {
    await handleExportAll("json");
    setStatus("已下载本地备份。云同步暂未实现，当前建议使用导入与导出完成备份。");
  }

  const detailAreaLabel = selectedBucket === "trash" ? "回收站" : "全部";

  return (
    <AppShell
      title="TabVault Manager"
      titleIcon={
        <img
          alt="TabVault"
          className="manager-title-icon"
          src={chrome.runtime.getURL("icon.svg")}
        />
      }
      headerActions={
        <div className="manager-header-actions">
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
            <button className="manager-link" onClick={() => void handleCreateGroup()} type="button">
              新建分组
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
      }
      description=""
    >
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

      <div aria-live="polite" className="visually-hidden">
        {liveStatusMessage}
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
                  <li
                    className={`manager-tree__item ${hoveredActiveSessionMenuId === session.id ? "manager-tree__item--menu-open" : ""}`}
                    key={session.id}
                    onBlur={(event) => handleActiveSessionItemBlur(event, session.id)}
                  >
                    <div className="manager-tree__node-row">
                      <button
                        className={`manager-tree__node ${selectedSessionId === session.id && selectedBucket === "active" ? "manager-tree__node--selected" : ""} ${dragOverSessionId === session.id ? "manager-tree__node--drop-target" : ""} ${draggedSessionId === session.id ? "manager-tree__node--dragging" : ""}`}
                        id={`session-node-${session.id}`}
                        draggable
                        onDragEnd={clearDragState}
                        onDragLeave={handleSessionDragLeave}
                        onDragOver={(event) => handleSessionDragOver(event, session.id)}
                        onDragStart={(event) => handleSessionDragStart(event, session.id)}
                        onDrop={(event) => void handleSessionDrop(event, session.id)}
                        onClick={() => selectSession("active", session.id)}
                        type="button"
                      >
                        <span className="manager-tree__node-title">
                          {session.pinned ? "📌 " : ""}
                          {session.title}
                        </span>
                        <span className="manager-tree__count">{session.tabCount}</span>
                      </button>
                      <button
                        aria-expanded={hoveredActiveSessionMenuId === session.id}
                        aria-haspopup="menu"
                        aria-label={`分组操作：${session.title}`}
                        className="manager-tree__menu-trigger"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleActiveSessionMenu(session.id);
                        }}
                        type="button"
                      >
                        ...
                      </button>
                    </div>
                    {hoveredActiveSessionMenuId === session.id ? (
                      <div
                        aria-label={`分组操作：${session.title}`}
                        className="manager-tree__menu manager-tree__menu--popover"
                        role="menu"
                      >
                        <button
                          className="manager-tree__menu-item"
                          onClick={() => void handleRenameGroup(session.id, session.title)}
                          role="menuitem"
                          type="button"
                        >
                          重命名
                        </button>
                        <button
                          className="manager-tree__menu-item"
                          onClick={() => void handleTogglePin(session.id)}
                          role="menuitem"
                          type="button"
                        >
                          {session.pinned ? "取消固定" : "固定分组"}
                        </button>
                        <button
                          className="manager-tree__menu-item"
                          onClick={() => void handleMoveGroupToTrash(session.id)}
                          role="menuitem"
                          type="button"
                        >
                          移到回收站
                        </button>
                      </div>
                    ) : null}
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
                  <li
                    className={`manager-tree__item ${hoveredTrashSessionMenuId === session.id ? "manager-tree__item--menu-open" : ""}`}
                    key={session.id}
                    onBlur={(event) => handleTrashSessionItemBlur(event, session.id)}
                  >
                    <div className="manager-tree__node-row">
                      <button
                        className={`manager-tree__node ${selectedSessionId === session.id && selectedBucket === "trash" ? "manager-tree__node--selected" : ""}`}
                        id={`session-node-${session.id}`}
                        onClick={() => selectSession("trash", session.id)}
                        type="button"
                      >
                        <span className="manager-tree__node-title">{session.title}</span>
                        <span className="manager-tree__count">{session.tabCount}</span>
                      </button>
                      <button
                        aria-expanded={hoveredTrashSessionMenuId === session.id}
                        aria-haspopup="menu"
                        aria-label={`回收站分组操作：${session.title}`}
                        className="manager-tree__menu-trigger"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleTrashSessionMenu(session.id);
                        }}
                        type="button"
                      >
                        ...
                      </button>
                    </div>
                    {hoveredTrashSessionMenuId === session.id ? (
                      <div
                        aria-label={`回收站分组操作：${session.title}`}
                        className="manager-tree__menu manager-tree__menu--popover"
                        role="menu"
                      >
                        <button
                          className="manager-tree__menu-item"
                          onClick={() => void handleRestoreGroupFromTrash(session.id)}
                          role="menuitem"
                          type="button"
                        >
                          恢复分组
                        </button>
                        <button
                          className="manager-tree__menu-item"
                          onClick={() => void handleDeleteSessionPermanently(session.id)}
                          role="menuitem"
                          type="button"
                        >
                          永久删除
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </aside>

        <section className="manager-main" ref={managerMainRef}>
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
                  {selectedBucket === "active" ? (
                    <div aria-label="标签信息密度" className="manager-density-toggle" role="group">
                      <button
                        className={`button button--quiet button--small ${densityPreference === "compact" ? "button--active" : ""}`}
                        onClick={() => void handleDensityPreferenceChange("compact")}
                        type="button"
                      >
                        简洁
                      </button>
                      <button
                        className={`button button--quiet button--small ${densityPreference === "enhanced" ? "button--active" : ""}`}
                        onClick={() => void handleDensityPreferenceChange("enhanced")}
                        type="button"
                      >
                        增强
                      </button>
                    </div>
                  ) : null}
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

              {selectedBucket === "active" ? (
                <p className="muted manager-tabs__hint">
                  拖拽标签可调整组内顺序，拖到左侧分组可跨组移动。
                  {densityState.isAutoDowngraded ? " 当前宽度不足，已临时切换为简洁密度。" : ""}
                </p>
              ) : null}

              <ManagerTabGrid
                busyKey={busyKey}
                density={densityState.effectiveDensity}
                dragOverTabId={dragOverTabId}
                draggedTabId={draggedTabId}
                isAutoDowngraded={densityState.isAutoDowngraded}
                isInteractive={selectedBucket === "active"}
                isTabDropAtEnd={isTabDropAtEnd}
                onClearDragState={clearDragState}
                onDeleteTab={handleDeleteTab}
                onOpenTab={handleOpenTab}
                onRestoreTab={handleRestoreTab}
                onTabDragOver={handleTabDragOver}
                onTabDragStart={handleTabDragStart}
                onTabDrop={handleTabDrop}
                sessionId={selectedSession.id}
                tabs={selectedSession.tabs}
              />
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
