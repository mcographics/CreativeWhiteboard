import { beforeEach, describe, expect, it } from "vitest";
import type { ShapeObject } from "../src/models/whiteboard";
import { useBoardStore } from "../src/state/boardStore";

const rectangle: ShapeObject = {
  id: "rectangle-1", type: "rectangle", x: 10, y: 20, width: 100, height: 80,
  rotation: 0, opacity: 1, locked: false, strokeColor: "#000000",
  fillColor: "#ffffff", strokeWidth: 3
};

describe("board store", () => {
  beforeEach(() => useBoardStore.setState({ objects: [], selectedIds: [], past: [], future: [], clipboard: [] }));

  it("adds and undoes an object transaction", () => {
    useBoardStore.getState().addObject(rectangle);
    expect(useBoardStore.getState().objects).toHaveLength(1);
    useBoardStore.getState().undo();
    expect(useBoardStore.getState().objects).toHaveLength(0);
    useBoardStore.getState().redo();
    expect(useBoardStore.getState().objects).toHaveLength(1);
  });

  it("duplicates selected objects with new identity", () => {
    useBoardStore.getState().addObject(rectangle);
    useBoardStore.getState().duplicateSelected();
    const objects = useBoardStore.getState().objects;
    expect(objects).toHaveLength(2);
    expect(objects[1]?.id).not.toBe(rectangle.id);
    expect(objects[1]?.x).toBe(34);
  });

  it("copies and pastes selected objects", () => {
    useBoardStore.getState().addObject(rectangle);
    useBoardStore.getState().copySelected();
    useBoardStore.getState().paste();
    expect(useBoardStore.getState().objects).toHaveLength(2);
  });

  it("keeps drawing-tool tip profiles independent", () => {
    useBoardStore.getState().setToolProperties("pen", { strokeWidth: 5, opacity: 0.8 });
    useBoardStore.getState().setToolProperties("brush", { strokeWidth: 26, opacity: 0.6 });

    expect(useBoardStore.getState().toolProfiles.pen).toMatchObject({ strokeWidth: 5, opacity: 0.8 });
    expect(useBoardStore.getState().toolProfiles.brush).toMatchObject({ strokeWidth: 26, opacity: 0.6 });
    expect(useBoardStore.getState().toolProfiles.highlighter.strokeWidth).toBe(18);
    expect(useBoardStore.getState().toolProfiles.marker.strokeWidth).toBe(10);
  });

  it("applies Smooth Ink to selected strokes", () => {
    useBoardStore.getState().addObject({
      id: "stroke-1", type: "stroke", x: 0, y: 0, width: 0, height: 0, rotation: 0,
      opacity: 1, locked: false, points: [0, 0, 20, 20], color: "#000", strokeWidth: 3,
      mode: "pen", smooth: true
    });
    useBoardStore.getState().setProperties({ smoothInk: false });
    expect(useBoardStore.getState().objects[0]).toMatchObject({ smooth: false });
  });

  it("starts New and Open projects with clean undo history", () => {
    useBoardStore.getState().addObject(rectangle);
    useBoardStore.getState().clear();
    useBoardStore.getState().undo();
    expect(useBoardStore.getState().objects).toHaveLength(0);
    useBoardStore.getState().replaceObjects([rectangle]);
    useBoardStore.getState().undo();
    expect(useBoardStore.getState().objects).toEqual([rectangle]);
  });

  it("records the starting position for a completed floating drag", () => {
    useBoardStore.getState().addObject(rectangle);
    useBoardStore.getState().updateObject(rectangle.id, { x: 90, y: 100 }, false);
    useBoardStore.getState().commitObjectUpdate(rectangle.id, { x: 90, y: 100 }, { x: 10, y: 20 });
    useBoardStore.getState().undo();
    expect(useBoardStore.getState().objects[0]).toMatchObject({ x: 10, y: 20 });
  });

  it("applies fill controls to selected shapes", () => {
    useBoardStore.getState().addObject({ ...rectangle, fillColor: "transparent" });
    useBoardStore.getState().setProperties({ fillColor: "#ff0000", fillShapes: true });
    expect(useBoardStore.getState().objects[0]).toMatchObject({ fillColor: "#ff0000" });
    useBoardStore.getState().setProperties({ fillShapes: false });
    expect(useBoardStore.getState().objects[0]).toMatchObject({ fillColor: "transparent" });
  });
});
