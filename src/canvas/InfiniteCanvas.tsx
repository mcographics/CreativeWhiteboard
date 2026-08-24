import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Arrow, Ellipse, Group, Image as KonvaImage, Layer, Line, Rect, RegularPolygon, Stage, Star, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { Minus, Palette, Plus, RefreshCw } from "lucide-react";
import type { BoardObject, ShapeObject, StrokeObject } from "../models/whiteboard";
import { useBoardStore } from "../state/boardStore";
import { useCameraStore } from "../state/cameraStore";
import { useToolStore } from "../state/toolStore";
import { canvasRegistry } from "../services/canvasRegistry";
import { FloatingDocuments } from "../components/FloatingDocuments";
import { useUiStore } from "../state/uiStore";
import { importDroppedFiles } from "../services/importService";
import { useResolvedAppearance } from "../hooks/useResolvedAppearance";
import { useNotificationStore } from "../state/notificationStore";
import { isPenPointer, isStylusEraser, normalizedPenPressure, pressureStrokeWidth } from "../services/stylus";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 32;
type InlineEditor = {
  kind: "text" | "comment" | "sticky"; x: number; y: number; width: number; height: number;
  value: string; objectId?: string; focusId: string; backgroundColor: string; fontFamily: string; fontSize: number; bold: boolean; italic: boolean; underline: boolean;
};
const defaultFormatting = { fontFamily: "Arial", fontSize: 17, bold: false, italic: false, underline: false };
const fallbackFontFamilies = ["Arial", "Calibri", "Georgia", "Segoe Print", "Segoe UI", "Times New Roman", "Verdana"];
const stickyNoteColors = ["#fff3a6", "#ffd8a8", "#ffd6e7", "#e5d5ff", "#ddebff", "#d9f7be", "#e2e8f0"];

function readableNoteText(backgroundColor: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(backgroundColor);
  if (!match?.[1]) return "#29220d";
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance < 145 ? "#ffffff" : "#29220d";
}

