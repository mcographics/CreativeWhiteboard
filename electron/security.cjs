const path = require("node:path");

const MAX_PROJECT_BYTES = 25 * 1024 * 1024;
const MAX_BINARY_IMPORT_BYTES = 50 * 1024 * 1024;
const MAX_TEXT_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_EXPORT_BYTES = 256 * 1024 * 1024;
const ALLOWED_IMPORT_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "pdf", "txt", "md"]);
const BLOCKED_EXTENSIONS = new Set(["exe", "dll", "com", "bat", "cmd", "ps1", "msi", "js", "mjs", "cjs", "vbs", "hta", "scr", "jar", "sh", "app"]);

function safeDisplayName(value) {
  return path.basename(String(value || "Untitled")).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180) || "Untitled";
}

function extensionOf(filePath) {
  return path.extname(filePath).slice(1).toLowerCase();
}

function hasSignature(buffer, bytes) {
  return bytes.every((value, index) => buffer[index] === value);
}

function detectImportType(buffer, extension) {
  if (!ALLOWED_IMPORT_EXTENSIONS.has(extension) || BLOCKED_EXTENSIONS.has(extension)) throw new Error("Unsupported file type.");
  if (extension === "png" && hasSignature(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const width = buffer.readUInt32BE(16); const height = buffer.readUInt32BE(20);
    if (!width || !height || width * height > 100_000_000) throw new Error("Image dimensions exceed the safety limit.");
    return { extension: "png", mimeType: "image/png" };
  }
  if ((extension === "jpg" || extension === "jpeg") && hasSignature(buffer, [0xff, 0xd8, 0xff])) return { extension: "jpg", mimeType: "image/jpeg" };
  if (extension === "webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { extension: "webp", mimeType: "image/webp" };
  if (extension === "pdf" && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    const pdfText = buffer.toString("latin1");
    if (!pdfText.slice(-2048).includes("%%EOF")) throw new Error("The PDF is incomplete or malformed.");
    if (/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia)\b/i.test(pdfText)) throw new Error("PDFs containing active or embedded content are not supported.");
    return { extension: "pdf", mimeType: "application/pdf" };
  }
  if (extension === "txt" || extension === "md") {
    if (buffer.includes(0)) throw new Error("Text files may not contain binary data.");
    return { extension, mimeType: extension === "md" ? "text/markdown" : "text/plain" };
  }
  throw new Error("The file extension does not match its contents.");
}

function validateImportBuffer(buffer, extension) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("The selected file is empty or unreadable.");
  const max = extension === "txt" || extension === "md" ? MAX_TEXT_IMPORT_BYTES : MAX_BINARY_IMPORT_BYTES;
  if (buffer.length > max) throw new Error("The selected file exceeds the permitted size limit.");
  return detectImportType(buffer, extension);
}

function validateProjectText(data) {
  if (typeof data !== "string" || Buffer.byteLength(data, "utf8") > MAX_PROJECT_BYTES) throw new Error("The project exceeds the permitted size limit.");
  const parsed = JSON.parse(data);
  if (!parsed || parsed.format !== "creative-whiteboard-project" || parsed.schemaVersion !== 1 || !Array.isArray(parsed.objects) || parsed.objects.length > 50_000) {
    throw new Error("Unsupported or damaged Creative Whiteboard project.");
  }
  return parsed;
}

function validateExportRequest(request) {
  if (!request || typeof request !== "object" || typeof request.data !== "string" || request.base64 !== true) throw new Error("Invalid export request.");
  const bytes = Math.ceil(request.data.length * 0.75);
  if (bytes > MAX_EXPORT_BYTES) throw new Error("Export exceeds the permitted size limit.");
  const name = safeDisplayName(request.suggestedName);
  const extension = extensionOf(name);
  if (!["png", "jpg", "jpeg", "pdf"].includes(extension)) throw new Error("Unsupported export format.");
  return {
    suggestedName: name,
    filters: [{ name: extension === "pdf" ? "PDF document" : extension === "png" ? "PNG image" : "JPEG image", extensions: [extension === "jpeg" ? "jpg" : extension] }],
    data: request.data
  };
}

function isApprovedHttpsUrl(value, approvedOrigins) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && approvedOrigins.has(url.origin);
  } catch {
    return false;
  }
}

function isTrustedIpcSender(event) {
  return Boolean(event?.sender && !event.sender.isDestroyed?.() && event.senderFrame === event.sender.mainFrame);
}

function sanitizeFontFamilies(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 20_000).map((font) =>
    typeof font === "string"
      ? font.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/^["']|["']$/g, "").trim().slice(0, 200)
      : ""
  ).filter(Boolean))].sort((left, right) => left.localeCompare(right)).slice(0, 10_000);
}

module.exports = {
  MAX_PROJECT_BYTES, safeDisplayName, extensionOf, validateImportBuffer, validateProjectText,
  validateExportRequest, isApprovedHttpsUrl, isTrustedIpcSender, sanitizeFontFamilies
};
