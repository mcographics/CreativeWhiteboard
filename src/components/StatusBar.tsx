import { Grid3X3, Magnet } from "lucide-react";
import { useCameraStore } from "../state/cameraStore";
import { useProjectStore } from "../state/projectStore";
import { useSelectionStore } from "../state/selectionStore";
import { useToolStore } from "../state/toolStore";
import { useUiStore } from "../state/uiStore";

export function StatusBar() {
  const zoom = useCameraStore((state) => state.zoom);
  const activeTool = useToolStore((state) => state.activeTool);
  const selectedCount = useSelectionStore((state) => state.selectedIds.length);
  const { saveState, objectCount } = useProjectStore();
  const gridVisible = useUiStore((state) => state.gridVisible);

  return (
    <footer className="status-bar">
      <span>X 0&nbsp;&nbsp; Y 0</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span><Grid3X3 size={13} /> Grid {gridVisible ? "on" : "off"}</span>
      <span><Magnet size={13} /> Snap off</span>
      <span className="status-grow">Tool: {activeTool.replace("-", " ")}</span>
      <span className={`save-state ${saveState}`}>{saveState === "saved" ? "Saved" : saveState}</span>
      <span>{selectedCount} selected</span>
      <span>{objectCount} objects</span>
    </footer>
  );
}
