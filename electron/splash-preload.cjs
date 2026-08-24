const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("splashBridge", {
  getIconDataUrl: () => ipcRenderer.invoke("splash:get-icon"),
  complete: () => ipcRenderer.send("splash:complete")
});
