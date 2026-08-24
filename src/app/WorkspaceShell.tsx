import { useEffect } from "react";
import { InfiniteCanvas } from "../canvas/InfiniteCanvas";
import { MainToolbar } from "../components/MainToolbar";
import { PropertiesPanel } from "../components/PropertiesPanel";
import { ToolRail } from "../components/ToolRail";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";
import { SettingsDialog } from "../components/SettingsDialog";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useRecovery } from "../hooks/useRecovery";
import { NotificationToast } from "../components/NotificationToast";
import { saveProject } from "../services/projectService";
import { useResolvedAppearance } from "../hooks/useResolvedAppearance";
import { HelpCenter } from "../components/HelpCenter";
import appInfo from "../../app-info.json";

export function WorkspaceShell() {
  useKeyboardShortcuts();
  useRecovery();
  const title = useProjectStore((state) => state.title);
  const saveState = useProjectStore((state) => state.saveState);
  const windowTitle = `${title}${saveState === "unsaved" ? "*" : ""} — Creative Whiteboard`;
  const railCollapsed = useUiStore((state) => state.railCollapsed);
  const interfaceScale = useUiStore((state) => state.interfaceScale);
  const windowMode = useUiStore((state) => state.windowMode);
  const resolvedAppearance = useResolvedAppearance();

  useEffect(() => {
    window.desktopWindow?.setDirty(saveState === "unsaved" || saveState === "failed");
  }, [saveState]);

  useEffect(() => {
    void window.desktopWindow?.setMode(windowMode);
  }, [windowMode]);

  useEffect(() => window.desktopWindow?.onSaveBeforeClose(() => {
    void saveProject()
      .then((saved) => window.desktopWindow?.finishSaveBeforeClose(saved))
      .catch(() => window.desktopWindow?.finishSaveBeforeClose(false));
  }), []);

  return (
    <main
      className={`app-shell ${railCollapsed ? "rail-is-collapsed" : ""}`}
      data-theme={resolvedAppearance}
      aria-label={windowTitle}
      style={{ zoom: interfaceScale }}
    >
      <div className="window-titlebar">
        <div className="window-title">
          <strong>{windowTitle}</strong>
          <span className="development-build">Dev Build {appInfo.buildNumber}</span>
        </div>
        <div className="window-controls">
          <button type="button" aria-label="Minimize window" onClick={() => window.desktopWindow?.minimize()}>−</button>
          <button type="button" aria-label="Maximize or restore window" onClick={() => window.desktopWindow?.toggleMaximize()}>▢</button>
          <button type="button" aria-label="Close window" onClick={() => window.desktopWindow?.close()}>×</button>
        </div>
      </div>
      <MainToolbar />
      <section className="workspace">
        <ToolRail />
        <InfiniteCanvas />
        <PropertiesPanel />
      </section>
      <SettingsDialog />
      <HelpCenter />
      <NotificationToast />
    </main>
  );
}
