import { create } from "zustand";
import type { BoardObject, DrawingTool, ToolProperties } from "../models/whiteboard";

interface Snapshot {
  objects: BoardObject[];
}

interface BoardState {
  objects: BoardObject[];
  selectedIds: string[];
  properties: ToolProperties;
  toolProfiles: Record<DrawingTool, ToolProperties>;
  eraserSize: number;
  past: Snapshot[];
  future: Snapshot[];
  clipboard: BoardObject[];
  addObject: (object: BoardObject) => void;
  updateObject: (id: string, patch: Partial<BoardObject>, record?: boolean) => void;
  commitObjectUpdate: (id: string, patch: Partial<BoardObject>, previousPatch: Partial<BoardObject>) => void;
  deleteSelected: () => void;
  removeObject: (id: string) => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  paste: () => void;
  moveSelectionToFront: () => void;
  moveSelectionToBack: () => void;
  toggleSelectionLock: () => void;
  select: (id: string | null, additive?: boolean) => void;
  setProperties: (patch: Partial<ToolProperties>) => void;
  setToolProperties: (tool: DrawingTool, patch: Partial<ToolProperties>) => void;
  setEraserSize: (size: number) => void;
  replaceObjects: (objects: BoardObject[]) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}

const cloneObjects = (objects: BoardObject[]) => structuredClone(objects);
const snapshot = (objects: BoardObject[]): Snapshot => ({ objects: cloneObjects(objects) });

