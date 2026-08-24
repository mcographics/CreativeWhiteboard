import { create } from "zustand";
import type { ToolId } from "../models/ui";

interface ToolState {
  activeTool: ToolId;
  setActiveTool: (tool: ToolId) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: "select",
  setActiveTool: (activeTool) => set({ activeTool })
}));
