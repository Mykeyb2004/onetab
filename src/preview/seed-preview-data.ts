import { importSpdContent } from "../features/sessions/import-sessions";
import type { ExtensionStorageArea } from "../storage/local/repository";

export const PREVIEW_SEED_FLAG_KEY = "tabvault:preview-seeded";

export async function seedPreviewData(
  storage: ExtensionStorageArea,
  spdContent: string
): Promise<boolean> {
  const seedState = await storage.get(PREVIEW_SEED_FLAG_KEY);

  if (seedState[PREVIEW_SEED_FLAG_KEY] === true) {
    return false;
  }

  await importSpdContent(spdContent, {
    storage,
    now: () => new Date("2026-05-24T00:00:00.000Z")
  });
  await storage.set({
    [PREVIEW_SEED_FLAG_KEY]: true
  });

  return true;
}
