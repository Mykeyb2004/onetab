import { AppShell } from "../shared/AppShell";

export function HelpApp() {
  return (
    <AppShell
      eyebrow="Help"
      title="TabVault Help"
      description="Quick reference for the webpage context menu and the main TabVault workflows."
    >
      <div className="card stack">
        <strong>Webpage Right Click Menu</strong>
        <ul className="list">
          <li className="list__item">Open TabVault: open the manager page.</li>
          <li className="list__item">Send tabs actions: capture tabs into a new TabVault session group.</li>
          <li className="list__item">Fixed Groups: send the current page into a pinned long-lived group.</li>
          <li className="list__item">Recent Groups: send the current page into one of the recent session groups.</li>
          <li className="list__item">
            Exclude current site: send all tabs in the current window except tabs on the same site as the current page.
          </li>
        </ul>
      </div>

      <div className="card stack">
        <strong>Current MVP Rules</strong>
        <ul className="list">
          <li className="list__item">Whole-group restore opens a new window.</li>
          <li className="list__item">Single-tab restore removes that tab from the original group.</li>
          <li className="list__item">Current unsupported pages such as `chrome://` are skipped.</li>
        </ul>
      </div>
    </AppShell>
  );
}
