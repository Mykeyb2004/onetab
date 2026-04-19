import { useState } from "react";
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
    "选择一个动作后，TabVault 才会执行对应操作。"
  );
  const [busyType, setBusyType] = useState<RuntimeMessage["type"] | null>(null);

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

  return (
    <AppShell
      eyebrow="Popup"
      title="TabVault"
      description="点击扩展图标后只打开这个面板，不会默认自动收纳当前窗口。"
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
