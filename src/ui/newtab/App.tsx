import { AppShell } from "../shared/AppShell";

export function NewTabApp() {
  return (
    <AppShell
      eyebrow="Browser Entry"
      title="New Tab"
      description="Start from TabVault or jump into the full manager."
    >
      <div className="card stack">
        <div className="inline-actions">
          <button className="button" type="button">
            Open Manager
          </button>
          <button className="button button--secondary" type="button">
            Open Settings
          </button>
        </div>
      </div>
    </AppShell>
  );
}
