import { useEffect } from "react";
import {
  FilePlus2, FolderOpen, Menu, Minus, Plus, Redo2, Save, SaveAll, Settings,
  Share, Undo2, ImagePlus, RotateCcw, CircleHelp
} from "lucide-react";
import { useCameraStore } from "../state/cameraStore";
import { useBoardStore } from "../state/boardStore";
import { exportBoard, exportPng, openProject, saveProject } from "../services/projectService";
import { importFiles } from "../services/importService";
import { useUiStore } from "../state/uiStore";
import { useNotificationStore } from "../state/notificationStore";
import { useProjectStore } from "../state/projectStore";
import { IconButton } from "./IconButton";

const fileActions = [
  [FilePlus2, "New"], [FolderOpen, "Open"], [Save, "Save"], [SaveAll, "Save As"],
  [Share, "Export"], [ImagePlus, "Import"]
] as const;

export function MainToolbar() {
  const zoom = useCameraStore((state) => state.zoom);
  const zoomIn = useCameraStore((state) => state.zoomIn);
  const zoomOut = useCameraStore((state) => state.zoomOut);
  const setCamera = useCameraStore((state) => state.setCamera);
  const reset = useCameraStore((state) => state.reset);
  const clear = useBoardStore((state) => state.clear);
  const undo = useBoardStore((state) => state.undo);
  const redo = useBoardStore((state) => state.redo);
  const canUndo = useBoardStore((state) => state.past.length > 0);
  const canRedo = useBoardStore((state) => state.future.length > 0);
  const bringFront = useBoardStore((state) => state.moveSelectionToFront);
  const sendBack = useBoardStore((state) => state.moveSelectionToBack);
  const toggleLock = useBoardStore((state) => state.toggleSelectionLock);
  const toggleSettings = useUiStore((state) => state.toggleSettings);
  const toggleMenu = useUiStore((state) => state.toggleMenu);
  const toggleExportMenu = useUiStore((state) => state.toggleExportMenu);
  const closeMenus = useUiStore((state) => state.closeMenus);
  const menuOpen = useUiStore((state) => state.menuOpen);
  const exportMenuOpen = useUiStore((state) => state.exportMenuOpen);
  const helpMenuOpen = useUiStore((state) => state.helpMenuOpen);
  const toggleHelpMenu = useUiStore((state) => state.toggleHelpMenu);
  const openHelpView = useUiStore((state) => state.openHelpView);
  const notify = useNotificationStore((state) => state.show);
  const run = (operation: Promise<unknown>) => void operation.catch((error: unknown) => notify(error instanceof Error ? error.message : "The operation failed.", "error"));
  useEffect(() => {
    if (!menuOpen && !exportMenuOpen && !helpMenuOpen) return;
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>(".main-toolbar [role='menu'] button")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
      const menu = (document.activeElement as HTMLElement | null)?.closest("[role='menu']");
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
        event.key === "ArrowDown" ? (current + 1 + items.length) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKeyDown); };
  }, [menuOpen, exportMenuOpen, helpMenuOpen, closeMenus]);
  const newProject = () => {
    if (!window.confirm("Clear the current whiteboard? Unsaved changes will be lost.")) return;
    clear();
    reset();
    useProjectStore.getState().setProjectFile(null, "Untitled");
    useProjectStore.getState().setSaveState("saved");
  };
  const zoomPercent = Math.round(zoom * 100);
  const zoomPresets = [25, 50, 75, 100, 125, 150, 200, 400];
  const visibleZoomPresets = zoomPresets.includes(zoomPercent)
    ? zoomPresets
    : [...zoomPresets, zoomPercent].sort((a, b) => a - b);

  return (
    <header className="main-toolbar" role="toolbar" aria-label="Main toolbar">
      <div className="main-menu-wrap">
        <IconButton icon={Menu} label="Main menu" className="menu-button" onClick={toggleMenu} />
        {menuOpen && <div className="main-menu-popover" role="menu" aria-label="Main menu">
          <button role="menuitem" onClick={() => { newProject(); toggleMenu(); }}>New</button>
          <button role="menuitem" onClick={() => { run(openProject()); toggleMenu(); }}>Open…</button>
          <button role="menuitem" onClick={() => { run(saveProject()); toggleMenu(); }}>Save</button>
          <button role="menuitem" onClick={() => { run(importFiles()); toggleMenu(); }}>Import…</button>
          <button role="menuitem" onClick={() => { run(exportPng()); toggleMenu(); }}>Export PNG…</button>
          <button role="menuitem" onClick={() => { run(exportBoard("jpeg")); toggleMenu(); }}>Export JPEG…</button>
          <button role="menuitem" onClick={() => { run(exportBoard("pdf")); toggleMenu(); }}>Export PDF…</button>
          <button role="menuitem" onClick={() => { bringFront(); toggleMenu(); }}>Bring to Front</button>
          <button role="menuitem" onClick={() => { sendBack(); toggleMenu(); }}>Send to Back</button>
          <button role="menuitem" onClick={() => { toggleLock(); toggleMenu(); }}>Lock / Unlock</button>
          <button role="menuitem" onClick={() => { toggleSettings(); toggleMenu(); }}>Settings</button>
        </div>}
      </div>
      {(menuOpen || exportMenuOpen || helpMenuOpen) && <button className="menu-dismiss-layer" type="button" aria-label="Close open menu" onClick={closeMenus} />}
      <div className="brand-name">Creative Whiteboard</div>
      <div className="toolbar-group file-actions">
        {fileActions.map(([Icon, label]) => (
          <div className="toolbar-action-wrap" key={label}>
          <button type="button" className="labeled-action" aria-label={label} onClick={() => {
            if (label === "New") newProject();
            if (label === "Open") run(openProject());
            if (label === "Save") run(saveProject());
            if (label === "Save As") run(saveProject(true));
            if (label === "Export") toggleExportMenu();
            if (label === "Import") run(importFiles());
          }}>
            <Icon size={17} /><span>{label}</span>
          </button>
          {label === "Export" && exportMenuOpen && <div className="export-menu-popover" role="menu" aria-label="Export">
            <button role="menuitem" onClick={() => { run(exportBoard("png")); closeMenus(); }}>PNG image</button>
            <button role="menuitem" onClick={() => { run(exportBoard("jpeg")); closeMenus(); }}>JPEG image</button>
            <button role="menuitem" onClick={() => { run(exportBoard("pdf")); closeMenus(); }}>PDF document</button>
            <button role="menuitem" onClick={() => { run(saveProject(true)); closeMenus(); }}>Creative Whiteboard project</button>
          </div>}
          </div>
        ))}
      </div>
      <div className="toolbar-spacer" />
      <div className="toolbar-group history-actions">
        <IconButton icon={Undo2} label="Undo" disabled={!canUndo} onClick={undo} />
        <IconButton icon={Redo2} label="Redo" disabled={!canRedo} onClick={redo} />
      </div>
      <div className="toolbar-group zoom-controls">
        <IconButton icon={Minus} label="Zoom out" onClick={zoomOut} />
        <select
          aria-label="Zoom level"
          value={zoomPercent}
          onChange={(event) => setCamera({ zoom: Number(event.target.value) / 100 })}
        >
          {visibleZoomPresets.map((preset) => <option value={preset} key={preset}>{preset}%</option>)}
        </select>
        <IconButton icon={Plus} label="Zoom in" onClick={zoomIn} />
      </div>
      <div className="toolbar-spacer" />
      <IconButton icon={RotateCcw} label="Reset view" onClick={reset} />
      <div className="toolbar-action-wrap help-menu-wrap">
        <IconButton icon={CircleHelp} label="Help" onClick={toggleHelpMenu} />
        {helpMenuOpen && <div className="help-menu-popover" role="menu" aria-label="Help">
          <button role="menuitem" onClick={() => openHelpView("guide")}>Help &amp; User Guide</button>
          <button role="menuitem" onClick={() => openHelpView("faq")}>Frequently Asked Questions</button>
          <button role="menuitem" onClick={() => openHelpView("shortcuts")}>Keyboard Shortcuts</button>
          <button role="menuitem" onClick={() => { closeMenus(); notify("Report problems privately to the support contact shown in About.", "info"); }}>Report a Problem</button>
          <button role="menuitem" onClick={() => { closeMenus(); notify("Secure automatic updates are not configured in this build.", "info"); }}>Check for Updates</button>
          <button role="menuitem" onClick={() => openHelpView("about")}>About Creative Whiteboard</button>
        </div>}
      </div>
      <IconButton icon={Settings} label="Settings" onClick={toggleSettings} />
    </header>
  );
}
