import type { StrokeObject } from "../models/whiteboard";

export function isPenPointer(event: Pick<PointerEvent, "pointerType">) {
  return event.pointerType === "pen";
}

export function isStylusEraser(event: Pick<PointerEvent, "pointerType" | "button" | "buttons">) {
  return event.pointerType === "pen" && (event.button === 5 || (event.buttons & 32) === 32);
}

export function normalizedPenPressure(event: Pick<PointerEvent, "pointerType" | "pressure">) {
  if (event.pointerType !== "pen") return 1;
  return Math.min(1, Math.max(.01, Number.isFinite(event.pressure) && event.pressure > 0 ? event.pressure : .5));
}

export function pressureStrokeWidth(strokeWidth: number, mode: StrokeObject["mode"], pressure: number) {
  const normalized = Math.min(1, Math.max(0, pressure));
  const minimum = mode === "brush" ? .16 : mode === "marker" ? .45 : .22;
  const maximum = mode === "brush" ? 1.65 : mode === "marker" ? 1.3 : 1.45;
  return Math.max(.5, strokeWidth * (minimum + (maximum - minimum) * normalized));
}
