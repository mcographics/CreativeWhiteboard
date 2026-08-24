const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { getFonts } = require("font-list");
const {
  MAX_PROJECT_BYTES, safeDisplayName, extensionOf, validateImportBuffer, validateProjectText,
  validateExportRequest, isApprovedHttpsUrl, isTrustedIpcSender, sanitizeFontFamilies
} = require("./security.cjs");
const appInfo = require("../app-info.json");

const isDevelopment = !app.isPackaged;
const approvedProjectPaths = new Set();
let importDialogOpen = false;
let systemFontCache = null;
let activeSplashWindow = null;
const approvedOrigins = new Set([appInfo.officialWebsite, appInfo.privacyPolicyLocation].filter((value) => /^https:\/\//i.test(value)).map((value) => new URL(value).origin));

function trustedSender(event) {
  return isTrustedIpcSender(event);
}

function getApplicationIcon() {
  return isDevelopment
    ? path.join(__dirname, "..", "app_icon.png")
    : path.join(process.resourcesPath, "app_icon.png");
}

function createSplashWindow() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const splash = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    fullscreen: true,
    fullscreenable: true,
    kiosk: true,
    transparent: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#030a18",
    webPreferences: {
      preload: path.join(__dirname, "splash-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false
    }
  });
  splash.setMenuBarVisibility(false);
  splash.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  splash.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`Splash screen failed to load (${errorCode}: ${errorDescription}).`);
  });
  splash.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  splash.once("ready-to-show", () => {
    splash.setKiosk(true);
    splash.setFullScreen(true);
    splash.setBounds(display.bounds, false);
    splash.setAlwaysOnTop(true, "screen-saver");
    splash.show();
    splash.focus();
  });
  void splash.loadFile(path.join(__dirname, "splash.html"));
  return splash;
}

function revealMainWindow(window, splash) {
  if (!splash || splash.isDestroyed()) {
    window.show();
    return;
  }
  let opacity = 1;
  const fade = setInterval(() => {
    opacity = Math.max(0, opacity - 0.1);
    if (!splash.isDestroyed()) splash.setOpacity(opacity);
    if (opacity <= 0) {
      clearInterval(fade);
      if (!splash.isDestroyed()) splash.close();
      window.show();
    }
  }, 24);
}

function createMainWindow(onReady) {
  const window = new BrowserWindow({
    title: "Creative Whiteboard",
    icon: getApplicationIcon(),
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: "#191b1d",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false
    }
  });
  window.__creativeWhiteboardDirty = false;
  window.__creativeWhiteboardAllowClose = false;
  window.__creativeWhiteboardClosePromptOpen = false;

  window.on("close", async (event) => {
    if (window.__creativeWhiteboardAllowClose || !window.__creativeWhiteboardDirty) return;
    event.preventDefault();
    if (window.__creativeWhiteboardClosePromptOpen) return;
    window.__creativeWhiteboardClosePromptOpen = true;
    const result = await dialog.showMessageBox(window, {
      type: "question",
      title: "Save changes?",
      message: "Do you want to save your changes before closing Creative Whiteboard?",
      detail: "Unsaved changes will be lost if you choose Don’t Save.",
      buttons: ["Save", "Don’t Save", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    });
    if (result.response === 0) {
      window.webContents.send("window:save-before-close");
      return;
    }
    window.__creativeWhiteboardClosePromptOpen = false;
    if (result.response === 1) {
      window.webContents.send("window:discard-recovery-before-close");
    }
  });

  window.once("ready-to-show", () => {
    window.maximize();
    if (onReady) onReady(window);
    else window.show();
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    const expected = isDevelopment ? new URL(process.env.CREATIVE_WHITEBOARD_DEV_URL ?? "http://127.0.0.1:1420").origin : "file://";
    if ((isDevelopment && new URL(url).origin !== expected) || (!isDevelopment && !url.startsWith("file://"))) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error(`Renderer stopped unexpectedly (${details.reason}).`);
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`Application interface failed to load (${errorCode}: ${errorDescription}).`);
  });

  if (isDevelopment) {
    const developmentUrl = process.env.CREATIVE_WHITEBOARD_DEV_URL ?? "http://127.0.0.1:1420";
    void window.loadURL(developmentUrl);
  } else {
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
  return window;
}

