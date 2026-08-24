import "@testing-library/jest-dom/vitest";
import { createElement, forwardRef, useImperativeHandle, useRef } from "react";
import { vi } from "vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

class PointerEventStub extends MouseEvent {
  pointerId: number;
  pointerType: string;
  pressure: number;
  tiltX: number;
  tiltY: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
    this.pointerType = init.pointerType ?? "mouse";
    this.pressure = init.pressure ?? (init.buttons ? .5 : 0);
    this.tiltX = init.tiltX ?? 0;
    this.tiltY = init.tiltY ?? 0;
  }

  getCoalescedEvents() {
    return [this];
  }
}

vi.stubGlobal("PointerEvent", PointerEventStub);

vi.mock("react-konva", () => {
  const component = (name: string) => forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
    if (name === "Transformer") {
      return createElement("div", {
        ref,
        "data-konva": name,
        "data-enabled-anchors": Array.isArray(props.enabledAnchors) ? props.enabledAnchors.join(",") : ""
      });
    }
    return createElement("div", { ...props, ref, "data-konva": name });
  });
  const Stage = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const pointerRef = useRef({ x: 0, y: 0 });
    const stage = {
      getPointerPosition: () => pointerRef.current,
      setPointersPositions: (event: PointerEvent) => { pointerRef.current = { x: event.clientX, y: event.clientY }; },
      container: () => elementRef.current,
      findOne: () => null,
      width: () => Number(props.width ?? 800),
      height: () => Number(props.height ?? 600)
    };
    useImperativeHandle(ref, () => stage);
    const adapt = (handler: unknown) => (event: React.PointerEvent<HTMLDivElement>) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      (handler as ((value: unknown) => void) | undefined)?.({
        evt: event.nativeEvent,
        target: { getStage: () => stage }
      });
    };
    const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, ...rest } = props;
    return createElement("div", {
      ...rest,
      ref: elementRef,
      "data-konva": "Stage",
      onPointerDown: adapt(onPointerDown),
      onPointerMove: adapt(onPointerMove),
      onPointerUp: adapt(onPointerUp),
      onPointerCancel: adapt(onPointerCancel)
    });
  });
  return {
    Stage,
    Layer: component("Layer"),
    Line: component("Line"),
    Rect: component("Rect"),
    Circle: component("Circle"),
    Ellipse: component("Ellipse"),
    RegularPolygon: component("RegularPolygon"),
    Shape: component("Shape"),
    Star: component("Star"),
    Arrow: component("Arrow"),
    Group: component("Group"),
    Image: component("Image"),
    Text: component("Text"),
    Transformer: component("Transformer")
  };
});
