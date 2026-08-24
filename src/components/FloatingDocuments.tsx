import { ChevronLeft, ChevronRight, Copy, Lock, LockOpen, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DocumentObject } from "../models/whiteboard";
import { useBoardStore } from "../state/boardStore";
import { useCameraStore } from "../state/cameraStore";

const resizeDirections = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type ResizeDirection = typeof resizeDirections[number];

export function FloatingDocuments() {
  const objects = useBoardStore((state) => state.objects);
  const documents = objects.filter((object): object is DocumentObject => object.type === "pdf" || object.type === "document");
  const updateObject = useBoardStore((state) => state.updateObject);
  const commitObjectUpdate = useBoardStore((state) => state.commitObjectUpdate);
  const removeObject = useBoardStore((state) => state.removeObject);
  const duplicateSelected = useBoardStore((state) => state.duplicateSelected);
  const select = useBoardStore((state) => state.select);
  const selectedIds = useBoardStore((state) => state.selectedIds);
  const camera = useCameraStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  const beginDrag = (event: ReactPointerEvent, document: DocumentObject) => {
    if (document.locked || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    event.stopPropagation();
    const captureTarget = event.currentTarget;
    captureTarget.setPointerCapture(event.pointerId);
    select(document.id);
    setDraggingId(document.id);
    const start = {
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: camera.x + document.x * camera.zoom,
      screenY: camera.y + document.y * camera.zoom
    };
    const move = (moveEvent: PointerEvent) => {
      const liveCamera = useCameraStore.getState();
      const nextScreenX = start.screenX + moveEvent.clientX - start.clientX;
      const nextScreenY = start.screenY + moveEvent.clientY - start.clientY;
      updateObject(document.id, {
        x: (nextScreenX - liveCamera.x) / liveCamera.zoom,
        y: (nextScreenY - liveCamera.y) / liveCamera.zoom
      }, false);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      if (captureTarget.hasPointerCapture(event.pointerId)) captureTarget.releasePointerCapture(event.pointerId);
      setDraggingId(null);
      const current = useBoardStore.getState().objects.find((object) => object.id === document.id);
      if (current && (current.x !== document.x || current.y !== document.y)) {
        commitObjectUpdate(document.id, { x: current.x, y: current.y }, { x: document.x, y: document.y });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
  };

  const beginResize = (event: ReactPointerEvent, document: DocumentObject, direction: ResizeDirection) => {
    if (document.locked || document.collapsed || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    select(document.id);
    setResizingId(document.id);
    const start = {
      clientX: event.clientX,
      clientY: event.clientY,
      x: document.x,
      y: document.y,
      width: document.width,
      height: document.height
    };
    const move = (moveEvent: PointerEvent) => {
      const zoom = useCameraStore.getState().zoom;
      const deltaX = (moveEvent.clientX - start.clientX) / zoom;
      const deltaY = (moveEvent.clientY - start.clientY) / zoom;
      let nextX = start.x;
      let nextY = start.y;
      let nextWidth = start.width;
      let nextHeight = start.height;
      if (direction.includes("e")) nextWidth = Math.max(260, start.width + deltaX);
      if (direction.includes("s")) nextHeight = Math.max(140, start.height + deltaY);
      if (direction.includes("w")) {
        nextWidth = Math.max(260, start.width - deltaX);
        nextX = start.x + start.width - nextWidth;
      }
      if (direction.includes("n")) {
        nextHeight = Math.max(140, start.height - deltaY);
        nextY = start.y + start.height - nextHeight;
      }
      updateObject(document.id, { x: nextX, y: nextY, width: nextWidth, height: nextHeight }, false);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      setResizingId(null);
      const current = useBoardStore.getState().objects.find((object) => object.id === document.id);
      if (current && (current.x !== start.x || current.y !== start.y || current.width !== start.width || current.height !== start.height)) {
        commitObjectUpdate(
          document.id,
          { x: current.x, y: current.y, width: current.width, height: current.height },
          { x: start.x, y: start.y, width: start.width, height: start.height }
        );
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
  };

  return <>
    {documents.map((document) => (
      <article key={document.id} className={`floating-document ${selectedIds.includes(document.id) ? "selected" : ""} ${draggingId === document.id ? "is-dragging" : ""} ${resizingId === document.id ? "is-resizing" : ""} ${document.locked ? "is-locked" : ""}`}
        style={{ left: camera.x + document.x * camera.zoom, top: camera.y + document.y * camera.zoom, width: document.width * camera.zoom, height: document.collapsed ? 34 : document.height * camera.zoom }}
        onPointerDown={() => select(document.id)}>
        <header onPointerDown={(event) => beginDrag(event, document)}>
          <strong>{document.fileName}</strong>
          <button aria-label={document.locked ? "Unlock document" : "Lock document"} onPointerDown={(event) => event.stopPropagation()} onClick={() => updateObject(document.id, { locked: !document.locked })}>{document.locked ? <Lock size={13}/> : <LockOpen size={13}/>}</button>
          <button aria-label="Duplicate document" onPointerDown={(event) => event.stopPropagation()} onClick={() => { select(document.id); duplicateSelected(); }}><Copy size={13}/></button>
          <button aria-label={document.collapsed ? "Expand document" : "Minimize document"} onPointerDown={(event) => event.stopPropagation()} onClick={() => updateObject(document.id, { collapsed: !document.collapsed })}><Minus size={13}/></button>
          <button aria-label="Close document" onPointerDown={(event) => event.stopPropagation()} onClick={() => removeObject(document.id)}><X size={13}/></button>
        </header>
        {!document.collapsed && <>
          <div className="document-controls">
            <button aria-label="Previous page" disabled={document.currentPage <= 1} onPointerDown={(event) => event.stopPropagation()} onClick={() => updateObject(document.id, { currentPage: Math.max(1, document.currentPage - 1) })}><ChevronLeft size={13}/></button>
            <span>Page {document.currentPage}{document.pageCount ? ` / ${document.pageCount}` : ""}</span>
            <button aria-label="Next page" disabled={Boolean(document.pageCount && document.currentPage >= document.pageCount)} onPointerDown={(event) => event.stopPropagation()} onClick={() => updateObject(document.id, { currentPage: Math.min(document.pageCount ?? document.currentPage + 1, document.currentPage + 1) })}><ChevronRight size={13}/></button>
            <button aria-label="Zoom document out" onPointerDown={(event) => event.stopPropagation()} onClick={() => updateObject(document.id, { documentZoom: Math.max(.25, document.documentZoom - .1) })}><Minus size={13}/></button>
            <span>{Math.round(document.documentZoom * 100)}%</span>
            <button aria-label="Zoom document in" onPointerDown={(event) => event.stopPropagation()} onClick={() => updateObject(document.id, { documentZoom: Math.min(4, document.documentZoom + .1) })}><Plus size={13}/></button>
          </div>
          <iframe title={document.fileName} sandbox="allow-same-origin" referrerPolicy="no-referrer" src={`${document.dataUrl}#page=${document.currentPage}&zoom=${Math.round(document.documentZoom * 100)}`} />
        </>}
        {selectedIds.includes(document.id) && !document.locked && !document.collapsed && resizeDirections.map((direction) =>
          <button
            type="button"
            key={direction}
            className={`document-resize-handle resize-${direction}`}
            aria-label={`Resize document from ${direction}`}
            onPointerDown={(event) => beginResize(event, document, direction)}
          />
        )}
      </article>
    ))}
  </>;
}
