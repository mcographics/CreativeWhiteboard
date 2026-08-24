const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopWindow", {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  setResolution: (width, height) => ipcRenderer.invoke("window:set-resolution", { width, height }),
  setMode: (mode) => ipcRenderer.invoke("window:set-mode", mode),
  close: () => ipcRenderer.send("window:close"),
  setDirty: (dirty) => ipcRenderer.send("window:set-dirty", dirty),
  onSaveBeforeClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("window:save-before-close", listener);
    return () => ipcRenderer.removeListener("window:save-before-close", listener);
  },
  finishSaveBeforeClose: (saved) => ipcRenderer.send("window:save-before-close-complete", saved),
  onDiscardRecoveryBeforeClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("window:discard-recovery-before-close", listener);
    return () => ipcRenderer.removeListener("window:discard-recovery-before-close", listener);
  },
  finishDiscardRecoveryBeforeClose: () => ipcRenderer.send("window:discard-recovery-before-close-complete")
});

contextBridge.exposeInMainWorld("desktopFiles", {
  openProject: () => ipcRenderer.invoke("project:open"),
  saveProject: (request) => ipcRenderer.invoke("project:save", request),
  importFiles: () => ipcRenderer.invoke("files:import"),
  saveExport: (request) => ipcRenderer.invoke("export:save", request)
});

contextBridge.exposeInMainWorld("desktopExternal", {
  openApprovedHttps: (url) => ipcRenderer.invoke("external:open-approved", url)
});

contextBridge.exposeInMainWorld("desktopFonts", {
  listSystemFonts: () => ipcRenderer.invoke("fonts:list-system")
});
