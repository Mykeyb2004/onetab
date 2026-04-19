import { useEffect, useRef, useState } from "react";
import { sendRuntimeMessage, type RuntimeMessage } from "../../shared/messages";
import { AppShell } from "../shared/AppShell";

const actionButtons: Array<{
  label: string;
  type: RuntimeMessage["type"];
}> = [
  { label: "Capture Current Window", type: "capture/current-window" },
  { label: "Capture Current Tab", type: "capture/current-tab" },
  { label: "Capture Selected Tabs", type: "capture/selected-tabs" },
  { label: "Open Manager", type: "open/manager" },
  { label: "Open Settings", type: "open/options" }
];

export function PopupApp() {
  const [status, setStatus] = useState(
    "Capture current window, current tab, selected tabs, and manager actions are live."
  );
  const [busyType, setBusyType] = useState<RuntimeMessage["type"] | null>(null);
  const hasAutoTriggeredRef = useRef(false);

  async function runAction(type: RuntimeMessage["type"]) {
    setBusyType(type);

    try {
      const response = await sendRuntimeMessage({ type });
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to reach the service worker.");
    } finally {
      setBusyType(null);
    }
  }

  useEffect(() => {
    if (hasAutoTriggeredRef.current) {
      return;
    }

    const action = new URLSearchParams(window.location.search).get("action");

    if (
      action === "capture-current-window" ||
      action === "open-manager"
    ) {
      hasAutoTriggeredRef.current = true;
      const timeoutId = window.setTimeout(() => {
        void runAction(
          action === "capture-current-window" ? "capture/current-window" : "open/manager"
        );
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, []);

  return (
    <AppShell
      eyebrow="Popup"
      title="TabVault"
      description="Popup actions are active, and the extension icon now respects the configured default click action."
    >
      <div className="card stack">
        <div className="grid grid--actions">
          {actionButtons.map((button) => (
            <button
              key={button.type}
              className={button.type.startsWith("open/") ? "button button--secondary" : "button"}
              onClick={() => runAction(button.type)}
              disabled={busyType !== null}
              type="button"
            >
              {busyType === button.type ? "Working..." : button.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card status">
        <strong>Status</strong>
        <p className="muted">{status}</p>
      </div>
    </AppShell>
  );
}
