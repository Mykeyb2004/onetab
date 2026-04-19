import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { createSessionGroup } from "../../domain/sessions/create-session-group";
import { appendSessionGroup, type ExtensionStorageArea } from "../../storage/local/repository";
import type { SessionGroup } from "../../types/session";

interface CreateEmptySessionGroupDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

export async function createEmptySessionGroup(
  title: string,
  dependencies: CreateEmptySessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<SessionGroup> {
  const nextTitle = title.trim();

  if (!nextTitle) {
    throw new Error("Session group title cannot be empty.");
  }

  const now = dependencies.now?.() ?? new Date();
  const sessionGroup = createSessionGroup([], {
    now,
    title: nextTitle,
    sourceWindowId: null
  });

  await appendSessionGroup(dependencies.storage, sessionGroup);
  return sessionGroup;
}