export function InfiniteCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const drawingRef = useRef<StrokeObject | null>(null);
  const draftRef = useRef<BoardObject | null>(null);
  const marqueeRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const activePenPointerIdRef = useRef<number | null>(null);
  const lastPenInputAtRef = useRef(0);
  const eraserGestureRef = useRef(false);
  const pointerPanRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const objectDragRef = useRef(false);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [draft, setDraft] = useState<BoardObject | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [editor, setEditor] = useState<InlineEditor | null>(null);
  const [fontFamilies, setFontFamilies] = useState(fallbackFontFamilies);
  const [fontLoadState, setFontLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const handledTypingRequest = useRef<number | null>(null);
  const { objects, selectedIds, properties, toolProfiles, eraserSize, addObject, updateObject, commitObjectUpdate, deleteSelected, duplicateSelected, select, undo, redo } = useBoardStore();
  const { x, y, zoom, setCamera, zoomIn, zoomOut } = useCameraStore();
  const activeTool = useToolStore((state) => state.activeTool);
  const setActiveTool = useToolStore((state) => state.setActiveTool);
  const drawingProfile = activeTool === "pen" || activeTool === "brush" || activeTool === "highlighter" || activeTool === "marker" ? toolProfiles[activeTool] : properties;
  const gridVisible = useUiStore((state) => state.gridVisible);
  const minimapOpen = useUiStore((state) => state.minimapOpen);
  const stylusPressureEnabled = useUiStore((state) => state.stylusPressureEnabled);
  const palmRejectionEnabled = useUiStore((state) => state.palmRejectionEnabled);
  const typingRequest = useUiStore((state) => state.typingRequest);
  const resolvedAppearance = useResolvedAppearance();
  const notify = useNotificationStore((state) => state.show);
  const darkBoard = resolvedAppearance === "dark";
  const loadSystemFonts = useCallback(async (announce = false) => {
    if (fontLoadState === "loading") return;
    setFontLoadState("loading");
    try {
      const fonts = await window.desktopFonts?.listSystemFonts();
      if (!fonts?.length) throw new Error("System font enumeration is unavailable.");
      const sanitized = fonts
        .map((font) =>
          [...font]
            .filter((character) => {
              const codePoint = character.codePointAt(0) ?? 0;
              return codePoint > 31 && codePoint !== 127;
            })
            .join("")
            .trim()
            .replace(/^["']|["']$/g, "")
            .trim()
            .slice(0, 200),
        )
        .filter(Boolean);
      const nextFonts = [...new Set([...fallbackFontFamilies, ...sanitized])].sort((left, right) => left.localeCompare(right));
      setFontFamilies(nextFonts);
      setFontLoadState("loaded");
      if (announce) notify(`${nextFonts.length} installed font families loaded.`, "info");
    } catch {
      setFontLoadState("error");
      if (announce) notify("Installed fonts could not be loaded. The standard font list remains available.", "error");
    }
  }, [fontLoadState, notify]);

  const editorFocusId = editor?.focusId;
  useEffect(() => {
    if (!editorFocusId || fontLoadState !== "idle") return;
    const timeout = window.setTimeout(() => void loadSystemFonts(), 0);
    return () => window.clearTimeout(timeout);
  }, [editorFocusId, fontLoadState, loadSystemFonts]);

  useLayoutEffect(() => {
    if (!editorFocusId) return;
    editorRef.current?.focus({ preventScroll: true });
    const length = editorRef.current?.value.length ?? 0;
    editorRef.current?.setSelectionRange(length, length);
    const frame = requestAnimationFrame(() => editorRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [editorFocusId]);

  useEffect(() => {
    if (!typingRequest || handledTypingRequest.current === typingRequest.id) return;
    handledTypingRequest.current = typingRequest.id;
    const width = typingRequest.kind === "sticky" ? 250 : 280;
    const height = typingRequest.kind === "text" ? 90 : typingRequest.kind === "sticky" ? 210 : 170;
    setEditor({
      kind: typingRequest.kind,
      x: (size.width / 2 - x) / zoom - width / 2,
      y: (size.height / 2 - y) / zoom - height / 2,
      width,
      height,
      value: "",
      focusId: crypto.randomUUID(),
      backgroundColor: typingRequest.kind === "sticky" ? "#fff3a6" : "#ddebff",
      ...defaultFormatting,
      fontSize: typingRequest.kind === "text" ? 24 : 17
    });
  }, [typingRequest, size.width, size.height, x, y, zoom]);

  useEffect(() => {
    if (!hostRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    canvasRegistry.setStage(stageRef.current);
    return () => canvasRegistry.setStage(null);
  }, [size]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage || typeof transformer.nodes !== "function" || typeof stage.findOne !== "function") return;
    const unlockedIds = activeTool === "select"
      ? selectedIds.filter((id) => !objects.find((object) => object.id === id)?.locked)
      : [];
    transformer.nodes(unlockedIds.map((id) => stage.findOne(`#${id}`)).filter((node): node is Konva.Node => Boolean(node)));
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, objects, activeTool]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input,textarea,[contenteditable=true]")) return;
      if (event.code === "Space") { event.preventDefault(); setSpacePressed(true); }
      if (event.key === "Delete") deleteSelected();
      if (event.ctrlKey && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); }
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
      if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    };
    const keyup = (event: KeyboardEvent) => { if (event.code === "Space") setSpacePressed(false); };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); };
  }, [deleteSelected, duplicateSelected, redo, undo]);

  const pointerWorld = () => {
    const point = stageRef.current?.getPointerPosition() ?? { x: 0, y: 0 };
    return { x: (point.x - x) / zoom, y: (point.y - y) / zoom };
  };

  const eraseAt = useCallback((point: { x: number; y: number }) => {
    const target = [...useBoardStore.getState().objects].reverse().find((object) =>
      object.type !== "pdf" && object.type !== "document" && !object.locked &&
      eraserHitsObject(point, eraserSize / 2, object)
    );
    if (target) {
      useBoardStore.getState().removeObject(target.id);
    }
  }, [eraserSize]);

  const onPointerDown = (event: Konva.KonvaEventObject<PointerEvent>) => {
    const nativeEvent = event.evt;
    const penInput = isPenPointer(nativeEvent);
    if (nativeEvent.pointerType === "touch" && palmRejectionEnabled &&
        (activePenPointerIdRef.current !== null || performance.now() - lastPenInputAtRef.current < 700)) {
      nativeEvent.preventDefault();
      return;
    }
    if (penInput) {
      activePenPointerIdRef.current = nativeEvent.pointerId;
      lastPenInputAtRef.current = performance.now();
    }
    try { event.target.getStage()?.container().setPointerCapture(event.evt.pointerId); } catch { /* Pointer capture is best-effort. */ }
    const panWithLeftButton = event.evt.button === 0 && (activeTool === "hand" || spacePressed);
    if (event.evt.button === 1 || event.evt.button === 2 || panWithLeftButton) {
      event.evt.preventDefault();
      activePointerIdRef.current = event.evt.pointerId;
      pointerPanRef.current = { clientX: event.evt.clientX, clientY: event.evt.clientY, x, y };
      return;
    }
    if (event.target === event.target.getStage()) {
      select(null);
      if (activeTool === "select") {
        activePointerIdRef.current = event.evt.pointerId;
        const point = pointerWorld();
        marqueeStart.current = point;
        const nextMarquee = { x: point.x, y: point.y, width: 0, height: 0 };
        marqueeRef.current = nextMarquee;
        setMarquee(nextMarquee);
        return;
      }
    }
    const point = pointerWorld();
    if ((activeTool === "eraser" && event.evt.button === 0) || isStylusEraser(nativeEvent)) {
      activePointerIdRef.current = event.evt.pointerId;
      eraserGestureRef.current = true;
      setEraserCursor(point);
      eraseAt(point);
      return;
    }
    if (activeTool === "pen" || activeTool === "brush" || activeTool === "highlighter" || activeTool === "marker" || activeTool === "underline") {
      activePointerIdRef.current = event.evt.pointerId;
      const stroke: StrokeObject = {
        id: crypto.randomUUID(), type: "stroke", x: 0, y: 0, width: 0, height: 0, rotation: 0,
        opacity: drawingProfile.opacity,
        locked: false, points: [point.x, point.y], color: drawingProfile.strokeColor,
        pressures: penInput && stylusPressureEnabled ? [normalizedPenPressure(nativeEvent)] : undefined,
        inputType: nativeEvent.pointerType === "pen" || nativeEvent.pointerType === "touch" ? nativeEvent.pointerType : "mouse",
        strokeWidth: drawingProfile.strokeWidth,
        mode: activeTool === "brush" ? "brush" : activeTool === "highlighter" ? "highlighter" : activeTool === "marker" ? "marker" : "pen",
        smooth: drawingProfile.smoothInk
      };
      drawingRef.current = stroke;
      draftRef.current = stroke;
      setDraft(stroke);
    } else if (activeTool === "text") {
      setEditor({ kind: "text", x: point.x, y: point.y, width: 280, height: 90, value: "", focusId: crypto.randomUUID(), backgroundColor: "#ffffff", ...defaultFormatting, fontSize: 24 });
    } else if (activeTool === "comment") {
      setEditor({ kind: "comment", x: point.x, y: point.y, width: 280, height: 170, value: "", focusId: crypto.randomUUID(), backgroundColor: "#ddebff", ...defaultFormatting });
    } else if (activeTool === "sticky-note") {
      setEditor({ kind: "sticky", x: point.x, y: point.y, width: 250, height: 210, value: "", focusId: crypto.randomUUID(), backgroundColor: "#fff3a6", ...defaultFormatting });
    } else if (["rectangle", "ellipse", "triangle", "star", "shapes", "arrow", "badge"].includes(activeTool)) {
      activePointerIdRef.current = event.evt.pointerId;
      shapeStart.current = point;
      const shapeType: ShapeObject["type"] =
        activeTool === "shapes" || activeTool === "triangle" ? "triangle" :
        activeTool === "star" ? "star" :
        activeTool === "arrow" ? "arrow" :
        activeTool === "badge" ? "badge" :
        activeTool === "ellipse" ? "ellipse" : "rectangle";
      const shape = makeShape(shapeType, point.x, point.y, properties);
      draftRef.current = shape;
      setDraft(shape);
    }
  };

  const commitEditor = () => {
    if (!editor) return;
    const value = editor.value.trim();
    let editedObjectId = editor.objectId;
    if (editor.objectId) {
      if (value) updateObject(editor.objectId, editor.kind === "text"
        ? { text: value, fontFamily: editor.fontFamily, fontSize: editor.fontSize, bold: editor.bold, italic: editor.italic, underline: editor.underline }
        : {
            note: value,
            backgroundColor: editor.kind === "sticky" ? editor.backgroundColor : "#ddebff",
            color: editor.kind === "sticky" ? readableNoteText(editor.backgroundColor) : "#15263a",
            fontFamily: editor.fontFamily,
            fontSize: editor.fontSize,
            bold: editor.bold,
            italic: editor.italic,
            underline: editor.underline
          });
    } else if (value) {
      editedObjectId = crypto.randomUUID();
      if (editor.kind === "text") {
        addObject({ id: editedObjectId, type: "text", x: editor.x, y: editor.y, width: editor.width, height: editor.height, rotation: 0, opacity: properties.opacity, locked: false, text: value, color: properties.strokeColor, fontSize: editor.fontSize, fontFamily: editor.fontFamily, bold: editor.bold, italic: editor.italic, underline: editor.underline });
      } else {
        addObject({
          id: editedObjectId, type: "note", variant: editor.kind, x: editor.x, y: editor.y,
          width: editor.width, height: editor.height, rotation: 0, opacity: 1, locked: false,
          note: value, color: editor.kind === "comment" ? "#15263a" : readableNoteText(editor.backgroundColor),
          backgroundColor: editor.kind === "comment" ? "#ddebff" : editor.backgroundColor, fontSize: editor.fontSize,
          fontFamily: editor.fontFamily, bold: editor.bold, italic: editor.italic, underline: editor.underline
        });
      }
    }
    if (editedObjectId) select(editedObjectId);
    setEditor(null);
    setActiveTool("select");
  };

  const cancelEditor = () => {
    setEditor(null);
    setActiveTool("select");
  };

  const beginEditorDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editor || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = { clientX: event.clientX, clientY: event.clientY, x: editor.x, y: editor.y };
    const move = (moveEvent: PointerEvent) => {
      const liveZoom = useCameraStore.getState().zoom;
      setEditor((current) => current ? {
        ...current,
        x: start.x + (moveEvent.clientX - start.clientX) / liveZoom,
        y: start.y + (moveEvent.clientY - start.clientY) / liveZoom
      } : current);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      editorRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
  };

  const onPointerMove = (event: Konva.KonvaEventObject<PointerEvent>) => {
    if (pointerPanRef.current) {
      setCamera({
        x: pointerPanRef.current.x + event.evt.clientX - pointerPanRef.current.clientX,
        y: pointerPanRef.current.y + event.evt.clientY - pointerPanRef.current.clientY
      });
      return;
    }
    const point = pointerWorld();
    if (activeTool === "eraser" || eraserGestureRef.current) {
      setEraserCursor(point);
      return;
    }
    if (marqueeStart.current) {
      const start = marqueeStart.current;
      const nextMarquee = { x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) };
      marqueeRef.current = nextMarquee;
      setMarquee(nextMarquee);
    }
  };

  const onPointerUp = useCallback((event?: Event) => {
    if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent &&
        activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
    if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent && event.pointerType === "pen") {
      activePenPointerIdRef.current = null;
      lastPenInputAtRef.current = performance.now();
    }
    if (pointerPanRef.current) {
      pointerPanRef.current = null;
      activePointerIdRef.current = null;
      return;
    }
    const completedMarquee = marqueeRef.current;
    if (completedMarquee) {
      const matchingIds = objects.filter((object) =>
        object.x <= completedMarquee.x + completedMarquee.width && object.x + Math.max(object.width, 1) >= completedMarquee.x &&
        object.y <= completedMarquee.y + completedMarquee.height && object.y + Math.max(object.height, 1) >= completedMarquee.y
      ).map((object) => object.id);
      useBoardStore.setState({ selectedIds: matchingIds });
    }
    const completedDraft = draftRef.current;
    const isShapeDraft = completedDraft && ["rectangle", "ellipse", "triangle", "star", "arrow", "badge", "comment"].includes(completedDraft.type);
    const hasDrawableSize = !isShapeDraft || (completedDraft.width >= 4 && completedDraft.height >= 4);
    if (completedDraft && hasDrawableSize) {
      addObject(completedDraft);
      if (isShapeDraft) {
        setActiveTool("select");
      }
    }
    drawingRef.current = null;
    draftRef.current = null;
    shapeStart.current = null;
    marqueeStart.current = null;
    marqueeRef.current = null;
    activePointerIdRef.current = null;
    eraserGestureRef.current = false;
    setDraft(null);
    setMarquee(null);
  }, [addObject, objects, setActiveTool]);

  useEffect(() => {
    const continueActiveGesture = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return;
      if (pointerPanRef.current) {
        setCamera({
          x: pointerPanRef.current.x + event.clientX - pointerPanRef.current.clientX,
          y: pointerPanRef.current.y + event.clientY - pointerPanRef.current.clientY
        });
        return;
      }
      const stage = stageRef.current;
      if (!stage) return;
      stage.setPointersPositions(event);
      const screenPoint = stage.getPointerPosition();
      if (!screenPoint) return;
      const camera = useCameraStore.getState();
      const point = { x: (screenPoint.x - camera.x) / camera.zoom, y: (screenPoint.y - camera.y) / camera.zoom };
      if (useToolStore.getState().activeTool === "eraser" || eraserGestureRef.current) {
        setEraserCursor(point);
        eraseAt(point);
        return;
      }
      if (drawingRef.current) {
        const tool = useToolStore.getState().activeTool;
        const coalesced = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
        const samples = coalesced.length ? coalesced : [event];
        let points = drawingRef.current.points;
        let pressures = drawingRef.current.pressures;
        for (const sample of samples) {
          stage.setPointersPositions(sample);
          const sampleScreenPoint = stage.getPointerPosition();
          if (!sampleScreenPoint) continue;
          const samplePoint = { x: (sampleScreenPoint.x - camera.x) / camera.zoom, y: (sampleScreenPoint.y - camera.y) / camera.zoom };
          points = tool === "underline"
            ? [points[0] ?? samplePoint.x, points[1] ?? samplePoint.y, samplePoint.x, samplePoint.y]
            : [...points, samplePoint.x, samplePoint.y];
          if (pressures) pressures = [...pressures, normalizedPenPressure(sample)];
        }
        drawingRef.current = { ...drawingRef.current, points, pressures };
        draftRef.current = drawingRef.current;
        setDraft(drawingRef.current);
        return;
      }
      if (!shapeStart.current || !draftRef.current || draftRef.current.type === "stroke" || draftRef.current.type === "text") return;
      const start = shapeStart.current;
      const nextDraft = {
        ...draftRef.current,
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y)
      };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
    };
    window.addEventListener("pointermove", continueActiveGesture, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    window.addEventListener("blur", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", continueActiveGesture, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      window.removeEventListener("blur", onPointerUp);
    };
  }, [eraseAt, onPointerUp, setCamera]);

  const onWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    if (objectDragRef.current) return;
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    const world = { x: (pointer.x - x) / zoom, y: (pointer.y - y) / zoom };
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (event.evt.deltaY > 0 ? 0.9 : 1.1)));
    setCamera({ zoom: nextZoom, x: pointer.x - world.x * nextZoom, y: pointer.y - world.y * nextZoom });
  };

  const displayed = draft ? [...objects, draft] : objects;
  const editorFontFamilies = editor
    ? [...new Set([editor.fontFamily, ...fontFamilies])].sort((left, right) => left.localeCompare(right))
    : fontFamilies;
  const gridStep = 24 * zoom;
  const gridLines = [];
  if (gridVisible && gridStep >= 6) {
    const startX = ((x % gridStep) + gridStep) % gridStep;
    const startY = ((y % gridStep) + gridStep) % gridStep;
    for (let screenX = startX; screenX <= size.width; screenX += gridStep) {
      gridLines.push(<Line key={`grid-x-${screenX}`} points={[screenX, 0, screenX, size.height]} stroke={darkBoard ? "#59616a" : "#aeb5be"} strokeWidth={1} listening={false} />);
    }
    for (let screenY = startY; screenY <= size.height; screenY += gridStep) {
      gridLines.push(<Line key={`grid-y-${screenY}`} points={[0, screenY, size.width, screenY]} stroke={darkBoard ? "#59616a" : "#aeb5be"} strokeWidth={1} listening={false} />);
    }
  }
  return (
    <div className={`canvas-region ${gridVisible ? "grid-visible" : ""} ${activeTool === "hand" ? "pan-mode" : ""} ${["rectangle", "ellipse", "triangle", "star", "arrow", "badge", "shapes"].includes(activeTool) ? "shape-mode" : ""}`} ref={hostRef} aria-label="Infinite whiteboard canvas"
      style={{ backgroundSize: `${24 * zoom}px ${24 * zoom}px`, backgroundPosition: `${x}px ${y}px` }}
      onContextMenu={(event) => event.preventDefault()}
      onAuxClick={(event) => event.preventDefault()}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
      onDrop={(event) => {
        event.preventDefault();
        void importDroppedFiles(event.dataTransfer.files).catch((error: unknown) =>
          notify(error instanceof Error ? error.message : "The dropped files could not be imported.", "error")
        );
      }}>
      <Stage ref={stageRef} width={size.width} height={size.height} x={x} y={y} scaleX={zoom} scaleY={zoom}
        draggable={false}
        onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={(event) => onPointerUp(event.evt)} onPointerCancel={(event) => onPointerUp(event.evt)}>
        <Layer x={-x / zoom} y={-y / zoom} scaleX={1 / zoom} scaleY={1 / zoom} listening={false}>
          <Rect width={size.width} height={size.height} fill={darkBoard ? "#171a1d" : "#ffffff"} listening={false} />
          {gridLines}
        </Layer>
        <Layer>
          {displayed.filter((object) => object.type !== "pdf" && object.type !== "document").map((object) => <BoardNode key={object.id} object={object} movable={activeTool === "select"} selected={selectedIds.includes(object.id)} onSelect={(additive) => select(object.id, additive)} onChange={(patch, record) => updateObject(object.id, patch, record)} onCommit={(patch, previousPatch) => commitObjectUpdate(object.id, patch, previousPatch)} onDragState={(dragging) => { objectDragRef.current = dragging; }} onEdit={() => {
            setActiveTool("select");
            if (object.type === "text") setEditor({ kind: "text", x: object.x, y: object.y, width: object.width, height: object.height, value: object.text, objectId: object.id, focusId: crypto.randomUUID(), backgroundColor: "#ffffff", fontFamily: object.fontFamily ?? "Arial", fontSize: object.fontSize, bold: object.bold ?? false, italic: object.italic ?? false, underline: object.underline ?? false });
            if (object.type === "note") setEditor({ kind: object.variant ?? "sticky", x: object.x, y: object.y, width: object.width, height: object.height, value: object.note, objectId: object.id, focusId: crypto.randomUUID(), backgroundColor: object.backgroundColor, fontFamily: object.fontFamily ?? "Arial", fontSize: object.fontSize, bold: object.bold ?? false, italic: object.italic ?? false, underline: object.underline ?? false });
          }} erasing={activeTool === "eraser"} onErase={() => useBoardStore.getState().removeObject(object.id)} />)}
          {marquee && <Rect {...marquee} fill="#1685ea22" stroke="#1685ea" strokeWidth={1 / zoom} dash={[6 / zoom, 4 / zoom]} listening={false} />}
          {activeTool === "eraser" && eraserCursor && <Ellipse x={eraserCursor.x} y={eraserCursor.y} radiusX={eraserSize / 2} radiusY={eraserSize / 2} fill="#ffffff22" stroke="#64748b" strokeWidth={1 / zoom} listening={false} />}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            enabledAnchors={["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]}
            keepRatio={false}
            flipEnabled={false}
            anchorSize={10 / zoom}
            anchorCornerRadius={2 / zoom}
            anchorFill="#ffffff"
            anchorStroke="#1685ea"
            anchorStrokeWidth={1.5 / zoom}
            borderStroke="#1685ea"
            borderStrokeWidth={1 / zoom}
            rotateAnchorOffset={24 / zoom}
            boundBoxFunc={(oldBox, nextBox) =>
              Math.abs(nextBox.width) < 8 / zoom || Math.abs(nextBox.height) < 8 / zoom ? oldBox : nextBox
            }
          />
        </Layer>
      </Stage>
      {editor && <>
      <div
        className="text-format-toolbar"
        role="dialog"
        aria-label="Text formatting"
        style={{ left: Math.max(8, x + editor.x * zoom), top: Math.max(8, y + editor.y * zoom - 43) }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <select aria-label="Font family" value={editor.fontFamily} onChange={(event) => setEditor({ ...editor, fontFamily: event.target.value })}>
          {editorFontFamilies.map((font) => <option value={font} key={font} style={{ fontFamily: font }}>{font}</option>)}
        </select>
        <button
          type="button"
          className="system-font-refresh"
          aria-label="Refresh system fonts"
          title={fontLoadState === "loading" ? "Loading installed fonts…" : fontLoadState === "loaded" ? `${fontFamilies.length} installed fonts available` : "Load installed system fonts"}
          disabled={fontLoadState === "loading"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { void loadSystemFonts(true); editorRef.current?.focus(); }}
        ><RefreshCw size={14} className={fontLoadState === "loading" ? "is-spinning" : ""} /></button>
        <label><span className="sr-only">Font size</span><input aria-label="Font size" type="number" min="8" max="144" value={editor.fontSize} onChange={(event) => setEditor({ ...editor, fontSize: Math.min(144, Math.max(8, Number(event.target.value) || 8)) })} /></label>
        <button type="button" className={editor.bold ? "active" : ""} aria-label="Bold" aria-pressed={editor.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => { setEditor({ ...editor, bold: !editor.bold }); editorRef.current?.focus(); }}><strong>B</strong></button>
        <button type="button" className={editor.italic ? "active" : ""} aria-label="Italic" aria-pressed={editor.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => { setEditor({ ...editor, italic: !editor.italic }); editorRef.current?.focus(); }}><em>I</em></button>
        <button type="button" className={editor.underline ? "active" : ""} aria-label="Underline" aria-pressed={editor.underline} onMouseDown={(event) => event.preventDefault()} onClick={() => { setEditor({ ...editor, underline: !editor.underline }); editorRef.current?.focus(); }}><u>U</u></button>
        {editor.kind === "sticky" && <div className="sticky-color-controls" aria-label="Sticky note colors">
          {stickyNoteColors.map((color) => <button
            type="button"
            key={color}
            className={editor.backgroundColor.toLowerCase() === color ? "active" : ""}
            aria-label={`Set sticky note color ${color}`}
            aria-pressed={editor.backgroundColor.toLowerCase() === color}
            style={{ backgroundColor: color }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => { setEditor({ ...editor, backgroundColor: color }); editorRef.current?.focus(); }}
          />)}
          <label className="sticky-custom-color" aria-label="Custom sticky note color" title="Custom sticky note color">
            <Palette size={14} aria-hidden="true" />
            <input type="color" aria-label="Sticky note color picker" value={editor.backgroundColor} onChange={(event) => setEditor({ ...editor, backgroundColor: event.target.value })} />
          </label>
        </div>}
      </div>
      <div
        className={`canvas-editor-shell ${editor.kind === "text" ? "text" : "note"} ${editor.kind}`}
        style={{ left: x + editor.x * zoom, top: y + editor.y * zoom, width: editor.width * zoom, height: editor.height * zoom, ...(editor.kind === "sticky" ? { backgroundColor: editor.backgroundColor, color: readableNoteText(editor.backgroundColor) } : {}) }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="editor-move-lip"
          aria-label={`Move ${editor.kind === "sticky" ? "sticky note" : editor.kind} editor`}
          title="Drag to move"
          onPointerDown={beginEditorDrag}
        />
        <textarea
          ref={editorRef}
          className="canvas-inline-editor"
          aria-label={editor.kind === "text" ? "Canvas text editor" : editor.kind === "sticky" ? "Sticky note editor" : "Comment note editor"}
          placeholder={editor.kind === "text" ? "Type text…" : editor.kind === "sticky" ? "Write a reminder…" : "Leave a comment or note…"}
          value={editor.value}
          style={{ fontSize: editor.fontSize * zoom, fontFamily: editor.fontFamily, fontWeight: editor.bold ? 700 : 400, fontStyle: editor.italic ? "italic" : "normal", textDecoration: editor.underline ? "underline" : "none" }}
          spellCheck
          autoFocus
          onPointerDown={(event) => { event.stopPropagation(); editorRef.current?.focus(); }}
          onClick={(event) => { event.stopPropagation(); editorRef.current?.focus(); }}
          onChange={(event) => setEditor({ ...editor, value: event.target.value })}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") { event.preventDefault(); cancelEditor(); }
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); commitEditor(); }
          }}
        />
        <div className="canvas-editor-actions">
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={cancelEditor}>Cancel</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={commitEditor}>Done</button>
        </div>
      </div></>}
      <FloatingDocuments />
      {minimapOpen && <MiniMap objects={objects} camera={{ x, y, zoom }} viewport={size} onMove={(nextX, nextY) => setCamera({ x: nextX, y: nextY })} />}
      <div className="canvas-zoom"><button onClick={zoomOut}><Minus size={14}/></button><output>{Math.round(zoom * 100)}%</output><button onClick={zoomIn}><Plus size={14}/></button></div>
    </div>
  );
}

