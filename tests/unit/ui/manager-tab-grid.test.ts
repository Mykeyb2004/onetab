import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagerTabGrid } from "../../../src/ui/manager/ManagerTabGrid";

describe("ManagerTabGrid", () => {
  it("should render hover tips for tab action buttons when the card is interactive", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerTabGrid, {
        busyKey: null,
        density: "enhanced",
        dragOverTabId: null,
        draggedTabId: null,
        isAutoDowngraded: false,
        isInteractive: true,
        isTabDropAtEnd: false,
        onClearDragState: () => {},
        onDeleteTab: () => {},
        onOpenTab: () => {},
        onRestoreTab: () => {},
        showRestoreAction: true,
        onTabDragOver: () => {},
        onTabDragStart: () => {},
        onTabDrop: () => {},
        sessionId: "session-1",
        tabs: [
          {
            id: "tab-1",
            title: "React Compiler",
            url: "https://example.com/react-compiler",
            favIconUrl: null,
            createdAt: "2026-05-24T12:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ]
      })
    );

    expect(markup).toContain('title="打开"');
    expect(markup).toContain('title="还原并移除"');
    expect(markup).toContain('title="删除"');
  });

  it("should hide the restore action when the current group is pinned", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerTabGrid, {
        busyKey: null,
        density: "enhanced",
        dragOverTabId: null,
        draggedTabId: null,
        isAutoDowngraded: false,
        isInteractive: true,
        isTabDropAtEnd: false,
        onClearDragState: () => {},
        onDeleteTab: () => {},
        onOpenTab: () => {},
        onRestoreTab: () => {},
        showRestoreAction: false,
        onTabDragOver: () => {},
        onTabDragStart: () => {},
        onTabDrop: () => {},
        sessionId: "session-1",
        tabs: [
          {
            id: "tab-1",
            title: "React Compiler",
            url: "https://example.com/react-compiler",
            favIconUrl: null,
            createdAt: "2026-05-24T12:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ]
      })
    );

    expect(markup).toContain('title="打开"');
    expect(markup).not.toContain('title="还原并移除"');
    expect(markup).toContain('title="删除"');
  });

  it("should render the card body as the default open action when interactive", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerTabGrid, {
        busyKey: null,
        density: "enhanced",
        dragOverTabId: null,
        draggedTabId: null,
        isAutoDowngraded: false,
        isInteractive: true,
        isTabDropAtEnd: false,
        onClearDragState: () => {},
        onDeleteTab: () => {},
        onOpenTab: () => {},
        onRestoreTab: () => {},
        showRestoreAction: true,
        onTabDragOver: () => {},
        onTabDragStart: () => {},
        onTabDrop: () => {},
        sessionId: "session-1",
        tabs: [
          {
            id: "tab-1",
            title: "React Compiler",
            url: "https://example.com/react-compiler",
            favIconUrl: null,
            createdAt: "2026-05-24T12:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ]
      })
    );

    expect(markup).toContain('class="manager-tab-card__body"');
    expect(markup).toContain('role="button"');
    expect(markup).toContain('aria-label="打开 “React Compiler”"');
  });

  it("should render action buttons after the card content to avoid covering the title", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerTabGrid, {
        busyKey: null,
        density: "enhanced",
        dragOverTabId: null,
        draggedTabId: null,
        isAutoDowngraded: false,
        isInteractive: true,
        isTabDropAtEnd: false,
        onClearDragState: () => {},
        onDeleteTab: () => {},
        onOpenTab: () => {},
        onRestoreTab: () => {},
        showRestoreAction: true,
        onTabDragOver: () => {},
        onTabDragStart: () => {},
        onTabDrop: () => {},
        sessionId: "session-1",
        tabs: [
          {
            id: "tab-1",
            title: "React Compiler",
            url: "https://example.com/react-compiler",
            favIconUrl: null,
            createdAt: "2026-05-24T12:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ]
      })
    );

    expect(markup.indexOf("manager-tab-card__body")).toBeLessThan(
      markup.indexOf("manager-tab-card__actions")
    );
  });

  it("should attach stable color markers for cards with and without favicons", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerTabGrid, {
        busyKey: null,
        density: "enhanced",
        dragOverTabId: null,
        draggedTabId: null,
        isAutoDowngraded: false,
        isInteractive: true,
        isTabDropAtEnd: false,
        onClearDragState: () => {},
        onDeleteTab: () => {},
        onOpenTab: () => {},
        onRestoreTab: () => {},
        showRestoreAction: true,
        onTabDragOver: () => {},
        onTabDragStart: () => {},
        onTabDrop: () => {},
        sessionId: "session-1",
        tabs: [
          {
            id: "tab-1",
            title: "Example Docs",
            url: "https://example.com/docs",
            favIconUrl: null,
            createdAt: "2026-05-24T12:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          },
          {
            id: "tab-2",
            title: "Example Home",
            url: "https://example.com/home",
            favIconUrl:
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%231f4db8'/%3E%3C/svg%3E",
            createdAt: "2026-05-24T12:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 1
          },
          {
            id: "tab-3",
            title: "Broken Import",
            url: "not-a-valid-url",
            favIconUrl: null,
            createdAt: "2026-05-24T12:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 2
          }
        ]
      })
    );

    expect(markup).toContain('data-color-family="orange"');
    expect(markup).toContain('data-color-family="neutral"');
    expect(markup).toContain('data-has-favicon="false"');
    expect(markup).toContain('data-has-favicon="true"');
    expect(markup).toContain(">E</span>");
  });
});
