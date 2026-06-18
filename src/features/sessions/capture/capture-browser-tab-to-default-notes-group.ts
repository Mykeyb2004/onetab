import { createSessionGroup } from "../../../domain/sessions/create-session-group";
import {
  appendCapturableTabToSessionGroup,
  DEFAULT_NOTES_GROUP_TITLE,
  selectDefaultNotesGroup
} from "../../../domain/sessions/default-notes-group";
import { prepareTabsForCapture } from "../../../domain/tabs/prepare-tabs-for-capture";
import {
  appendSessionGroup,
  readRootState,
  writeRootState
} from "../../../storage/local/repository";
import type { BrowserTab } from "../../../types/browser";
import type { CapturableTab, SessionGroup } from "../../../types/session";
import type { CaptureDependencies, CaptureResult } from "./capture-tabs";

function buildDefaultNotesCaptureMessage(result: {
  capturedCount: number;
  skippedCount: number;
  closeFailed: boolean;
  targetTitle: string;
}): string {
  if (result.capturedCount === 0) {
    if (result.skippedCount > 0) {
      return `Skipped ${result.skippedCount} unsupported tab(s); nothing was captured.`;
    }

    return "No tabs were available to capture.";
  }

  if (result.closeFailed) {
    return `Added the current page to "${result.targetTitle}", but failed to close the original tab.`;
  }

  return `Added the current page to "${result.targetTitle}".`;
}

async function upsertDefaultNotesGroup(
  capturableTab: CapturableTab,
  sourceWindowId: number | null,
  dependencies: CaptureDependencies,
  now: Date
): Promise<SessionGroup> {
  const state = await readRootState(dependencies.storage);
  const existingNotesGroup = selectDefaultNotesGroup(state.sessions);

  if (existingNotesGroup) {
    const updatedNotesGroup = appendCapturableTabToSessionGroup(
      existingNotesGroup,
      capturableTab,
      now
    );

    await writeRootState(dependencies.storage, {
      ...state,
      sessions: state.sessions.map((sessionGroup) =>
        sessionGroup.id === updatedNotesGroup.id ? updatedNotesGroup : sessionGroup
      )
    });

    return updatedNotesGroup;
  }

  const createdNotesGroup = createSessionGroup([capturableTab], {
    now,
    sourceWindowId,
    title: DEFAULT_NOTES_GROUP_TITLE
  });

  const nextState = await appendSessionGroup(dependencies.storage, createdNotesGroup);
  return (
    nextState.sessions.find((sessionGroup) => sessionGroup.id === createdNotesGroup.id) ??
    createdNotesGroup
  );
}

export async function captureBrowserTabToDefaultNotesGroup(
  browserTab: BrowserTab | null,
  dependencies: CaptureDependencies
): Promise<CaptureResult> {
  const preparedTabs = prepareTabsForCapture(browserTab ? [browserTab] : []);

  if (!browserTab || preparedTabs.capturableTabs.length === 0) {
    return {
      ok: true,
      message: buildDefaultNotesCaptureMessage({
        capturedCount: 0,
        skippedCount: preparedTabs.skippedTabs.length,
        closeFailed: false,
        targetTitle: DEFAULT_NOTES_GROUP_TITLE
      }),
      createdGroupId: null,
      capturedCount: 0,
      skippedCount: preparedTabs.skippedTabs.length,
      closedCount: 0
    };
  }

  const now = dependencies.now?.() ?? new Date();
  const targetSession = await upsertDefaultNotesGroup(
    preparedTabs.capturableTabs[0],
    preparedTabs.sourceWindowId,
    dependencies,
    now
  );
  let closeFailed = false;

  try {
    await dependencies.tabs.closeTabs(preparedTabs.closableTabIds);
  } catch {
    closeFailed = true;
  }

  return {
    ok: !closeFailed,
    message: buildDefaultNotesCaptureMessage({
      capturedCount: 1,
      skippedCount: 0,
      closeFailed,
      targetTitle: targetSession.title
    }),
    createdGroupId: targetSession.id,
    capturedCount: 1,
    skippedCount: 0,
    closedCount: closeFailed ? 0 : preparedTabs.closableTabIds.length
  };
}
