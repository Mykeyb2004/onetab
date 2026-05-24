import type { ManagerGridDensityPreference } from "../../types/settings";

export type EffectiveManagerGridDensity = "compact" | "enhanced";

export const COMPACT_CARD_MIN_WIDTH = 220;
export const ENHANCED_CARD_MIN_WIDTH = 280;
export const ENHANCED_GRID_MIN_WIDTH = ENHANCED_CARD_MIN_WIDTH * 2 + 12;

interface ResolveManagerGridDensityOptions {
  preference: ManagerGridDensityPreference;
  containerWidth: number;
}

export function resolveManagerGridDensity({
  preference,
  containerWidth
}: ResolveManagerGridDensityOptions): {
  effectiveDensity: EffectiveManagerGridDensity;
  isAutoDowngraded: boolean;
} {
  const isAutoDowngraded =
    preference === "enhanced" && containerWidth > 0 && containerWidth < ENHANCED_GRID_MIN_WIDTH;

  return {
    effectiveDensity: isAutoDowngraded ? "compact" : preference,
    isAutoDowngraded
  };
}

export function getGridCardMinWidth(density: EffectiveManagerGridDensity): number {
  return density === "enhanced" ? ENHANCED_CARD_MIN_WIDTH : COMPACT_CARD_MIN_WIDTH;
}