function makeShape(type: ShapeObject["type"], x: number, y: number, properties: ReturnType<typeof useBoardStore.getState>["properties"]): ShapeObject {
  return { id: crypto.randomUUID(), type, x, y, width: 1, height: 1, rotation: 0, opacity: properties.opacity, locked: false, strokeColor: properties.strokeColor, fillColor: properties.fillShapes ? properties.fillColor : "transparent", strokeWidth: properties.strokeWidth };
}

function eraserHitsObject(point: { x: number; y: number }, radius: number, object: BoardObject) {
  if (object.type === "stroke") {
    for (let index = 0; index <= object.points.length - 4; index += 2) {
      const start = { x: object.x + (object.points[index] ?? 0), y: object.y + (object.points[index + 1] ?? 0) };
      const end = { x: object.x + (object.points[index + 2] ?? 0), y: object.y + (object.points[index + 3] ?? 0) };
      if (distanceToSegment(point, start, end) <= radius + object.strokeWidth / 2) return true;
    }
    const firstX = object.points[0];
    const firstY = object.points[1];
    return firstX !== undefined && firstY !== undefined &&
      Math.hypot(point.x - object.x - firstX, point.y - object.y - firstY) <= radius + object.strokeWidth / 2;
  }
  return point.x >= object.x - radius &&
    point.x <= object.x + object.width + radius &&
    point.y >= object.y - radius &&
    point.y <= object.y + object.height + radius;
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}

