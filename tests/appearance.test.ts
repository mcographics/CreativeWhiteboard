import { describe, expect, it } from "vitest";
import { isAfterSundown } from "../src/hooks/useResolvedAppearance";

describe("automatic appearance timing", () => {
  it("uses seasonal sunrise and sunset rather than fixed hours", () => {
    expect(isAfterSundown(new Date(2026, 5, 21, 19, 0), 43.65)).toBe(false);
    expect(isAfterSundown(new Date(2026, 5, 21, 21, 0), 43.65)).toBe(true);
    expect(isAfterSundown(new Date(2026, 11, 21, 15, 0), 43.65)).toBe(false);
    expect(isAfterSundown(new Date(2026, 11, 21, 17, 0), 43.65)).toBe(true);
  });
});
