import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SidebarPanelId } from "../models/ui";

interface UiState {
  sidebarOpen: boolean;
  minimapOpen: boolean;
  railCollapsed: boolean;
  settingsOpen: boolean;
  menuOpen: boolean;
  propertiesOpen: boolean;
  exportMenuOpen: boolean;
  helpMenuOpen: boolean;
  helpView: "guide" | "faq" | "shortcuts" | "about" | "license" | "notices" | "privacy" | "security" | null;
  gridVisible: boolean;
  appearance: "dark" | "light" | "system" | "auto";
  interfaceScale: number;
  windowMode: "windowed" | "fullscreen-windowed" | "borderless";
  applicationResolution: { width: number; height: number };
  exportScale: number;
  stylusPressureEnabled: boolean;
  palmRejectionEnabled: boolean;
  expandedPanels: SidebarPanelId[];
  typingRequest: { kind: "text" | "comment" | "sticky"; id: number } | null;
  toggleSidebar: () => void;
  setMinimapOpen: (visible: boolean) => void;
  toggleRail: () => void;
  toggleSettings: () => void;
  toggleMenu: () => void;
  toggleProperties: () => void;
  toggleExportMenu: () => void;
  toggleHelpMenu: () => void;
  openHelpView: (view: NonNullable<UiState["helpView"]>) => void;
  closeHelpView: () => void;
  closeMenus: () => void;
  setGridVisible: (visible: boolean) => void;
  setAppearance: (appearance: "dark" | "light" | "system" | "auto") => void;
  setInterfaceScale: (scale: number) => void;
  setWindowMode: (mode: UiState["windowMode"]) => void;
  setApplicationResolution: (resolution: UiState["applicationResolution"]) => void;
  setExportScale: (scale: number) => void;
  setStylusPressureEnabled: (enabled: boolean) => void;
  setPalmRejectionEnabled: (enabled: boolean) => void;
  startTyping: (kind: "text" | "comment" | "sticky") => void;
  togglePanel: (panel: SidebarPanelId) => void;
}

export const useUiStore = create<UiState>()(persist((set) => ({
  sidebarOpen: true,
  minimapOpen: true,
  railCollapsed: false,
  settingsOpen: false,
  menuOpen: false,
  propertiesOpen: true,
  exportMenuOpen: false,
  helpMenuOpen: false,
  helpView: null,
  gridVisible: true,
  appearance: "dark",
  interfaceScale: 1,
  windowMode: "fullscreen-windowed",
  applicationResolution: { width: 1920, height: 1080 },
  exportScale: 1,
  stylusPressureEnabled: true,
  palmRejectionEnabled: true,
  expandedPanels: ["layers", "properties"],
  typingRequest: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setMinimapOpen: (minimapOpen) => set({ minimapOpen }),
  toggleRail: () => set((state) => ({ railCollapsed: !state.railCollapsed })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  toggleMenu: () => set((state) => ({ menuOpen: !state.menuOpen, exportMenuOpen: false, helpMenuOpen: false })),
  toggleProperties: () => set((state) => ({ propertiesOpen: !state.propertiesOpen })),
  toggleExportMenu: () => set((state) => ({ exportMenuOpen: !state.exportMenuOpen, menuOpen: false, helpMenuOpen: false })),
  toggleHelpMenu: () => set((state) => ({ helpMenuOpen: !state.helpMenuOpen, menuOpen: false, exportMenuOpen: false })),
  openHelpView: (helpView) => set({ helpView, helpMenuOpen: false }),
  closeHelpView: () => set({ helpView: null }),
  closeMenus: () => set({ menuOpen: false, exportMenuOpen: false, helpMenuOpen: false }),
  setGridVisible: (gridVisible) => set({ gridVisible }),
  setAppearance: (appearance) => set({ appearance }),
  setInterfaceScale: (interfaceScale) => set({ interfaceScale: Math.min(1.5, Math.max(.8, interfaceScale)) }),
  setWindowMode: (windowMode) => set({ windowMode }),
  setApplicationResolution: (applicationResolution) => set({ applicationResolution }),
  setExportScale: (exportScale) => set({ exportScale }),
  setStylusPressureEnabled: (stylusPressureEnabled) => set({ stylusPressureEnabled }),
  setPalmRejectionEnabled: (palmRejectionEnabled) => set({ palmRejectionEnabled }),
  startTyping: (kind) => set({ typingRequest: { kind, id: Date.now() + Math.random() } }),
  togglePanel: (panel) => set((state) => ({
    expandedPanels: state.expandedPanels.includes(panel)
      ? state.expandedPanels.filter((item) => item !== panel)
      : [...state.expandedPanels, panel]
  }))
}), {
  name: "creative-whiteboard-ui-preferences",
  partialize: (state) => ({
    minimapOpen: state.minimapOpen,
    gridVisible: state.gridVisible,
    appearance: state.appearance,
    interfaceScale: state.interfaceScale,
    windowMode: state.windowMode,
    applicationResolution: state.applicationResolution,
    stylusPressureEnabled: state.stylusPressureEnabled,
    palmRejectionEnabled: state.palmRejectionEnabled
  }),
  version: 3,
  migrate: (persisted) => {
    const previous = persisted as Partial<UiState> | undefined;
    return {
      minimapOpen: previous?.minimapOpen ?? true,
      gridVisible: previous?.gridVisible ?? true,
      appearance: previous?.appearance ?? "dark",
      interfaceScale: previous?.interfaceScale ?? 1,
      windowMode: previous?.windowMode ?? "fullscreen-windowed",
      applicationResolution: previous?.applicationResolution ?? { width: 1920, height: 1080 },
      stylusPressureEnabled: previous?.stylusPressureEnabled ?? true,
      palmRejectionEnabled: previous?.palmRejectionEnabled ?? true
    };
  }
}));