export const useBoardStore = create<BoardState>((set) => ({
  objects: [],
  selectedIds: [],
  properties: {
    strokeColor: "#1485ff",
    fillColor: "#ffffff",
    strokeWidth: 5,
    opacity: 1,
    fillShapes: false,
    smoothInk: true
  },
  toolProfiles: {
    pen: { strokeColor: "#1485ff", fillColor: "#ffffff", strokeWidth: 3, opacity: 1, fillShapes: false, smoothInk: true },
    brush: { strokeColor: "#1485ff", fillColor: "#ffffff", strokeWidth: 12, opacity: .9, fillShapes: false, smoothInk: true },
    highlighter: { strokeColor: "#ffd600", fillColor: "#ffffff", strokeWidth: 18, opacity: .35, fillShapes: false, smoothInk: true },
    marker: { strokeColor: "#202124", fillColor: "#ffffff", strokeWidth: 10, opacity: 1, fillShapes: false, smoothInk: false }
  },
  eraserSize: 24,
  past: [],
  future: [],
  clipboard: [],
  addObject: (object) => set((state) => ({
    objects: [...state.objects, object],
    selectedIds: [object.id],
    past: [...state.past.slice(-199), snapshot(state.objects)],
    future: []
  })),
  updateObject: (id, patch, record = true) => set((state) => ({
    objects: state.objects.map((object) => object.id === id ? { ...object, ...patch } as BoardObject : object),
    past: record ? [...state.past.slice(-199), snapshot(state.objects)] : state.past,
    future: record ? [] : state.future
  })),
  commitObjectUpdate: (id, patch, previousPatch) => set((state) => ({
    objects: state.objects.map((object) => object.id === id ? { ...object, ...patch } as BoardObject : object),
    past: [...state.past.slice(-199), snapshot(state.objects.map((object) =>
      object.id === id ? { ...object, ...previousPatch } as BoardObject : object
    ))],
    future: []
  })),
  deleteSelected: () => set((state) => ({
    objects: state.objects.filter((object) => !state.selectedIds.includes(object.id)),
    selectedIds: [],
    past: [...state.past.slice(-199), snapshot(state.objects)],
    future: []
  })),
  removeObject: (id) => set((state) => ({
    objects: state.objects.filter((object) => object.id !== id),
    selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
    past: [...state.past.slice(-199), snapshot(state.objects)],
    future: []
  })),
  duplicateSelected: () => set((state) => {
    const copies = state.objects.filter((object) => state.selectedIds.includes(object.id)).map((object) => ({
      ...structuredClone(object), id: crypto.randomUUID(), x: object.x + 24, y: object.y + 24
    }));
    return {
      objects: [...state.objects, ...copies],
      selectedIds: copies.map((object) => object.id),
      past: [...state.past.slice(-199), snapshot(state.objects)],
      future: []
    };
  }),
  copySelected: () => set((state) => ({ clipboard: cloneObjects(state.objects.filter((object) => state.selectedIds.includes(object.id))) })),
  paste: () => set((state) => {
    if (!state.clipboard.length) return state;
    const copies = state.clipboard.map((object) => ({ ...structuredClone(object), id: crypto.randomUUID(), x: object.x + 24, y: object.y + 24 }));
    return { objects: [...state.objects, ...copies], selectedIds: copies.map((object) => object.id), clipboard: cloneObjects(copies), past: [...state.past, snapshot(state.objects)], future: [] };
  }),
  moveSelectionToFront: () => set((state) => {
    const selected = state.objects.filter((object) => state.selectedIds.includes(object.id));
    return { objects: [...state.objects.filter((object) => !state.selectedIds.includes(object.id)), ...selected], past: [...state.past, snapshot(state.objects)], future: [] };
  }),
  moveSelectionToBack: () => set((state) => {
    const selected = state.objects.filter((object) => state.selectedIds.includes(object.id));
    return { objects: [...selected, ...state.objects.filter((object) => !state.selectedIds.includes(object.id))], past: [...state.past, snapshot(state.objects)], future: [] };
  }),
  toggleSelectionLock: () => set((state) => ({
    objects: state.objects.map((object) => state.selectedIds.includes(object.id) ? { ...object, locked: !object.locked } : object),
    past: [...state.past, snapshot(state.objects)],
    future: []
  })),
  select: (id, additive = false) => set((state) => ({
    selectedIds: id === null ? [] : additive
      ? state.selectedIds.includes(id) ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id]
      : [id]
  })),
  setProperties: (patch) => set((state) => {
    if (!state.selectedIds.length) return { properties: { ...state.properties, ...patch } };
    const objects = state.objects.map((object) => {
      if (!state.selectedIds.includes(object.id)) return object;
      if (object.type === "stroke") return {
        ...object,
        color: patch.strokeColor ?? object.color,
        strokeWidth: patch.strokeWidth ?? object.strokeWidth,
        opacity: patch.opacity ?? object.opacity,
        smooth: patch.smoothInk ?? object.smooth
      };
      if (object.type === "text") return {
        ...object,
        color: patch.strokeColor ?? object.color,
        opacity: patch.opacity ?? object.opacity
      };
      if ("strokeColor" in object) return {
        ...object,
        strokeColor: patch.strokeColor ?? object.strokeColor,
        fillColor: patch.fillShapes === false
          ? "transparent"
          : patch.fillShapes === true
            ? patch.fillColor ?? state.properties.fillColor
            : patch.fillColor ?? object.fillColor,
        strokeWidth: patch.strokeWidth ?? object.strokeWidth,
        opacity: patch.opacity ?? object.opacity
      };
      return { ...object, opacity: patch.opacity ?? object.opacity };
    });
    return { properties: { ...state.properties, ...patch }, objects, past: [...state.past, snapshot(state.objects)], future: [] };
  }),
  setToolProperties: (tool, patch) => set((state) => {
    const hasMatchingSelection = state.objects.some((object) => object.type === "stroke" && object.mode === tool && state.selectedIds.includes(object.id));
    return {
      toolProfiles: { ...state.toolProfiles, [tool]: { ...state.toolProfiles[tool], ...patch } },
      objects: hasMatchingSelection ? state.objects.map((object) => object.type === "stroke" && object.mode === tool && state.selectedIds.includes(object.id) ? {
        ...object,
        color: patch.strokeColor ?? object.color,
        strokeWidth: patch.strokeWidth ?? object.strokeWidth,
        opacity: patch.opacity ?? object.opacity,
        smooth: patch.smoothInk ?? object.smooth
      } : object) : state.objects,
      past: hasMatchingSelection ? [...state.past, snapshot(state.objects)] : state.past,
      future: hasMatchingSelection ? [] : state.future
    };
  }),
  setEraserSize: (eraserSize) => set({ eraserSize: Math.min(128, Math.max(4, eraserSize)) }),
  replaceObjects: (objects) => set({ objects, selectedIds: [], past: [], future: [], clipboard: [] }),
  clear: () => set({ objects: [], selectedIds: [], past: [], future: [], clipboard: [] }),
  undo: () => set((state) => {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { objects: cloneObjects(previous.objects), past: state.past.slice(0, -1), future: [snapshot(state.objects), ...state.future], selectedIds: [] };
  }),
  redo: () => set((state) => {
    const next = state.future[0];
    if (!next) return state;
    return { objects: cloneObjects(next.objects), past: [...state.past, snapshot(state.objects)], future: state.future.slice(1), selectedIds: [] };
  })
}));
