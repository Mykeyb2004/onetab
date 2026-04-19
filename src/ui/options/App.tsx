import { useEffect, useState } from "react";
import {
  loadSettings
} from "../../features/settings/load-settings";
import { saveSettings } from "../../features/settings/save-settings";
import type { DefaultClickAction, ExtensionSettings, RestoreBehavior } from "../../types/settings";
import { AppShell } from "../shared/AppShell";

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [status, setStatus] = useState("Loading settings...");

  useEffect(() => {
    let alive = true;

    loadSettings()
      .then((nextSettings) => {
        if (alive) {
          setSettings(nextSettings);
          setStatus("Settings loaded from local storage.");
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
    setSettings(nextSettings);
    await saveSettings(nextSettings);
    setStatus("Settings saved to local storage.");
  }

  return (
    <AppShell
      eyebrow="Options"
      title="Settings"
      description="The scaffold already persists restore behavior, default click action, feedback visibility, and context-menu configuration."
    >
      <div className="card stack">
        <strong>Status</strong>
        <p className="muted">{status}</p>
      </div>

      {settings ? (
        <div className="card stack">
          <div className="field">
            <label htmlFor="restore-behavior">Restore behavior</label>
            <select
              id="restore-behavior"
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
            <label htmlFor="default-click-action">Default action</label>
            <select
              id="default-click-action"
              value={settings.defaultClickAction}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  defaultClickAction: event.target.value as DefaultClickAction
                })
              }
            >
              <option value="capture-current-window">Capture current window</option>
              <option value="open-manager">Open manager</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="show-capture-feedback">Show capture feedback</label>
            <input
              id="show-capture-feedback"
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
      ) : null}
    </AppShell>
  );
}