app.whenReady().then(() => {
  ipcMain.handle("splash:get-icon", async (event) => {
    if (!activeSplashWindow || activeSplashWindow.isDestroyed() || event.sender !== activeSplashWindow.webContents) {
      throw new Error("Unauthorized request.");
    }
    const icon = await fs.readFile(getApplicationIcon());
    return `data:image/png;base64,${icon.toString("base64")}`;
  });
  ipcMain.on("window:minimize", (event) => { if (trustedSender(event)) BrowserWindow.fromWebContents(event.sender)?.minimize(); });
  ipcMain.on("window:toggle-maximize", (event) => {
    if (!trustedSender(event)) return;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    window.isMaximized() ? window.unmaximize() : window.maximize();
  });
  ipcMain.on("window:close", (event) => { if (trustedSender(event)) BrowserWindow.fromWebContents(event.sender)?.close(); });
  ipcMain.on("window:set-dirty", (event, dirty) => {
    if (!trustedSender(event) || typeof dirty !== "boolean") return;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.__creativeWhiteboardDirty = Boolean(dirty);
  });
  ipcMain.on("window:save-before-close-complete", (event, saved) => {
    if (!trustedSender(event) || typeof saved !== "boolean") return;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    window.__creativeWhiteboardClosePromptOpen = false;
    if (saved) {
      window.__creativeWhiteboardDirty = false;
      window.__creativeWhiteboardAllowClose = true;
      window.close();
    }
  });
  ipcMain.on("window:discard-recovery-before-close-complete", (event) => {
    if (!trustedSender(event)) return;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    window.__creativeWhiteboardClosePromptOpen = false;
    window.__creativeWhiteboardDirty = false;
    window.__creativeWhiteboardAllowClose = true;
    window.close();
  });
  ipcMain.handle("window:set-resolution", (event, request) => {
    if (!trustedSender(event) || !request || typeof request !== "object") throw new Error("Unauthorized request.");
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;
    const width = Math.max(800, Math.min(7680, Math.round(Number(request.width) || 1920)));
    const height = Math.max(600, Math.min(4320, Math.round(Number(request.height) || 1080)));
    const display = screen.getDisplayMatching(window.getBounds());
    const scaleFactor = display.scaleFactor || 1;
    const nativeWidth = Math.round(display.bounds.width * scaleFactor);
    const nativeHeight = Math.round(display.bounds.height * scaleFactor);
    if (width > nativeWidth || height > nativeHeight) {
      return {
        allowed: false,
        requestedWidth: width,
        requestedHeight: height,
        monitorWidth: nativeWidth,
        monitorHeight: nativeHeight,
        reason: `The selected ${width} × ${height} resolution exceeds this monitor's ${nativeWidth} × ${nativeHeight} native resolution.`
      };
    }
    const dipWidth = Math.round(width / scaleFactor);
    const dipHeight = Math.round(height / scaleFactor);
    if (window.isFullScreen()) window.setFullScreen(false);
    if (window.isMaximized()) window.unmaximize();
    window.setResizable(true);
    window.setBounds({
      x: display.bounds.x + Math.round((display.bounds.width - dipWidth) / 2),
      y: display.bounds.y + Math.round((display.bounds.height - dipHeight) / 2),
      width: dipWidth,
      height: dipHeight
    }, false);
    const applied = window.getBounds();
    return {
      allowed: true,
      requestedWidth: width,
      requestedHeight: height,
      appliedWidth: Math.round(applied.width * scaleFactor),
      appliedHeight: Math.round(applied.height * scaleFactor),
      monitorWidth: nativeWidth,
      monitorHeight: nativeHeight,
      fitted: false
    };
  });
  ipcMain.handle("window:set-mode", (event, mode) => {
    if (!trustedSender(event) || !["windowed", "fullscreen-windowed", "borderless"].includes(mode)) throw new Error("Invalid window mode.");
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;
    if (mode === "windowed") {
      window.setFullScreen(false);
      if (window.isMaximized()) window.unmaximize();
    } else if (mode === "fullscreen-windowed") {
      window.setFullScreen(false);
      window.maximize();
    } else {
      if (window.isMaximized()) window.unmaximize();
      window.setFullScreen(true);
    }
    return mode;
  });
  ipcMain.handle("project:open", async (event) => {
    if (!trustedSender(event)) throw new Error("Unauthorized request.");
    const result = await dialog.showOpenDialog({
      title: "Open Creative Whiteboard Project",
      filters: [{ name: "Creative Whiteboard", extensions: ["cwb"] }, { name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = path.resolve(result.filePaths[0]);
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_PROJECT_BYTES || !["cwb", "json"].includes(extensionOf(filePath))) throw new Error("The selected project is unsupported or too large.");
    const data = await fs.readFile(filePath, "utf8");
    validateProjectText(data);
    approvedProjectPaths.add(filePath);
    return { filePath, data };
  });
  ipcMain.handle("project:save", async (event, request) => {
    if (!trustedSender(event) || !request || typeof request !== "object") throw new Error("Unauthorized request.");
    validateProjectText(request.data);
    let filePath = typeof request.filePath === "string" ? path.resolve(request.filePath) : null;
    if (!filePath || request.saveAs || !approvedProjectPaths.has(filePath)) {
      const result = await dialog.showSaveDialog({
        title: "Save Creative Whiteboard Project",
        defaultPath: `${safeDisplayName(request.suggestedName || "Untitled").replace(/\.(json|cwb)$/i, "")}.cwb`,
        filters: [{ name: "Creative Whiteboard", extensions: ["cwb"] }]
      });
      if (result.canceled || !result.filePath) return null;
      filePath = path.resolve(result.filePath);
    }
    if (extensionOf(filePath) !== "cwb") filePath += ".cwb";
    approvedProjectPaths.add(filePath);
    const temporaryPath = `${filePath}.tmp`;
    await fs.writeFile(temporaryPath, request.data, "utf8");
    await fs.rename(temporaryPath, filePath).catch(async () => {
      await fs.copyFile(temporaryPath, filePath);
      await fs.unlink(temporaryPath);
    });
    return filePath;
  });
  ipcMain.handle("files:import", async (event) => {
    if (!trustedSender(event)) throw new Error("Unauthorized request.");
    if (importDialogOpen) return [];
    importDialogOpen = true;
    try {
      const result = await dialog.showOpenDialog({
        title: "Import Files",
        filters: [
          { name: "Supported files", extensions: ["png", "jpg", "jpeg", "webp", "pdf", "txt", "md"] }
        ],
        properties: ["openFile", "multiSelections"]
      });
      if (result.canceled) return [];
      const imported = [];
      for (const selectedPath of result.filePaths.slice(0, 20)) {
        const filePath = path.resolve(selectedPath);
        const extension = extensionOf(filePath);
        const buffer = await fs.readFile(filePath);
        const detected = validateImportBuffer(buffer, extension);
        imported.push({ fileName: safeDisplayName(filePath), extension: detected.extension, mimeType: detected.mimeType, data: buffer.toString("base64") });
      }
      return imported;
    } finally {
      importDialogOpen = false;
    }
  });
  ipcMain.handle("export:save", async (event, request) => {
    if (!trustedSender(event)) throw new Error("Unauthorized request.");
    const validated = validateExportRequest(request);
    const result = await dialog.showSaveDialog({
      title: "Export Whiteboard",
      defaultPath: validated.suggestedName,
      filters: validated.filters
    });
    if (result.canceled || !result.filePath) return null;
    const requiredExtension = validated.filters[0].extensions[0];
    const outputPath = extensionOf(result.filePath) === requiredExtension ? result.filePath : `${result.filePath}.${requiredExtension}`;
    const payload = Buffer.from(validated.data, "base64");
    await fs.writeFile(outputPath, payload, { mode: 0o600 });
    return outputPath;
  });
  ipcMain.handle("external:open-approved", async (event, url) => {
    if (!trustedSender(event) || typeof url !== "string" || !isApprovedHttpsUrl(url, approvedOrigins)) throw new Error("This external address is not approved.");
    await shell.openExternal(url, { activate: true });
    return true;
  });
  ipcMain.handle("fonts:list-system", async (event) => {
    if (!trustedSender(event)) throw new Error("Unauthorized request.");
    if (systemFontCache) return systemFontCache;
    const fonts = await getFonts();
    systemFontCache = sanitizeFontFamilies(fonts);
    return systemFontCache;
  });

  const splash = createSplashWindow();
  activeSplashWindow = splash;
  splash.once("closed", () => {
    if (activeSplashWindow === splash) activeSplashWindow = null;
  });
  let mainWindowReady = false;
  let splashFinished = false;
  let mainWindow = null;
  let revealed = false;
  const revealWhenReady = () => {
    if (revealed || !mainWindowReady || !splashFinished || !mainWindow) return;
    revealed = true;
    revealMainWindow(mainWindow, splash);
  };
  ipcMain.once("splash:complete", (event) => {
    if (splash.isDestroyed() || event.sender !== splash.webContents) return;
    splashFinished = true;
    revealWhenReady();
  });
  mainWindow = createMainWindow(() => {
    mainWindowReady = true;
    revealWhenReady();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
