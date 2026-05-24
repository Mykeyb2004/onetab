import { describe, expect, it } from "vitest";
import {
  COMPACT_CARD_MIN_WIDTH,
  ENHANCED_CARD_MIN_WIDTH,
  resolveManagerGridDensity
} from "../../../src/ui/manager/grid-density";

describe("resolveManagerGridDensity", () => {
  it("should keep compact preference regardless of available width", () => {
    expect(
      resolveManagerGridDensity({
        preference: "compact",
        containerWidth: ENHANCED_CARD_MIN_WIDTH * 3
      })
    ).toEqual({
      effectiveDensity: "compact",
      isAutoDowngraded: false
    });
  });

  it("should keep enhanced preference when the container is wide enough", () => {
    expect(
      resolveManagerGridDensity({
        preference: "enhanced",
        containerWidth: ENHANCED_CARD_MIN_WIDTH * 2 + 12
      })
    ).toEqual({
      effectiveDensity: "enhanced",
      isAutoDowngraded: false
    });
  });

  it("should auto-downgrade enhanced preference when the container is too narrow", () => {
    expect(
      resolveManagerGridDensity({
        preference: "enhanced",
        containerWidth: ENHANCED_CARD_MIN_WIDTH - 1
      })
    ).toEqual({
      effectiveDensity: "compact",
      isAutoDowngraded: true
    });
  });

  it("should expose smaller card widths for compact mode", () => {
    expect(COMPACT_CARD_MIN_WIDTH).toBeLessThan(ENHANCED_CARD_MIN_WIDTH);
  });
});
