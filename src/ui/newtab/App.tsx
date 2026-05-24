import { useEffect, useState } from "react";
import { restoreSessionGroup } from "../../features/sessions/restore/restore-session-group";
import {
  loadNewTabPageState,
  type NewTabPageState
} from "../../features/newtab/load-newtab-page-state";
import { sendRuntimeMessage, type RuntimeMessage } from "../../shared/messages";
import { AppShell } from "../shared/AppShell";
import "./newtab.css";

export function NewTabApp() {
  const [pageState, setPageState] = useState<NewTabPageState>({
    hasSessions: false,
    pinnedSessions: [],
    recentSessions: []
  });
  const [status, setStatus] = useState("Loading your saved sessions...");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function refreshState(nextStatus?: string) {
    const nextState = await loadNewTabPageState();
    setPageState(nextState);
    setStatus(
      nextStatus ??
        (nextState.hasSessions
          ? "Pick a session to restore or manage."
          : "No saved sessions yet.")
    );
  }

  useEffect(() => {
    void refreshState().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Failed to load saved sessions.");
    });
  }, []);

  async function runNavigationAction(
    type: Extract<RuntimeMessage["type"], "open/manager" | "open/options">
  ) {
    setBusyKey(type);

    try {
      const response = await sendRuntimeMessage({ type });
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to open the requested page.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRestoreSession(sessionId: string) {
    setBusyKey(`restore:${sessionId}`);

    try {
      const result = await restoreSessionGroup(sessionId);
      await refreshState(result.message);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to restore the selected session."
      );
    } finally {
      setBusyKey(null);
    }
  }

  const latestSession = pageState.recentSessions[0] ?? pageState.pinnedSessions[0] ?? null;

  return (
    <AppShell
      eyebrow="Browser Entry"
      title="New Tab"
      description="Jump back into your saved sessions without opening the full manager."
      headerActions={
        <div className="inline-actions">
          <button
            className="button button--secondary button--small"
            disabled={busyKey !== null}
            onClick={() => runNavigationAction("open/manager")}
            type="button"
          >
            Open Manager
          </button>
          <button
            className="button button--quiet button--small"
            disabled={busyKey !== null}
            onClick={() => runNavigationAction("open/options")}
            type="button"
          >
            Settings
          </button>
        </div>
      }
    >
      <div className="card stack status">
        <strong>Status</strong>
        <p className="muted">{status}</p>
      </div>

      {latestSession ? (
        <div className="card stack">
          <strong>Quick Restore</strong>
          <button
            className="button"
            disabled={busyKey !== null}
            onClick={() => handleRestoreSession(latestSession.id)}
            type="button"
          >
            {busyKey === `restore:${latestSession.id}` ? "Working..." : "Restore Latest Group"}
          </button>
        </div>
      ) : null}

      {!pageState.hasSessions ? (
        <div className="card stack">
          <strong>No saved sessions yet.</strong>
          <p className="muted">Open the manager to start capturing and organizing tabs.</p>
        </div>
      ) : (
        <div className="newtab-session-columns">
          {(
            [
              ["Pinned Sessions", pageState.pinnedSessions],
              ["Recent Sessions", pageState.recentSessions]
            ] as const
          ).map(([heading, sessions]) =>
            sessions.length > 0 ? (
              <section key={heading} className="card stack">
                <strong>{heading}</strong>
                <ul className="list">
                  {sessions.map((session) => (
                    <li key={session.id} className="list__item list__item--session">
                      <div className="session-card__header">
                        <div>
                          <strong>{session.title}</strong>
                          <p className="session-card__meta muted">{session.tabCount} saved tab(s)</p>
                        </div>
                        <button
                          className="button button--secondary button--small"
                          disabled={busyKey !== null}
                          onClick={() => handleRestoreSession(session.id)}
                          type="button"
                        >
                          Restore
                        </button>
                      </div>
                      <ul className="list">
                        {session.previewTabs.map((tab) => (
                          <li key={tab.url} className="list__item">
                            <span className="tab-row__title">{tab.title}</span>
                            <span className="tab-row__url muted">{tab.url}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null
          )}
        </div>
      )}
    </AppShell>
  );
}
