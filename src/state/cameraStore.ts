import { create } from "zustand";

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

interface CameraActions {
  setCamera: (camera: Partial<CameraState>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

const clampZoom = (zoom: number) => Math.min(32, Math.max(0.05, zoom));

export const useCameraStore = create<CameraState & CameraActions>((set) => ({
  x: 0,
  y: 0,
  zoom: 1,
  setCamera: (camera) => set(camera),
  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom * 1.2) })),
  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom / 1.2) })),
  reset: () => set({ x: 0, y: 0, zoom: 1 })
}));
