import { useEffect } from "react";
import type { ToolId } from "../models/ui";
import { useBoardStore } from "../state/boardStore";
import { useCameraStore } from "../state/cameraStore";
import { useToolStore } from "../state/toolStore";
import { useUiStore } from "../state/uiStore";
import { openProject, saveProject } from "../services/projectService";
import { useNotificationStore } from "../state/notificationStore";

const toolShortcuts: Partial<Record<string, ToolId>> = {
  v: "select", h: "hand", p: "pen", b: "brush", m: "marker", e: "eraser", t: "text", n: "sticky-note", r: "rectangle", l: "underline"
};

export function useKeyboardShortcuts() {
  useEffect(() => {
    const run = (operation: Promise<unknown>) => void operation.catch((error: unknown) =>
      useNotificationStore.getState().show(error instanceof Error ? error.message : "The operation failed.", "error")
    );
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input,textarea,select,[contenteditable=true]")) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey) {
        if (key === "s") { event.preventDefault(); run(saveProject(event.shiftKey)); }
        if (key === "o") { event.preventDefault(); run(openProject()); }
        if (key === "a") { event.preventDefault(); useBoardStore.setState({ selectedIds: useBoardStore.getState().objects.map((object) => object.id) }); }
        if (key === "c") { event.preventDefault(); useBoardStore.getState().copySelected(); }
        if (key === "v") { event.preventDefault(); useBoardStore.getState().paste(); }
        if (key === "x") { event.preventDefault(); useBoardStore.getState().copySelected(); useBoardStore.getState().deleteSelected(); }
        return;
      }
      const tool = toolShortcuts[key];
      if (tool) {
        if (tool !== "select") useBoardStore.getState().select(null);
        useToolStore.getState().setActiveTool(tool);
      }
      if (key === "+" || key === "=") useCameraStore.getState().zoomIn();
      if (key === "-") useCameraStore.getState().zoomOut();
      if (key === "1") useCameraStore.getState().reset();
      if (key === "escape") {
        useBoardStore.getState().select(null);
        useUiStore.getState().closeMenus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
