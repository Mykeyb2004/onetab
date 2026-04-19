import type { ReactNode } from "react";
import "./app-shell.css";

interface AppShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function AppShell({
  eyebrow,
  title,
  description,
  children
}: AppShellProps) {
  return (
    <main className="app-shell">
      <header className="app-shell__header">
        {eyebrow ? <p className="app-shell__eyebrow">{eyebrow}</p> : null}
        <h1 className="app-shell__title">{title}</h1>
        {description ? <p className="app-shell__description">{description}</p> : null}
      </header>
      <section className="app-shell__body">{children}</section>
    </main>
  );
}
