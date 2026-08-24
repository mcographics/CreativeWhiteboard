import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { safeFileName, validateBrowserImport } from "../src/services/importService";
import { validateProject } from "../src/services/projectService";

const require = createRequire(import.meta.url);
const security = require("../electron/security.cjs") as {
  safeDisplayName: (value: string) => string;
  validateImportBuffer: (buffer: Buffer, extension: string) => { mimeType: string };
  validateExportRequest: (request: unknown) => unknown;
  isApprovedHttpsUrl: (url: string, origins: Set<string>) => boolean;
  isTrustedIpcSender: (event: unknown) => boolean;
  sanitizeFontFamilies: (value: unknown) => string[];
};

describe("security boundaries", () => {
  it("strips traversal and control characters from display names", () => {
    expect(security.safeDisplayName("../../evil\u0000.pdf")).toBe("evil.pdf");
    expect(safeFileName("..\\..\\attack<script>.pdf")).toBe("attack<script>.pdf");
  });

  it("requires extensions and file signatures to agree", () => {
    expect(() => security.validateImportBuffer(Buffer.from("MZ executable"), "png")).toThrow(/match|Unsupported/i);
    expect(() => validateBrowserImport("fake.pdf", "pdf", new TextEncoder().encode("<script>alert(1)</script>"))).toThrow(/does not match/i);
    expect(security.validateImportBuffer(Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"), "pdf").mimeType).toBe("application/pdf");
  });

  it("rejects executable and unsupported document content", () => {
    expect(() => security.validateImportBuffer(Buffer.from("MZ"), "exe")).toThrow(/Unsupported/i);
    expect(() => security.validateImportBuffer(Buffer.from("<svg><script/></svg>"), "svg")).toThrow(/Unsupported/i);
  });

  it("blocks unauthorized IPC senders and unsafe external schemes", () => {
    expect(security.isTrustedIpcSender({})).toBe(false);
    expect(security.isTrustedIpcSender({ sender: { mainFrame: {}, isDestroyed: () => false }, senderFrame: {} })).toBe(false);
    const origins = new Set(["https://example.com"]);
    expect(security.isApprovedHttpsUrl("https://example.com/support", origins)).toBe(true);
    expect(security.isApprovedHttpsUrl("javascript:alert(1)", origins)).toBe(false);
    expect(security.isApprovedHttpsUrl("https://evil.example/", origins)).toBe(false);
  });

  it("sanitizes and bounds system font names before exposing them", () => {
    expect(security.sanitizeFontFamilies([
      "\"Arial\"", "Arial", "  Custom Font  ", "Bad\u0000Font", "", 42
    ])).toEqual(["Arial", "BadFont", "Custom Font"]);
    expect(security.sanitizeFontFamilies("Arial")).toEqual([]);
  });

  it("rejects unsafe embedded project content and invalid geometry", () => {
    const base = { format: "creative-whiteboard-project", schemaVersion: 1, title: "x", camera: { x: 0, y: 0, zoom: 1 }, background: "#fff" };
    expect(() => validateProject({ ...base, objects: [{ id: "1", type: "image", x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, locked: false, fileName: "x", dataUrl: "data:text/html,<script>alert(1)</script>" }] })).toThrow(/unsafe/i);
    expect(() => validateProject({ ...base, objects: [{ id: "1", type: "text", x: Infinity, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, locked: false, text: "<img onerror=alert(1)>", color: "#000", fontSize: 16 }] })).toThrow(/geometry/i);
  });

  it("rejects missing camera data and incomplete object records", () => {
    expect(() => validateProject({
      format: "creative-whiteboard-project", schemaVersion: 1, title: "x", background: "#fff", objects: []
    })).toThrow(/camera/i);
    expect(() => validateProject({
      format: "creative-whiteboard-project", schemaVersion: 1, title: "x", background: "#fff",
      camera: { x: 0, y: 0, zoom: 1 },
      objects: [{ id: "bad", type: "stroke", x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1, locked: false }]
    })).toThrow(/stroke/i);
  });

  it("accepts bounded stylus pressure data and rejects malformed samples", () => {
    const base = {
      format: "creative-whiteboard-project", schemaVersion: 1, title: "x", background: "#fff",
      camera: { x: 0, y: 0, zoom: 1 }
    };
    const stroke = {
      id: "pen-1", type: "stroke", x: 0, y: 0, width: 0, height: 0, rotation: 0,
      opacity: 1, locked: false, points: [0, 0, 20, 20], pressures: [.2, .9],
      inputType: "pen", color: "#000", strokeWidth: 3, mode: "pen", smooth: true
    };
    expect(() => validateProject({ ...base, objects: [stroke] })).not.toThrow();
    expect(() => validateProject({ ...base, objects: [{ ...stroke, pressures: [.2, 2] }] })).toThrow(/stroke/i);
    expect(() => validateProject({ ...base, objects: [{ ...stroke, pressures: [.2] }] })).toThrow(/stroke/i);
  });

  it("rejects arbitrary export formats and malformed payloads", () => {
    expect(() => security.validateExportRequest({ suggestedName: "../../payload.exe", data: "TVqQ", base64: true })).toThrow(/format/i);
    expect(() => security.validateExportRequest({ suggestedName: "board.png", data: {}, base64: true })).toThrow(/Invalid/i);
  });
});
