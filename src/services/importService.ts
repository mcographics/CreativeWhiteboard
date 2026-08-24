import type { DocumentObject, ImageObject, TextObject } from "../models/whiteboard";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useBoardStore } from "../state/boardStore";
import { useCameraStore } from "../state/cameraStore";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const mimeByExtension: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  pdf: "application/pdf", txt: "text/plain", md: "text/markdown"
};
const MAX_BINARY_BYTES = 50 * 1024 * 1024;
const MAX_TEXT_BYTES = 5 * 1024 * 1024;

export async function importFiles() {
  const files = await window.desktopFiles?.importFiles();
  if (!files?.length) return;
  await addImportedFiles(files);
}

export async function importDroppedFiles(droppedFiles: FileList) {
  const files = await Promise.all(Array.from(droppedFiles).slice(0, 20).map(async (file) => {
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    const buffer = await file.arrayBuffer();
    const mimeType = validateBrowserImport(file.name, extension, new Uint8Array(buffer));
    return { fileName: safeFileName(file.name), extension: extension === "jpeg" ? "jpg" : extension, mimeType, data: arrayBufferToBase64(buffer) };
  }));
  await addImportedFiles(files);
}

async function addImportedFiles(files: Array<{ fileName: string; extension: string; mimeType?: string; data: string }>) {
  const camera = useCameraStore.getState();
  const center = { x: (window.innerWidth / 2 - camera.x) / camera.zoom, y: (window.innerHeight / 2 - camera.y) / camera.zoom };
  for (const [index, file] of files.entries()) {
    const mime = file.mimeType ?? mimeByExtension[file.extension];
    if (!mime) throw new Error("Unsupported import type.");
    const dataUrl = `data:${mime};base64,${file.data}`;
    if (mime.startsWith("image/")) {
      const dimensions = await readImageDimensions(dataUrl);
      const scale = Math.min(1, 640 / dimensions.width, 480 / dimensions.height);
      const object: ImageObject = {
        id: crypto.randomUUID(), type: "image", fileName: file.fileName, dataUrl,
        x: center.x + index * 28, y: center.y + index * 28,
        width: dimensions.width * scale, height: dimensions.height * scale,
        rotation: 0, opacity: 1, locked: false
      };
      useBoardStore.getState().addObject(object);
    } else if (file.extension === "txt" || file.extension === "md") {
      const text = new TextDecoder().decode(Uint8Array.from(atob(file.data), (character) => character.charCodeAt(0)));
      const object: TextObject = {
        id: crypto.randomUUID(), type: "text", text, x: center.x, y: center.y,
        width: 440, height: 320, rotation: 0, opacity: 1, locked: false,
        color: "#111111", fontSize: 16
      };
      useBoardStore.getState().addObject(object);
    } else {
      const pageCount = await readPdfPageCount(file.data);
      const object: DocumentObject = {
        id: crypto.randomUUID(), type: "pdf", fileName: file.fileName, dataUrl,
        x: center.x, y: center.y, width: 520, height: 620, rotation: 0, opacity: 1,
        locked: false, collapsed: false, documentZoom: 1, currentPage: 1, pageCount
      };
      useBoardStore.getState().addObject(object);
    }
  }
}

export async function readPdfPageCount(base64OrDataUrl: string) {
  const base64 = base64OrDataUrl.includes(",") ? base64OrDataUrl.split(",", 2)[1] ?? "" : base64OrDataUrl;
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const loadingTask = getDocument({ data: bytes, isEvalSupported: false, useWorkerFetch: false });
  try {
    const document = await loadingTask.promise;
    const pages = document.numPages;
    await document.destroy();
    return pages;
  } catch {
    await loadingTask.destroy();
    throw new Error("The selected PDF could not be opened.");
  }
}

export function safeFileName(value: string) {
  const baseName = value.split(/[\\/]/).at(-1) ?? "";
  return Array.from(baseName).filter((character) => {
    const code = character.charCodeAt(0);
    return code > 31 && code !== 127;
  }).join("").slice(0, 180) || "Imported file";
}

export function validateBrowserImport(fileName: string, extension: string, bytes: Uint8Array) {
  if (!mimeByExtension[extension] || !bytes.length) throw new Error(`${safeFileName(fileName)} is unsupported or empty.`);
  const limit = extension === "txt" || extension === "md" ? MAX_TEXT_BYTES : MAX_BINARY_BYTES;
  if (bytes.byteLength > limit) throw new Error(`${safeFileName(fileName)} exceeds the import size limit.`);
  const matches = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (extension === "png" && matches(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if ((extension === "jpg" || extension === "jpeg") && matches(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (extension === "webp" && new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (extension === "pdf" && new TextDecoder("ascii").decode(bytes.slice(0, 5)) === "%PDF-") {
    const pdfText = new TextDecoder("latin1").decode(bytes);
    if (!pdfText.slice(-2048).includes("%%EOF") || /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia)\b/i.test(pdfText)) {
      throw new Error(`${safeFileName(fileName)} contains malformed or active PDF content.`);
    }
    return "application/pdf";
  }
  if ((extension === "txt" || extension === "md") && !bytes.includes(0)) return mimeByExtension[extension]!;
  throw new Error(`${safeFileName(fileName)} has content that does not match its extension.`);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function readImageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("The selected image could not be decoded."));
    image.src = dataUrl;
  });
}
