import { beforeEach, describe, expect, it } from "vitest";
import { useCameraStore } from "../src/state/cameraStore";

describe("camera store foundation", () => {
  beforeEach(() => useCameraStore.getState().reset());

  it("starts at the default camera", () => {
    expect(useCameraStore.getState()).toMatchObject({ x: 0, y: 0, zoom: 1 });
  });

  it("changes and resets zoom", () => {
    useCameraStore.getState().zoomIn();
    expect(useCameraStore.getState().zoom).toBeCloseTo(1.2);
    useCameraStore.getState().reset();
    expect(useCameraStore.getState().zoom).toBe(1);
  });
});
