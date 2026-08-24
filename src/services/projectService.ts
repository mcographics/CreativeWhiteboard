import type { BoardProject } from "../models/whiteboard";
import { canvasRegistry } from "./canvasRegistry";
import { useBoardStore } from "../state/boardStore";
import { useCameraStore } from "../state/cameraStore";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";
import { renderCompleteBoard } from "./boardExportRenderer";
import { readPdfPageCount } from "./importService";

const projectTitleFromPath = (filePath: string) => filePath.split(/[\\/]/).at(-1)?.replace(/\.cwb$/i, "") || "Untitled";

function serializeProject(): BoardProject {
  return {
    format: "creative-whiteboard-project",
    schemaVersion: 1,
    title: useProjectStore.getState().title,
    objects: useBoardStore.getState().objects,
    camera: {
      x: useCameraStore.getState().x,
      y: useCameraStore.getState().y,
      zoom: useCameraStore.getState().zoom
    },
    background: "#ffffff"
  };
}

export function validateProject(value: unknown): asserts value is BoardProject {
  if (!value || typeof value !== "object") throw new Error("This file is not a valid Creative Whiteboard project.");
  const candidate = value as Partial<BoardProject>;
  if (candidate.format !== "creative-whiteboard-project" || candidate.schemaVersion !== 1 || !Array.isArray(candidate.objects)) {
    throw new Error("Unsupported or corrupted Creative Whiteboard project.");
  }
  if (typeof candidate.title !== "string" || candidate.title.length > 500) throw new Error("The project title is invalid.");
  if (typeof candidate.background !== "string" || candidate.background.length > 100) throw new Error("The project background is invalid.");
  if (!candidate.camera || typeof candidate.camera !== "object") throw new Error("The project camera is missing or invalid.");
  if (!isFiniteNumber(candidate.camera.x, 10_000_000) || !isFiniteNumber(candidate.camera.y, 10_000_000) ||
      !isFiniteNumber(candidate.camera.zoom, 32) || candidate.camera.zoom < .05) {
    throw new Error("The project camera is invalid.");
  }
  if (candidate.objects.length > 50_000) throw new Error("The project contains too many objects.");
  const allowedTypes = new Set(["stroke", "image", "text", "note", "pdf", "document", "rectangle", "ellipse", "triangle", "star", "arrow", "badge", "comment"]);
  const ids = new Set<string>();
  for (const object of candidate.objects as unknown as Array<Record<string, unknown>>) {
    if (!object || typeof object !== "object" || typeof object.id !== "string" || object.id.length > 128 || typeof object.type !== "string" || !allowedTypes.has(object.type)) {
      throw new Error("The project contains an unsupported object.");
    }
    if (ids.has(object.id)) throw new Error("The project contains duplicate object identifiers.");
    ids.add(object.id);
    for (const field of ["x", "y", "width", "height", "rotation", "opacity"]) {
      if (!isFiniteNumber(object[field], 10_000_000)) throw new Error("The project contains invalid object geometry.");
    }
    if ((object.width as number) < 0 || (object.height as number) < 0 || (object.opacity as number) < 0 || (object.opacity as number) > 1 || typeof object.locked !== "boolean") {
      throw new Error("The project contains invalid object geometry.");
    }
    if (object.type === "stroke") {
      if (!Array.isArray(object.points) || object.points.length < 2 || object.points.length > 2_000_000 || object.points.length % 2 !== 0 ||
          !object.points.every((point) => isFiniteNumber(point, 10_000_000)) || !isShortString(object.color, 100) ||
          !isFiniteNumber(object.strokeWidth, 10_000) || (object.strokeWidth as number) <= 0 ||
          !["pen", "brush", "highlighter", "marker"].includes(String(object.mode)) || typeof object.smooth !== "boolean" ||
          (object.inputType !== undefined && !["mouse", "pen", "touch"].includes(String(object.inputType))) ||
          (object.pressures !== undefined && (!Array.isArray(object.pressures) ||
            object.pressures.length !== object.points.length / 2 ||
            !object.pressures.every((pressure) => isFiniteNumber(pressure, 1) && pressure >= 0)))) {
        throw new Error("The project contains an invalid stroke.");
      }
    } else if (["rectangle", "ellipse", "triangle", "star", "arrow", "badge", "comment"].includes(object.type)) {
      if (!isShortString(object.strokeColor, 100) || !isShortString(object.fillColor, 100) ||
          !isFiniteNumber(object.strokeWidth, 10_000) || (object.strokeWidth as number) <= 0) {
        throw new Error("The project contains an invalid shape.");
      }
    } else if (object.type === "text") {
      if (!isText(object.text) || !isShortString(object.color, 100) || !isFontObject(object)) throw new Error("The project contains invalid text.");
    } else if (object.type === "note") {
      if (!isText(object.note) || !isShortString(object.color, 100) || !isShortString(object.backgroundColor, 100) ||
          !isFontObject(object) || (object.variant !== undefined && !["sticky", "comment"].includes(String(object.variant)))) {
        throw new Error("The project contains an invalid note.");
      }
    } else if (object.type === "image") {
      if (!isShortString(object.fileName, 500) || typeof object.dataUrl !== "string" ||
          !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(object.dataUrl)) {
        throw new Error("The project contains an unsafe embedded image.");
      }
    } else if (object.type === "pdf" || object.type === "document") {
      if (!isShortString(object.fileName, 500) || typeof object.dataUrl !== "string" ||
          !/^data:application\/pdf;base64,[a-z0-9+/=]+$/i.test(object.dataUrl) ||
          typeof object.collapsed !== "boolean" || !isFiniteNumber(object.documentZoom, 4) || (object.documentZoom as number) < .25 ||
          !Number.isInteger(object.currentPage) || (object.currentPage as number) < 1 ||
          (object.pageCount !== undefined && (!Number.isInteger(object.pageCount) || (object.pageCount as number) < 1 || (object.pageCount as number) > 100_000))) {
        throw new Error("The project contains an invalid document.");
      }
    }
  }
}

