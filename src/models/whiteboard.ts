export type BoardObject =
  | StrokeObject
  | ShapeObject
  | TextObject
  | NoteObject
  | ImageObject
  | DocumentObject;

export interface BoardObjectBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
}

export interface StrokeObject extends BoardObjectBase {
  type: "stroke";
  points: number[];
  pressures?: number[];
  inputType?: "mouse" | "pen" | "touch";
  color: string;
  strokeWidth: number;
  mode: "pen" | "brush" | "highlighter" | "marker";
  smooth: boolean;
}

export interface ShapeObject extends BoardObjectBase {
  type: "rectangle" | "ellipse" | "triangle" | "star" | "arrow" | "badge" | "comment";
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
}

export interface TextObject extends BoardObjectBase {
  type: "text";
  text: string;
  color: string;
  fontSize: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface NoteObject extends BoardObjectBase {
  type: "note";
  variant?: "sticky" | "comment";
  note: string;
  color: string;
  backgroundColor: string;
  fontSize: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface ImageObject extends BoardObjectBase {
  type: "image";
  fileName: string;
  dataUrl: string;
}

export interface DocumentObject extends BoardObjectBase {
  type: "document" | "pdf";
  fileName: string;
  dataUrl: string;
  textContent?: string;
  collapsed: boolean;
  documentZoom: number;
  currentPage: number;
  pageCount?: number;
}

export interface BoardProject {
  format: "creative-whiteboard-project";
  schemaVersion: 1;
  title: string;
  objects: BoardObject[];
  camera: { x: number; y: number; zoom: number };
  background: string;
}

export interface ToolProperties {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fillShapes: boolean;
  smoothInk: boolean;
}

export type DrawingTool = "pen" | "brush" | "highlighter" | "marker";
