import { create } from "zustand";

interface SelectionState {
  selectedIds: string[];
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: [],
  clearSelection: () => set({ selectedIds: [] })
}));
