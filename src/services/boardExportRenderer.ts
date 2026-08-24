import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { BoardObject, DocumentObject, NoteObject, ShapeObject, TextObject } from "../models/whiteboard";
import { pressureStrokeWidth } from "./stylus";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PADDING = 48;
const MAX_DIMENSION = 8192;
const MAX_PIXELS = 64_000_000;

export interface ExportedBoard {
  canvas: HTMLCanvasElement;
  worldBounds: { x: number; y: number; width: number; height: number };
}

export async function renderCompleteBoard(objects: BoardObject[], fallback: { x: number; y: number; width: number; height: number }, requestedScale = 1): Promise<ExportedBoard> {
  const content = calculateBoardBounds(objects, fallback);
  const worldBounds = {
    x: content.x - PADDING,
    y: content.y - PADDING,
    width: Math.max(1, content.width + PADDING * 2),
    height: Math.max(1, content.height + PADDING * 2)
  };
  const safeRequestedScale = Math.min(4, Math.max(.25, requestedScale));
  const scale = calculateExportScale(worldBounds.width, worldBounds.height, safeRequestedScale);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(worldBounds.width * scale));
  canvas.height = Math.max(1, Math.ceil(worldBounds.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The export canvas could not be created.");
  const darkBoard = document.querySelector(".app-shell")?.getAttribute("data-theme") === "dark";
  context.fillStyle = darkBoard ? "#171a1d" : "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.translate(-worldBounds.x, -worldBounds.y);
  for (const object of objects) await drawObject(context, object);
  return { canvas, worldBounds };
}

export function calculateBoardBounds(objects: BoardObject[], fallback: { x: number; y: number; width: number; height: number }) {
  if (!objects.length) return fallback;
  const bounds = objects.map(objectBounds);
  const minX = Math.min(...bounds.map((bound) => bound.x));
  const minY = Math.min(...bounds.map((bound) => bound.y));
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function calculateExportScale(width: number, height: number, requestedScale: number) {
  return Math.min(
    Math.min(4, Math.max(.25, requestedScale)),
    MAX_DIMENSION / Math.max(1, width),
    MAX_DIMENSION / Math.max(1, height),
    Math.sqrt(MAX_PIXELS / Math.max(1, width * height))
  );
}

function objectBounds(object: BoardObject) {
  if (object.type === "stroke" && object.points.length >= 2) {
    const xs = object.points.filter((_point, index) => index % 2 === 0).map((point) => point + object.x);
    const ys = object.points.filter((_point, index) => index % 2 === 1).map((point) => point + object.y);
    const padding = object.strokeWidth / 2;
    const minX = Math.min(...xs) - padding;
    const minY = Math.min(...ys) - padding;
    return { x: minX, y: minY, width: Math.max(1, Math.max(...xs) - minX + padding), height: Math.max(1, Math.max(...ys) - minY + padding) };
  }
  const height = (object.type === "pdf" || object.type === "document") && object.collapsed ? 34 : object.height;
  if (!object.rotation) return { x: object.x, y: object.y, width: Math.max(1, object.width), height: Math.max(1, height) };
  const radians = object.rotation * Math.PI / 180;
  const corners = [[0, 0], [object.width, 0], [object.width, height], [0, height]].map(([x, y]) => ({
    x: object.x + x! * Math.cos(radians) - y! * Math.sin(radians),
    y: object.y + x! * Math.sin(radians) + y! * Math.cos(radians)
  }));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

async function drawObject(context: CanvasRenderingContext2D, object: BoardObject) {
  context.save();
  context.globalAlpha = object.opacity;
  if (object.type === "stroke") {
    drawStroke(context, object);
    context.restore();
    return;
  }
  context.translate(object.x, object.y);
  context.rotate(object.rotation * Math.PI / 180);
  if (object.type === "image") {
    const image = await loadImage(object.dataUrl);
    context.drawImage(image, 0, 0, object.width, object.height);
  } else if (object.type === "text") {
    drawText(context, object, object.text, object.color, 0, 0, object.width, object.height);
  } else if (object.type === "note") {
    drawNote(context, object);
  } else if ("strokeColor" in object) {
    drawShape(context, object);
  } else {
    await drawDocument(context, object);
  }
  context.restore();
}

function drawStroke(context: CanvasRenderingContext2D, object: Extract<BoardObject, { type: "stroke" }>) {
  if (object.points.length < 2) return;
  context.globalCompositeOperation = object.mode === "highlighter" ? "multiply" : "source-over";
  context.strokeStyle = object.color;
  context.lineCap = object.mode === "marker" ? "square" : "round";
  context.lineJoin = "round";
  context.translate(object.x, object.y);
  const pressures = object.pressures;
  if (object.mode !== "highlighter" && pressures && pressures.length === object.points.length / 2 && pressures.length > 1) {
    for (let index = 2; index < object.points.length; index += 2) {
      const pressureIndex = index / 2;
      const pressure = ((pressures[pressureIndex - 1] ?? .5) + (pressures[pressureIndex] ?? .5)) / 2;
      context.lineWidth = pressureStrokeWidth(object.strokeWidth, object.mode, pressure);
      context.beginPath();
      context.moveTo(object.points[index - 2]!, object.points[index - 1]!);
      context.lineTo(object.points[index]!, object.points[index + 1]!);
      context.stroke();
    }
    return;
  }
  context.lineWidth = object.strokeWidth;
  context.beginPath();
  context.moveTo(object.points[0]!, object.points[1]!);
  for (let index = 2; index < object.points.length; index += 2) context.lineTo(object.points[index]!, object.points[index + 1]!);
  context.stroke();
}

function drawNote(context: CanvasRenderingContext2D, object: NoteObject) {
  context.fillStyle = object.backgroundColor;
  context.strokeStyle = "#d1b94f";
  context.lineWidth = 1.5;
  context.fillRect(0, 0, object.width, object.height);
  context.strokeRect(0, 0, object.width, object.height);
  drawText(context, object, object.note, object.color, 14, 12, object.width - 28, object.height - 24);
}

function drawText(context: CanvasRenderingContext2D, object: TextObject | NoteObject, value: string, color: string, x: number, y: number, width: number, height: number) {
  const style = `${object.italic ? "italic " : ""}${object.bold ? "700 " : "400 "}`;
  context.font = `${style}${object.fontSize}px ${JSON.stringify(object.fontFamily ?? "Arial")}`;
  context.fillStyle = color;
  context.textBaseline = "top";
  const lineHeight = object.fontSize * 1.35;
  let cursorY = y;
  for (const paragraph of value.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > width) {
        drawTextLine(context, line, x, cursorY, object.underline, object.fontSize);
        cursorY += lineHeight;
        line = word;
        if (cursorY + lineHeight > y + height) return;
      } else {
        line = next;
      }
    }
    drawTextLine(context, line, x, cursorY, object.underline, object.fontSize);
    cursorY += lineHeight;
    if (cursorY > y + height) return;
  }
}

function drawTextLine(context: CanvasRenderingContext2D, line: string, x: number, y: number, underline: boolean | undefined, fontSize: number) {
  context.fillText(line, x, y);
  if (!underline || !line) return;
  const metrics = context.measureText(line);
  context.fillRect(x, y + fontSize * 1.08, metrics.width, 1);
}

function drawShape(context: CanvasRenderingContext2D, object: ShapeObject) {
  context.strokeStyle = object.strokeColor;
  context.fillStyle = object.fillColor;
  context.lineWidth = object.strokeWidth;
  context.beginPath();
  if (object.type === "ellipse") {
    context.ellipse(object.width / 2, object.height / 2, object.width / 2, object.height / 2, 0, 0, Math.PI * 2);
  } else if (object.type === "triangle") {
    context.moveTo(object.width / 2, 0); context.lineTo(object.width, object.height); context.lineTo(0, object.height); context.closePath();
  } else if (object.type === "star") {
    polygon(context, object.width / 2, object.height / 2, Math.min(object.width, object.height) / 2, 5, .45);
  } else if (object.type === "badge") {
    polygon(context, object.width / 2, object.height / 2, Math.min(object.width, object.height) / 2, 8, 1);
  } else if (object.type === "arrow") {
    context.moveTo(0, 0); context.lineTo(object.width, object.height);
    context.stroke();
    const angle = Math.atan2(object.height, object.width);
    context.beginPath();
    context.moveTo(object.width, object.height);
    context.lineTo(object.width - 16 * Math.cos(angle - Math.PI / 6), object.height - 16 * Math.sin(angle - Math.PI / 6));
    context.lineTo(object.width - 16 * Math.cos(angle + Math.PI / 6), object.height - 16 * Math.sin(angle + Math.PI / 6));
    context.closePath();
  } else {
    context.rect(0, 0, object.width, object.height);
  }
  if (object.fillColor !== "transparent") context.fill();
  context.stroke();
}

function polygon(context: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, points: number, innerRatio: number) {
  const vertices = innerRatio === 1 ? points : points * 2;
  for (let index = 0; index < vertices; index += 1) {
    const currentRadius = innerRatio === 1 || index % 2 === 0 ? radius : radius * innerRatio;
    const angle = -Math.PI / 2 + index * Math.PI * 2 / vertices;
    const x = centerX + Math.cos(angle) * currentRadius;
    const y = centerY + Math.sin(angle) * currentRadius;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.closePath();
}

async function drawDocument(context: CanvasRenderingContext2D, object: DocumentObject) {
  const visibleHeight = object.collapsed ? 34 : object.height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, object.width, visibleHeight);
  context.strokeStyle = "#34373a";
  context.lineWidth = 1;
  context.strokeRect(0, 0, object.width, visibleHeight);
  context.fillStyle = "#242628";
  context.fillRect(0, 0, object.width, 34);
  context.fillStyle = "#eeeeee";
  context.font = "12px Arial";
  context.textBaseline = "middle";
  context.fillText(object.fileName, 9, 17, Math.max(20, object.width - 18));
  if (object.collapsed) return;
  context.fillStyle = "#303336";
  context.fillRect(0, 34, object.width, 32);
  context.fillStyle = "#eeeeee";
  context.textAlign = "center";
  context.fillText(`Page ${object.currentPage}${object.pageCount ? ` / ${object.pageCount}` : ""}    ${Math.round(object.documentZoom * 100)}%`, object.width / 2, 50);
  context.textAlign = "start";
  try {
    const bytes = dataUrlBytes(object.dataUrl);
    const loadingTask = getDocument({ data: bytes, isEvalSupported: false, useWorkerFetch: false });
    const pdf = await loadingTask.promise;
    const pageNumber = Math.min(pdf.numPages, Math.max(1, object.currentPage));
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const contentWidth = object.width;
    const contentHeight = Math.max(1, object.height - 66);
    const scale = Math.min(contentWidth / baseViewport.width, contentHeight / baseViewport.height) * object.documentZoom;
    const viewport = page.getViewport({ scale });
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = Math.max(1, Math.ceil(viewport.width));
    pageCanvas.height = Math.max(1, Math.ceil(viewport.height));
    const pageContext = pageCanvas.getContext("2d");
    if (pageContext) {
      await page.render({ canvasContext: pageContext, viewport }).promise;
      context.save();
      context.beginPath();
      context.rect(0, 66, contentWidth, contentHeight);
      context.clip();
      context.drawImage(pageCanvas, 0, 66);
      context.restore();
    }
    await pdf.destroy();
  } catch {
    context.fillStyle = "#4a4f54";
    context.textAlign = "center";
    context.fillText("Preview unavailable", object.width / 2, 66 + (object.height - 66) / 2);
    context.textAlign = "start";
  }
}

function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An imported image could not be rendered for export."));
    image.src = source;
  });
}
