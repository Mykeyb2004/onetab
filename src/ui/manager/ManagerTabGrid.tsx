import { useMemo, useState } from "react";
import type { CSSProperties, DragEvent, FocusEvent, KeyboardEvent, PointerEvent } from "react";
import type { SavedTab } from "../../types/session";
import type { EffectiveManagerGridDensity } from "./grid-density";
import { getGridCardMinWidth } from "./grid-density";

interface ManagerTabGridProps {
  density: EffectiveManagerGridDensity;
  isAutoDowngraded: boolean;
  isInteractive: boolean;
  showRestoreAction: boolean;
  sessionId: string;
  tabs: SavedTab[];
  busyKey: string | null;
  draggedTabId: string | null;
  dragOverTabId: string | null;
  isTabDropAtEnd: boolean;
  onOpenTab: (sessionId: string, tabId: string) => void | Promise<void>;
  onRestoreTab: (sessionId: string, tabId: string) => void | Promise<void>;
  onDeleteTab: (sessionId: string, tabId: string) => void | Promise<void>;
  onClearDragState: () => void;
  onTabDragStart: (
    event: DragEvent<HTMLDivElement>,
    sessionId: string,
    tabId: string
  ) => void;
  onTabDragOver: (
    event: DragEvent<HTMLElement>,
    sessionId: string,
    targetTabId: string | null
  ) => void;
  onTabDrop: (
    event: DragEvent<HTMLElement>,
    sessionId: string,
    targetTabId: string | null
  ) => void | Promise<void>;
}

function getTabHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function buildTabMeta(savedTab: SavedTab): string {
  if (savedTab.lastOpenedAt) {
    return `最近打开于 ${new Date(savedTab.lastOpenedAt).toLocaleDateString("zh-CN")}`;
  }

  return `保存于 ${new Date(savedTab.createdAt).toLocaleDateString("zh-CN")}`;
}

export function ManagerTabGrid({
  density,
  isAutoDowngraded,
  isInteractive,
  showRestoreAction,
  sessionId,
  tabs,
  busyKey,
  draggedTabId,
  dragOverTabId,
  isTabDropAtEnd,
  onOpenTab,
  onRestoreTab,
  onDeleteTab,
  onClearDragState,
  onTabDragStart,
  onTabDragOver,
  onTabDrop
}: ManagerTabGridProps) {
  const [revealedActionTabId, setRevealedActionTabId] = useState<string | null>(null);

  const gridStyle = useMemo(
    () =>
      ({
        "--manager-grid-min-card-width": `${getGridCardMinWidth(density)}px`
      }) as CSSProperties,
    [density]
  );

  function handleCardBlur(event: FocusEvent<HTMLElement>, tabId: string) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setRevealedActionTabId((current) => (current === tabId ? null : current));
  }

  function handleCardPointerDown(event: PointerEvent<HTMLElement>, tabId: string) {
    if (event.pointerType === "mouse") {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (target?.closest("button")) {
      return;
    }

    setRevealedActionTabId(tabId);
  }

  function handleCardDefaultAction(sessionId: string, tabId: string) {
    if (!isInteractive || busyKey !== null) {
      return;
    }

    void onOpenTab(sessionId, tabId);
  }

  function handleCardDefaultActionKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    sessionId: string,
    tabId: string
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleCardDefaultAction(sessionId, tabId);
  }

  return (
    <div
      className="manager-tab-grid"
      data-auto-downgraded={isAutoDowngraded ? "true" : "false"}
      data-density={density}
      style={gridStyle}
    >
      {tabs.map((savedTab) => {
        const actionsVisible = revealedActionTabId === savedTab.id;

        return (
          <article
            className={`manager-tab-card ${draggedTabId === savedTab.id ? "manager-tab-card--dragging" : ""} ${dragOverTabId === savedTab.id ? "manager-tab-card--drop-target" : ""}`}
            data-actions-visible={actionsVisible ? "true" : "false"}
            key={savedTab.id}
            onBlur={(event) => handleCardBlur(event, savedTab.id)}
            onFocus={() => setRevealedActionTabId(savedTab.id)}
            onPointerDown={(event) => handleCardPointerDown(event, savedTab.id)}
          >
            <div
              aria-label={isInteractive ? `打开 “${savedTab.title}”` : undefined}
              className="manager-tab-card__body"
              draggable={isInteractive}
              onClick={() => handleCardDefaultAction(sessionId, savedTab.id)}
              onDragEnd={onClearDragState}
              onDragOver={(event) => onTabDragOver(event, sessionId, savedTab.id)}
              onDragStart={(event) => onTabDragStart(event, sessionId, savedTab.id)}
              onDrop={(event) => void onTabDrop(event, sessionId, savedTab.id)}
              onKeyDown={(event) => handleCardDefaultActionKeyDown(event, sessionId, savedTab.id)}
              role={isInteractive ? "button" : undefined}
              tabIndex={isInteractive ? 0 : -1}
            >
              <div className="manager-tab-card__icon">
                {savedTab.favIconUrl ? (
                  <img alt="" src={savedTab.favIconUrl} />
                ) : (
                  <span>{savedTab.title.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div className="manager-tab-card__copy">
                <strong>{savedTab.title}</strong>
                <span>{getTabHostname(savedTab.url)}</span>
                {density === "enhanced" ? (
                  <small className="manager-tab-card__meta">{buildTabMeta(savedTab)}</small>
                ) : null}
              </div>
            </div>

            {isInteractive ? (
              <div className="manager-tab-card__actions">
                <button
                  aria-label={`打开 “${savedTab.title}”`}
                  className="manager-tab-card__icon-button"
                  disabled={busyKey !== null}
                  onClick={() => void onOpenTab(sessionId, savedTab.id)}
                  title="打开"
                  type="button"
                >
                  ↗
                </button>
                {showRestoreAction ? (
                  <button
                    aria-label={`还原并移除 “${savedTab.title}”`}
                    className="manager-tab-card__icon-button"
                    disabled={busyKey !== null}
                    onClick={() => void onRestoreTab(sessionId, savedTab.id)}
                    title="还原并移除"
                    type="button"
                  >
                    ⤴
                  </button>
                ) : null}
                <button
                  aria-label={`删除 “${savedTab.title}”`}
                  className="manager-tab-card__icon-button"
                  disabled={busyKey !== null}
                  onClick={() => void onDeleteTab(sessionId, savedTab.id)}
                  title="删除"
                  type="button"
                >
                  ×
                </button>
              </div>
            ) : null}
          </article>
        );
      })}

      {isInteractive ? (
        <div
          aria-label="拖拽记录到当前分组末尾"
          className={`manager-tab-grid__dropzone ${isTabDropAtEnd ? "manager-tab-grid__dropzone--active" : ""}`}
          onDragOver={(event) => onTabDragOver(event, sessionId, null)}
          onDrop={(event) => void onTabDrop(event, sessionId, null)}
        >
          {tabs.length === 0 ? "拖入记录到此分组" : "拖到这里放到末尾"}
        </div>
      ) : null}
    </div>
  );
}
