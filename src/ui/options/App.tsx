import { useEffect, useState } from "react";
import {
  loadSettingsPageState,
  type SettingsPageState
} from "../../features/settings/load-settings";
import {
  choosePersistenceDirectory,
  clearPersistenceDirectory
} from "../../features/settings/persistence-directory";
import { saveSettings } from "../../features/settings/save-settings";
import type { ExtensionSettings, RestoreBehavior } from "../../types/settings";
import { AppShell } from "../shared/AppShell";

export function OptionsApp() {
  const [settingsPageState, setSettingsPageState] = useState<SettingsPageState | null>(null);
  const [status, setStatus] = useState("Loading settings...");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function refreshSettingsPageState(nextStatus?: string) {
    const nextState = await loadSettingsPageState();
    setSettingsPageState(nextState);

    if (nextStatus) {
      setStatus(nextStatus);
      return nextState;
    }

    if (nextState.settingsError) {
      setStatus(nextState.settingsError);
      return nextState;
    }

    setStatus("Settings loaded from the active data store.");
    return nextState;
  }

  useEffect(() => {
    let alive = true;

    loadSettingsPageState()
      .then((nextSettings) => {
        if (alive) {
          setSettingsPageState(nextSettings);
          setStatus(
            nextSettings.settingsError ?? "Settings loaded from the active data store."
          );
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setStatus(error instanceof Error ? error.message : "Failed to load settings.");
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  async function persistSettings(nextSettings: ExtensionSettings) {
    setSettingsPageState((currentState) =>
      currentState
        ? {
            ...currentState,
            settings: nextSettings
          }
        : currentState
    );

    await saveSettings(nextSettings);
    const nextState = await refreshSettingsPageState();

    setStatus(
      nextState.persistence.backend === "directory"
        ? "Settings saved to the selected data directory."
        : "Settings saved to browser local storage."
    );
  }

  async function handleChooseDirectory() {
    setBusyAction("choose-directory");

    try {
      const persistence = await choosePersistenceDirectory();
      await refreshSettingsPageState(
        `TabVault will now store data in "${persistence.directoryName}" as ${persistence.fileName}.`
      );
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Failed to choose a data directory.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUseBrowserStorage() {
    setBusyAction("use-browser-storage");

    try {
      await clearPersistenceDirectory();
      await refreshSettingsPageState(
        "TabVault will now store data in browser local storage. The previous directory copy was left untouched."
      );
    } catch (error: unknown) {
      setStatus(
        error instanceof Error ? error.message : "Failed to move data back to browser local storage."
      );
    } finally {
      setBusyAction(null);
    }
  }

  const settings = settingsPageState?.settings ?? null;
  const persistence = settingsPageState?.persistence ?? null;
  const canEditSettings = settings !== null && busyAction === null;

  return (
    <AppShell
      eyebrow="Options"
      title="Settings"
      description="Adjust restore behavior, notifications, context menus, and the directory used for persistent data."
    >
      <div className="card stack">
        <strong>Status</strong>
        <p className="muted">{status}</p>
      </div>

      {persistence ? (
        <div className="card stack">
          <div className="field">
            <label htmlFor="persistence-backend">Persistent data location</label>
            <div id="persistence-backend" className="field__value">
              {persistence.backend === "directory"
                ? persistence.directoryName ?? "Selected Folder"
                : "Browser local storage"}
            </div>
            <p className="field__hint">
              {persistence.status === "browser-local"
                ? `TabVault is currently saving data inside chrome.storage.local. Choose a folder to keep ${persistence.fileName} in a user-selected directory.`
                : persistence.status === "directory-ready"
                  ? `TabVault is writing ${persistence.fileName} inside the selected folder.`
                  : persistence.status === "directory-needs-access"
                    ? `TabVault has a folder configured, but access is no longer available. Choose the folder again or switch back to browser local storage.`
                    : "This browser cannot open the folder picker required for directory-based persistence."}
            </p>
          </div>

          <div className="inline-actions">
            <button
              className="button"
              disabled={busyAction !== null || persistence.status === "unsupported"}
              onClick={handleChooseDirectory}
              type="button"
            >
              {persistence.backend === "directory" ? "Choose Different Folder" : "Choose Folder"}
            </button>
            <button
              className="button button--secondary"
              disabled={busyAction !== null || persistence.backend !== "directory"}
              onClick={handleUseBrowserStorage}
              type="button"
            >
              Use Browser Storage
            </button>
          </div>
        </div>
      ) : null}

      {settings ? (
        <div className="card stack">
          <div className="field">
            <label htmlFor="restore-behavior">Restore behavior</label>
            <select
              id="restore-behavior"
              disabled={!canEditSettings}
              value={settings.restoreBehavior}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  restoreBehavior: event.target.value as RestoreBehavior
                })
              }
            >
              <option value="remove-group">Remove group after restore</option>
              <option value="keep-group">Keep group after restore</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="show-capture-feedback">Show capture feedback</label>
            <input
              id="show-capture-feedback"
              disabled={!canEditSettings}
              checked={settings.showCaptureFeedback}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  showCaptureFeedback: event.target.checked
                })
              }
              type="checkbox"
            />
          </div>

          <div className="field">
            <label htmlFor="enable-context-menu">Enable action context menu</label>
            <input
              id="enable-context-menu"
              disabled={!canEditSettings}
              checked={settings.enableContextMenu}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  enableContextMenu: event.target.checked
                })
              }
              type="checkbox"
            />
          </div>
        </div>
      ) : (
        <div className="card stack">
          <strong>Behavior settings unavailable</strong>
          <p className="muted">
            TabVault could not read the active persisted data. Reconnect the folder or switch back to
            browser local storage to continue editing behavior settings.
          </p>
        </div>
      )}
    </AppShell>
  );
}
