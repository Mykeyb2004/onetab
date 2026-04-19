import { useEffect, useRef, useState } from "react";
import { downloadArtifact, readFileAsText } from "../../adapters/browser/file-transfer";
import { deleteSavedTab } from "../../features/sessions/delete-saved-tab";
import { deleteSessionGroup } from "../../features/sessions/delete-session-group";
import {
  exportAllSessions,
  exportSingleSession
} from "../../features/sessions/export-sessions";
import {
  importJsonContent,
  importTextContent
} from "../../features/sessions/import-sessions";
import { renameSessionGroup } from "../../features/sessions/rename-session-group";
import { restoreSavedTab } from "../../features/sessions/restore/restore-saved-tab";
import { restoreSessionGroup } from "../../features/sessions/restore/restore-session-group";
import { searchSessions } from "../../features/sessions/search-sessions";
import { togglePinSessionGroup } from "../../features/sessions/toggle-pin-session-group";
import type { SearchHit } from "../../types/search";
import type { SessionGroup } from "../../types/session";
import { listSessions } from "../../features/sessions/list-sessions";
import { AppShell } from "../shared/AppShell";

export function ManagerApp() {
  const [sessions, setSessions] = useState<SessionGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading saved sessions from local storage.");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  async function loadSessions() {
    try {
      const nextSessions = await listSessions();
      setSessions(nextSessions);
      setError(null);
    } catch (nextError: unknown) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load session state from local storage."
      );
    }
  }

  const searchHits: SearchHit[] = searchSessions(query, sessions);

  useEffect(() => {
    let alive = true;

    listSessions()
      .then((nextSessions) => {
        if (alive) {
          setSessions(nextSessions);
          setStatus(
            `Loaded ${nextSessions.length} saved session group${nextSessions.length === 1 ? "" : "s"}.`
          );
        }
      })
      .catch((nextError: unknown) => {
        if (alive) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load session state from local storage."
          );
          setStatus("Failed to load saved sessions.");
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  async function handleRestoreGroup(sessionId: string) {
    setBusyKey(`group:${sessionId}`);

    try {
      const result = await restoreSessionGroup(sessionId);
      setStatus(result.message);
      await loadSessions();
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "Failed to restore the session.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRestoreTab(sessionId: string, tabId: string) {
    setBusyKey(`tab:${tabId}`);

    try {
      const result = await restoreSavedTab(sessionId, tabId);
      setStatus(result.message);
      await loadSessions();
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "Failed to restore the tab.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRenameGroup(sessionId: string, currentTitle: string) {
    const nextTitle = window.prompt("Rename session group", currentTitle);

    if (nextTitle === null) {
      return;
    }

    setBusyKey(`rename:${sessionId}`);

    try {
      await renameSessionGroup(sessionId, nextTitle);
      setStatus("Renamed the session group.");
      await loadSessions();
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "Failed to rename the group.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleTogglePin(sessionId: string) {
    setBusyKey(`pin:${sessionId}`);

    try {
      const updatedSession = await togglePinSessionGroup(sessionId);
      setStatus(updatedSession.pinned ? "Pinned the session group." : "Unpinned the session group.");
      await loadSessions();
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "Failed to update pin state.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteGroup(sessionId: string) {
    const shouldDelete = window.confirm("Delete this session group?");

    if (!shouldDelete) {
      return;
    }

    setBusyKey(`delete-group:${sessionId}`);

    try {
      await deleteSessionGroup(sessionId);
      setStatus("Deleted the session group.");
      await loadSessions();
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "Failed to delete the session group.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteTab(sessionId: string, tabId: string) {
    const shouldDelete = window.confirm("Delete this saved tab?");

    if (!shouldDelete) {
      return;
    }

    setBusyKey(`delete-tab:${tabId}`);

    try {
      const updatedSession = await deleteSavedTab(sessionId, tabId);
      setStatus(
        updatedSession
          ? `Deleted the saved tab. ${updatedSession.tabCount} tab(s) remain in the group.`
          : "Deleted the last saved tab and removed the empty session group."
      );
      await loadSessions();
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "Failed to delete the saved tab.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleExportAll(format: "json" | "text") {
    setBusyKey(`export-all:${format}`);

    try {
      const artifact = await exportAllSessions(format);
      downloadArtifact(artifact);
      setStatus(`Exported all sessions as ${format.toUpperCase()}.`);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "Failed to export all sessions.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleExportSession(sessionId: string, format: "json" | "text") {
    setBusyKey(`export-session:${sessionId}:${format}`);

    try {
      const artifact = await exportSingleSession(sessionId, format);
      downloadArtifact(artifact);
      setStatus(`Exported the session group as ${format.toUpperCase()}.`);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "Failed to export the session group.");
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
      await loadSessions();
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "Failed to import the selected file.");
    } finally {
      setBusyKey(null);
      event.target.value = "";
    }
  }

  function handleOpenImportPicker() {
    importInputRef.current?.click();
  }

  function handleScrollToGroup(sessionId: string) {
    document.getElementById(`session-${sessionId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  return (
    <AppShell
      eyebrow="Manager"
      title="Session Manager"
      description="Capture and restore are live. Manager now handles search, group actions, and import/export from the local session store."
    >
      <div className="card stack">
        <strong>Status</strong>
        <p className="muted">{error ?? status}</p>
      </div>

      <div className="card stack">
        <strong>Tools</strong>
        <div className="toolbar">
          <div className="field toolbar__field">
            <label htmlFor="manager-search">Search group name, tab title, or URL</label>
            <input
              id="manager-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved sessions"
              type="search"
              value={query}
            />
          </div>

          <div className="toolbar__actions">
            <button
              className="button button--secondary"
              disabled={busyKey !== null}
              onClick={() => handleExportAll("json")}
              type="button"
            >
              {busyKey === "export-all:json" ? "Exporting..." : "Export All JSON"}
            </button>
            <button
              className="button button--secondary"
              disabled={busyKey !== null}
              onClick={() => handleExportAll("text")}
              type="button"
            >
              {busyKey === "export-all:text" ? "Exporting..." : "Export All Text"}
            </button>
            <button
              className="button button--quiet"
              disabled={busyKey !== null}
              onClick={handleOpenImportPicker}
              type="button"
            >
              {busyKey === "import" ? "Importing..." : "Import File"}
            </button>
          </div>
        </div>

        <input
          accept=".json,.txt,.text"
          className="visually-hidden"
          onChange={handleImportFile}
          ref={importInputRef}
          type="file"
        />
      </div>

      {query.trim() ? (
        <div className="card stack">
          <strong>Search Results</strong>
          {searchHits.length === 0 ? (
            <p className="muted">No matches for “{query}”.</p>
          ) : (
            <ul className="list">
              {searchHits.map((searchHit, index) => (
                <li className="list__item" key={`${searchHit.sessionId}:${searchHit.tabId ?? "group"}:${searchHit.matchField}:${index}`}>
                  <strong>{searchHit.label}</strong>
                  <p className="muted search-hit__meta">
                    {searchHit.matchField} · {searchHit.sessionTitle}
                  </p>
                  <div className="inline-actions">
                    <button
                      className="button button--quiet button--small"
                      disabled={busyKey !== null}
                      onClick={() => handleScrollToGroup(searchHit.sessionId)}
                      type="button"
                    >
                      Show Group
                    </button>
                    {searchHit.tabId ? (
                      <button
                        className="button button--secondary button--small"
                        disabled={busyKey !== null}
                        onClick={() => handleRestoreTab(searchHit.sessionId, searchHit.tabId!)}
                        type="button"
                      >
                        {busyKey === `tab:${searchHit.tabId}` ? "Restoring..." : "Restore Match"}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="card stack">
        <strong>Saved sessions</strong>
        {sessions.length === 0 ? (
          <p className="muted">No saved sessions yet. Use Popup capture actions to populate this list.</p>
        ) : (
          <ul className="list">
            {sessions.map((session) => (
              <li className="list__item list__item--session" id={`session-${session.id}`} key={session.id}>
                <div className="session-card__header">
                  <div>
                    <strong>{session.pinned ? `Pinned · ${session.title}` : session.title}</strong>
                    <p className="muted session-card__meta">
                      {session.tabCount} tabs · updated {session.updatedAt}
                    </p>
                  </div>

                  <div className="inline-actions">
                    <button
                      className="button button--small"
                      disabled={busyKey !== null}
                      onClick={() => handleRestoreGroup(session.id)}
                      type="button"
                    >
                      {busyKey === `group:${session.id}` ? "Restoring..." : "Restore Group"}
                    </button>
                    <button
                      className="button button--secondary button--small"
                      disabled={busyKey !== null}
                      onClick={() => handleRenameGroup(session.id, session.title)}
                      type="button"
                    >
                      {busyKey === `rename:${session.id}` ? "Renaming..." : "Rename"}
                    </button>
                    <button
                      className="button button--quiet button--small"
                      disabled={busyKey !== null}
                      onClick={() => handleTogglePin(session.id)}
                      type="button"
                    >
                      {busyKey === `pin:${session.id}` ? "Saving..." : session.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      className="button button--quiet button--small"
                      disabled={busyKey !== null}
                      onClick={() => handleExportSession(session.id, "json")}
                      type="button"
                    >
                      {busyKey === `export-session:${session.id}:json` ? "Exporting..." : "Export JSON"}
                    </button>
                    <button
                      className="button button--quiet button--small"
                      disabled={busyKey !== null}
                      onClick={() => handleExportSession(session.id, "text")}
                      type="button"
                    >
                      {busyKey === `export-session:${session.id}:text` ? "Exporting..." : "Export Text"}
                    </button>
                    <button
                      className="button button--quiet button--small"
                      disabled={busyKey !== null}
                      onClick={() => handleDeleteGroup(session.id)}
                      type="button"
                    >
                      {busyKey === `delete-group:${session.id}` ? "Deleting..." : "Delete Group"}
                    </button>
                  </div>
                </div>

                <ul className="list">
                  {session.tabs.map((savedTab) => (
                    <li className="list__item" key={savedTab.id}>
                      <div className="tab-row">
                        <div className="tab-row__text">
                          <strong className="tab-row__title">{savedTab.title}</strong>
                          <span className="muted tab-row__url">{savedTab.url}</span>
                        </div>

                        <div className="tab-row__actions">
                          <button
                            className="button button--secondary button--small"
                            disabled={busyKey !== null}
                            onClick={() => handleRestoreTab(session.id, savedTab.id)}
                            type="button"
                          >
                            {busyKey === `tab:${savedTab.id}` ? "Restoring..." : "Restore Tab"}
                          </button>
                          <button
                            className="button button--quiet button--small"
                            disabled={busyKey !== null}
                            onClick={() => handleDeleteTab(session.id, savedTab.id)}
                            type="button"
                          >
                            {busyKey === `delete-tab:${savedTab.id}` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
