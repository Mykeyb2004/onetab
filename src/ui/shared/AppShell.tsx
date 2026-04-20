import type { ReactNode } from "react";
import "./app-shell.css";

interface AppShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  titleIcon?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  eyebrow,
  title,
  description,
  titleIcon,
  headerActions,
  children
}: AppShellProps) {
  return (
    <main className="app-shell">
      <header className="app-shell__header">
        {eyebrow ? <p className="app-shell__eyebrow">{eyebrow}</p> : null}
        <div className="app-shell__title-row">
          <div className="app-shell__title-group">
            {titleIcon ? <div className="app-shell__title-icon">{titleIcon}</div> : null}
            <h1 className="app-shell__title">{title}</h1>
          </div>
          {headerActions ? <div className="app-shell__header-actions">{headerActions}</div> : null}
        </div>
        {description ? <p className="app-shell__description">{description}</p> : null}
      </header>
      <section className="app-shell__body">{children}</section>
    </main>
  );
}
