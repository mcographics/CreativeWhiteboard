export {};

declare global {
  interface Window {
    desktopWindow?: {
      minimize: () => void;
      toggleMaximize: () => void;
      setResolution: (width: number, height: number) => Promise<{
        allowed: boolean;
        requestedWidth: number;
        requestedHeight: number;
        appliedWidth?: number;
        appliedHeight?: number;
        monitorWidth: number;
        monitorHeight: number;
        fitted?: boolean;
        reason?: string;
      } | null>;
      setMode: (mode: "windowed" | "fullscreen-windowed" | "borderless") => Promise<string | null>;
      close: () => void;
      setDirty: (dirty: boolean) => void;
      onSaveBeforeClose: (callback: () => void) => () => void;
      finishSaveBeforeClose: (saved: boolean) => void;
      onDiscardRecoveryBeforeClose: (callback: () => void) => () => void;
      finishDiscardRecoveryBeforeClose: () => void;
    };
    desktopFiles?: {
      openProject: () => Promise<{ filePath: string; data: string } | null>;
      saveProject: (request: { filePath: string | null; saveAs: boolean; suggestedName: string; data: string }) => Promise<string | null>;
      importFiles: () => Promise<Array<{ fileName: string; extension: string; mimeType: string; data: string }>>;
      saveExport: (request: { suggestedName: string; filters: Array<{ name: string; extensions: string[] }>; data: string; base64: boolean }) => Promise<string | null>;
    };
    desktopExternal?: {
      openApprovedHttps: (url: string) => Promise<boolean>;
    };
    desktopFonts?: {
      listSystemFonts: () => Promise<string[]>;
    };
  }
}
