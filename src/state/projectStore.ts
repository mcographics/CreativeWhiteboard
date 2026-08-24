import { create } from "zustand";

export type SaveState = "saved" | "saving" | "unsaved" | "failed";

interface ProjectState {
  title: string;
  filePath: string | null;
  saveState: SaveState;
  objectCount: number;
  setTitle: (title: string) => void;
  setProjectFile: (filePath: string | null, title?: string) => void;
  setSaveState: (saveState: SaveState) => void;
  markUnsaved: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  title: "Untitled",
  filePath: null,
  saveState: "saved",
  objectCount: 0,
  setTitle: (title) => set({ title }),
  setProjectFile: (filePath, title) => set((state) => ({ filePath, title: title ?? state.title })),
  setSaveState: (saveState) => set({ saveState }),
  markUnsaved: () => set({ saveState: "unsaved" })
}));