function CornerMoveLip({ objectId, x }: { objectId: string; x: number }) {
  return <Group
    x={x}
    y={0}
    name={`move-lip-${objectId}`}
    onMouseEnter={(event: Konva.KonvaEventObject<MouseEvent>) => {
      event.target.getStage()!.container().style.cursor = "grab";
    }}
    onMouseLeave={(event: Konva.KonvaEventObject<MouseEvent>) => {
      event.target.getStage()!.container().style.cursor = "move";
    }}
    onMouseDown={(event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      const parent = event.currentTarget.getParent();
      if (parent?.draggable()) parent.startDrag({ evt: event.evt });
    }}
  >
    <Line points={[0, 0, 20, 0, 20, 20]} closed fill="#1685ea" stroke="#ffffff" strokeWidth={1} />
    <Line points={[8, 5, 15, 5, 15, 12]} stroke="#ffffff" strokeWidth={1.5} lineCap="round" lineJoin="round" listening={false} />
  </Group>;
}

function BoardNode({ object, selected, movable, onSelect, onChange, onCommit, onEdit, onDragState, erasing, onErase }: { object: BoardObject; selected: boolean; movable: boolean; onSelect: (additive: boolean) => void; onChange: (patch: Partial<BoardObject>, record?: boolean) => void; onCommit: (patch: Partial<BoardObject>, previousPatch: Partial<BoardObject>) => void; onEdit: () => void; onDragState: (dragging: boolean) => void; erasing: boolean; onErase: () => void }) {
  const dragStartRef = useRef({ x: object.x, y: object.y });
  const [hovered, setHovered] = useState(false);
  const showMoveLip = movable && !object.locked && (selected || hovered) && (object.type === "text" || object.type === "note");
  const common = {
    id: object.id, x: object.x, y: object.y, rotation: object.rotation, opacity: object.opacity,
    draggable: movable && !object.locked && !erasing,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => erasing ? onErase() : onSelect(event.evt.shiftKey),
    onTap: () => erasing ? onErase() : onSelect(false),
    onDblClick: () => { if (object.type === "text" || object.type === "note") onEdit(); },
    onDragStart: (event: Konva.KonvaEventObject<DragEvent>) => {
      dragStartRef.current = { x: object.x, y: object.y };
      onSelect(false);
      onDragState(true);
      event.target.getStage()!.container().style.cursor = "grabbing";
    },
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
      onChange({ x: event.target.x(), y: event.target.y() }, false);
    },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onCommit({ x: event.target.x(), y: event.target.y() }, dragStartRef.current);
      onDragState(false);
      event.target.getStage()!.container().style.cursor = "default";
    },
    onMouseEnter: (event: Konva.KonvaEventObject<MouseEvent>) => {
      setHovered(true);
      if (!object.locked && !erasing) event.target.getStage()!.container().style.cursor = "move";
    },
    onMouseLeave: (event: Konva.KonvaEventObject<MouseEvent>) => {
      setHovered(false);
      event.target.getStage()!.container().style.cursor = "default";
    },
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.target; const scaleX = node.scaleX(); const scaleY = node.scaleY(); node.scaleX(1); node.scaleY(1);
      if (object.type === "stroke") {
        const points = object.points.map((point, index) => point * (index % 2 === 0 ? scaleX : scaleY));
        const xs = points.filter((_point, index) => index % 2 === 0);
        const ys = points.filter((_point, index) => index % 2 === 1);
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(5, Math.max(...xs) - Math.min(...xs)),
          height: Math.max(5, Math.max(...ys) - Math.min(...ys)),
          points,
          rotation: node.rotation()
        });
        return;
      }
      onChange({ x: node.x(), y: node.y(), width: Math.max(5, object.width * scaleX), height: Math.max(5, object.height * scaleY), rotation: node.rotation() });
    }
  };
  if (object.type === "stroke") {
    const pressures = object.pressures;
    if (object.mode !== "highlighter" && pressures && pressures.length === object.points.length / 2 && pressures.length > 1) {
      return <Group {...common}>
        <Line points={object.points} stroke="#00000001" strokeWidth={Math.max(10, object.strokeWidth * 1.7)} lineCap="round" lineJoin="round" />
        {pressures.slice(1).map((pressure, index) => {
          const pointIndex = index * 2;
          const previousPressure = pressures[index] ?? pressure;
          return <Line
            key={`${object.id}-pressure-${index}`}
            points={[
              object.points[pointIndex] ?? 0,
              object.points[pointIndex + 1] ?? 0,
              object.points[pointIndex + 2] ?? 0,
              object.points[pointIndex + 3] ?? 0
            ]}
            stroke={object.color}
            strokeWidth={pressureStrokeWidth(object.strokeWidth, object.mode, (previousPressure + pressure) / 2)}
            lineCap={object.mode === "marker" ? "square" : "round"}
            lineJoin="round"
            listening={false}
          />;
        })}
      </Group>;
    }
    return <Line {...common} points={object.points} stroke={object.color} strokeWidth={object.strokeWidth} lineCap={object.mode === "marker" ? "square" : "round"} lineJoin="round" tension={object.smooth ? 0.25 : 0} globalCompositeOperation={object.mode === "highlighter" ? "multiply" : "source-over"} />;
  }
  if (object.type === "image") return <LoadedImage object={object} common={common} />;
  if (object.type === "text") return <Group {...common}>
    {(selected || hovered) && <Rect width={object.width} height={object.height} stroke="#1685ea" strokeWidth={1} dash={[5, 4]} fill="transparent" listening={false} />}
    <Text text={object.text} fill={object.color} fontSize={object.fontSize} fontFamily={object.fontFamily ?? "Arial"} fontStyle={`${object.bold ? "bold" : ""} ${object.italic ? "italic" : ""}`.trim() || "normal"} textDecoration={object.underline ? "underline" : ""} width={object.width} height={object.height} />
    {showMoveLip && <CornerMoveLip objectId={object.id} x={object.width - 20} />}
  </Group>;
  if (object.type === "note") return <Group {...common}>
    <Rect width={object.width} height={object.height} cornerRadius={4} fill={object.backgroundColor} stroke={selected || hovered ? "#1685ea" : "#d1b94f"} strokeWidth={selected || hovered ? 2 : 1.5} shadowColor="#000" shadowBlur={8} shadowOpacity={.16}/>
    <Text x={14} y={12} width={object.width - 28} height={object.height - 24} text={object.note} fill={object.color} fontSize={object.fontSize} fontFamily={object.fontFamily ?? "Arial"} fontStyle={`${object.bold ? "bold" : ""} ${object.italic ? "italic" : ""}`.trim() || "normal"} textDecoration={object.underline ? "underline" : ""} lineHeight={1.35}/>
    {showMoveLip && <CornerMoveLip objectId={object.id} x={object.width - 20} />}
  </Group>;
  if (!("fillColor" in object)) return null;
  if (object.type === "ellipse") return <Group {...common}><Ellipse x={object.width / 2} y={object.height / 2} radiusX={object.width / 2} radiusY={object.height / 2} fill={object.fillColor} stroke={object.strokeColor} strokeWidth={object.strokeWidth} /></Group>;
  if (object.type === "triangle") return <Group {...common}><RegularPolygon x={object.width / 2} y={object.height / 2} sides={3} radius={Math.max(object.width, object.height) / 2} fill={object.fillColor} stroke={object.strokeColor} strokeWidth={object.strokeWidth} /></Group>;
  if (object.type === "star") return <Group {...common}><Star x={object.width / 2} y={object.height / 2} numPoints={5} innerRadius={Math.min(object.width, object.height) / 4} outerRadius={Math.min(object.width, object.height) / 2} fill={object.fillColor} stroke={object.strokeColor} strokeWidth={object.strokeWidth} /></Group>;
  if (object.type === "arrow") return <Arrow {...common} points={[0, 0, object.width, object.height]} stroke={object.strokeColor} fill={object.strokeColor} strokeWidth={object.strokeWidth} pointerLength={14} pointerWidth={12} />;
  if (object.type === "badge") return <Group {...common}><RegularPolygon x={object.width / 2} y={object.height / 2} sides={8} radius={Math.min(object.width, object.height) / 2} fill={object.fillColor} stroke={object.strokeColor} strokeWidth={object.strokeWidth} /></Group>;
  if (object.type === "comment") return <Group {...common}><Rect width={object.width} height={object.height * .8} cornerRadius={Math.min(18, object.height / 4)} fill={object.fillColor} stroke={object.strokeColor} strokeWidth={object.strokeWidth}/><Line points={[object.width * .2, object.height * .8, object.width * .12, object.height, object.width * .38, object.height * .8]} closed fill={object.fillColor} stroke={object.strokeColor} strokeWidth={object.strokeWidth}/></Group>;
  return <Rect {...common} width={object.width} height={object.height} fill={object.fillColor} stroke={object.strokeColor} strokeWidth={object.strokeWidth} />;
}