function isFiniteNumber(value: unknown, maximumAbsolute: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= maximumAbsolute;
}

function isShortString(value: unknown, maximumLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength;
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length <= 5_000_000;
}

function isFontObject(object: Record<string, unknown>) {
  return isFiniteNumber(object.fontSize, 1_000) && (object.fontSize as number) >= 1 &&
    (object.fontFamily === undefined || isShortString(object.fontFamily, 200)) &&
    (object.bold === undefined || typeof object.bold === "boolean") &&
    (object.italic === undefined || typeof object.italic === "boolean") &&
    (object.underline === undefined || typeof object.underline === "boolean");
}

export async function openProject() {
  const result = await window.desktopFiles?.openProject();
  if (!result) return false;
  const project: unknown = JSON.parse(result.data);
  validateProject(project);
  const objects = await Promise.all(project.objects.map(async (object) => {
    if ((object.type !== "pdf" && object.type !== "document") || object.pageCount) return object;
    try {
      return { ...object, pageCount: await readPdfPageCount(object.dataUrl) };
    } catch {
      return { ...object, pageCount: 1 };
    }
  }));
  useBoardStore.getState().replaceObjects(objects);
  useCameraStore.getState().setCamera(project.camera);
  useProjectStore.getState().setProjectFile(result.filePath, project.title || projectTitleFromPath(result.filePath));
  useProjectStore.getState().setSaveState("saved");
  return true;
}

export async function saveProject(saveAs = false) {
  const project = useProjectStore.getState();
  project.setSaveState("saving");
  try {
    const filePath = await window.desktopFiles?.saveProject({
      filePath: project.filePath,
      saveAs,
      suggestedName: `${project.title}.cwb`,
      data: JSON.stringify(serializeProject(), null, 2)
    });
    if (!filePath) { project.setSaveState(project.filePath ? "saved" : "unsaved"); return false; }
    project.setProjectFile(filePath, projectTitleFromPath(filePath));
    project.setSaveState("saved");
    return true;
  } catch (error) {
    project.setSaveState("failed");
    throw error;
  }
}

export async function exportBoard(format: "png" | "jpeg" | "pdf") {
  const stage = canvasRegistry.getStage();
  if (!stage) throw new Error("The canvas is not ready.");
  const camera = useCameraStore.getState();
  const fallback = {
    x: -camera.x / camera.zoom,
    y: -camera.y / camera.zoom,
    width: stage.width() / camera.zoom,
    height: stage.height() / camera.zoom
  };
  const { canvas } = await renderCompleteBoard(useBoardStore.getState().objects, fallback, useUiStore.getState().exportScale);
  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const dataUrl = canvas.toDataURL(mimeType, .94);
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height] });
    pdf.addImage(dataUrl, "PNG", 0, 0, canvas.width, canvas.height);
    const buffer = pdf.output("arraybuffer");
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return window.desktopFiles?.saveExport({
      suggestedName: `${useProjectStore.getState().title}.pdf`,
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
      data: btoa(binary),
      base64: true
    });
  }
  return window.desktopFiles?.saveExport({
    suggestedName: `${useProjectStore.getState().title}.${format === "jpeg" ? "jpg" : "png"}`,
    filters: [{ name: format === "jpeg" ? "JPEG image" : "PNG image", extensions: [format === "jpeg" ? "jpg" : "png"] }],
    data: dataUrl.split(",")[1] ?? "",
    base64: true
  });
}

export const exportPng = () => exportBoard("png");
