import { describe, expect, it } from "vitest";
import type { BoardObject } from "../src/models/whiteboard";
import { calculateBoardBounds, calculateExportScale } from "../src/services/boardExportRenderer";

describe("complete board export", () => {
  it("includes floating documents and strokes in board bounds", () => {
    const objects: BoardObject[] = [
      {
        id: "stroke", type: "stroke", x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1, locked: false,
        points: [-100, -50, 20, 40], color: "#000", strokeWidth: 10, mode: "pen", smooth: true
      },
      {
        id: "pdf", type: "pdf", x: 500, y: 300, width: 520, height: 620, rotation: 0, opacity: 1, locked: false,
        fileName: "notes.pdf", dataUrl: "data:application/pdf;base64,JVBERi0=", collapsed: false,
        documentZoom: 1, currentPage: 1, pageCount: 2
      }
    ];
    const bounds = calculateBoardBounds(objects, { x: 0, y: 0, width: 100, height: 100 });
    expect(bounds.x).toBe(-105);
    expect(bounds.y).toBe(-55);
    expect(bounds.x + bounds.width).toBe(1020);
    expect(bounds.y + bounds.height).toBe(920);
  });

  it("caps oversized exports at safe dimensions and pixel counts", () => {
    const scale = calculateExportScale(7680, 4320, 4);
    expect(7680 * scale).toBeLessThanOrEqual(8192);
    expect(4320 * scale).toBeLessThanOrEqual(8192);
    expect(7680 * 4320 * scale * scale).toBeLessThanOrEqual(64_000_001);
  });
});