function LoadedImage({ object, common }: { object: Extract<BoardObject, { type: "image" }>; common: Record<string, unknown> }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const nextImage = new Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = object.dataUrl;
    return () => { nextImage.onload = null; };
  }, [object.dataUrl]);
  return <KonvaImage {...common} image={image ?? undefined} width={object.width} height={object.height} />;
}

function MiniMap({ objects, camera, viewport, onMove }: { objects: BoardObject[]; camera: { x: number; y: number; zoom: number }; viewport: { width: number; height: number }; onMove: (x: number, y: number) => void }) {
  const viewportBounds = {
    minX: -camera.x / camera.zoom,
    minY: -camera.y / camera.zoom,
    maxX: (-camera.x + viewport.width) / camera.zoom,
    maxY: (-camera.y + viewport.height) / camera.zoom
  };
  const bounds = objects.reduce((box, object) => ({
    minX: Math.min(box.minX, object.x),
    minY: Math.min(box.minY, object.y),
    maxX: Math.max(box.maxX, object.x + Math.max(object.width, 20)),
    maxY: Math.max(box.maxY, object.y + Math.max(object.height, 20))
  }), viewportBounds);
  const scale = Math.min(190 / Math.max(1, bounds.maxX - bounds.minX), 145 / Math.max(1, bounds.maxY - bounds.minY));
  return <div className="minimap functional-minimap" aria-label="Minimap" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const worldX = bounds.minX + (event.clientX - rect.left) / scale; const worldY = bounds.minY + (event.clientY - rect.top) / scale; onMove(viewport.width / 2 - worldX * camera.zoom, viewport.height / 2 - worldY * camera.zoom); }}>
    {objects.map((object) => <i key={object.id} style={{ left: (object.x - bounds.minX) * scale, top: (object.y - bounds.minY) * scale, width: Math.max(3, object.width * scale), height: Math.max(3, object.height * scale) }} />)}
    <b style={{ left: ((-camera.x / camera.zoom) - bounds.minX) * scale, top: ((-camera.y / camera.zoom) - bounds.minY) * scale, width: viewport.width / camera.zoom * scale, height: viewport.height / camera.zoom * scale }} />
  </div>;
}
