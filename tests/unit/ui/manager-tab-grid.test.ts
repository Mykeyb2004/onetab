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
});
