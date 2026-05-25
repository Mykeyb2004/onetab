export const MANAGER_CARD_COLOR_FAMILIES = [
  "blue",
  "cyan",
  "green",
  "orange",
  "pink",
  "neutral"
] as const;

export type ManagerCardColorFamily = (typeof MANAGER_CARD_COLOR_FAMILIES)[number];

const HASHED_CARD_COLOR_FAMILIES: Exclude<ManagerCardColorFamily, "neutral">[] = [
  "blue",
  "cyan",
  "green",
  "orange",
  "pink"
];

function parseHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.trim().toLowerCase();

    return hostname || null;
  } catch {
    return null;
  }
}

function hashHostname(hostname: string): number {
  let hash = 5381;

  for (const char of hostname) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export function resolveManagerCardColorFamily(url: string): ManagerCardColorFamily {
  const hostname = parseHostname(url);

  if (!hostname) {
    return "neutral";
  }

  return HASHED_CARD_COLOR_FAMILIES[hashHostname(hostname) % HASHED_CARD_COLOR_FAMILIES.length];
}
