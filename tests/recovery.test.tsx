import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import type { ShapeObject } from "../src/models/whiteboard";
import { useBoardStore } from "../src/state/boardStore";
import { useCameraStore } from "../src/state/cameraStore";
import { useProjectStore } from "../src/state/projectStore";

const RECOVERY_KEY = "creative-whiteboard-recovery-v1";
const rectangle: ShapeObject = {
  id: "recovery-object", type: "rectangle", x: 0, y: 0, width: 100, height: 100,
  rotation: 0, opacity: 1, locked: false, strokeColor: "#000", fillColor: "#fff", strokeWidth: 2
};

describe("recovery state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useBoardStore.setState({ objects: [], selectedIds: [], past: [], future: [], clipboard: [] });
    useCameraStore.getState().reset();
    useProjectStore.setState({ saveState: "saved", filePath: null, title: "Untitled" });
  });

  afterEach(() => vi.useRealTimers());

  it("does not create dirty recovery data for camera-only changes", () => {
    render(<App />);
    act(() => useCameraStore.getState().setCamera({ x: 120, y: 80, zoom: 1.2 }));
    act(() => vi.advanceTimersByTime(2_000));
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull();
  });

  it("does save recovery data after artwork changes", () => {
    render(<App />);
    act(() => useBoardStore.getState().addObject(rectangle));
    act(() => vi.advanceTimersByTime(2_000));
    expect(JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? "{}")).toMatchObject({ dirty: true });
  });
});
