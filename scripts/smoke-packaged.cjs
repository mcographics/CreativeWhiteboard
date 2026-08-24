const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const WebSocket = require("ws");

const executablePath = path.resolve(process.argv[2] || "");
if (!executablePath.toLowerCase().endsWith(".exe")) {
  throw new Error("Pass the packaged CreativeWhiteboard.exe path.");
}

const port = 9320 + Math.floor(Math.random() * 200);
const artifactDirectory = path.resolve(__dirname, "..", "test-artifacts");
const userDataDirectory = path.join(os.tmpdir(), `creative-whiteboard-smoke-${Date.now()}`);
const endpoint = `http://127.0.0.1:${port}/json/list`;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function targets() {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`DevTools endpoint returned ${response.status}.`);
  return response.json();
}

async function waitForTarget(predicate, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const match = (await targets()).find(predicate);
      if (match) return match;
    } catch {
      // The packaged process may still be starting.
    }
    await delay(150);
  }
  throw new Error("Timed out waiting for the packaged application window.");
}

function connect(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    let requestId = 0;
    const pending = new Map();
    socket.once("open", () => {
      resolve({
        call(method, params = {}) {
          return new Promise((callResolve, callReject) => {
            requestId += 1;
            pending.set(requestId, { resolve: callResolve, reject: callReject });
            socket.send(JSON.stringify({ id: requestId, method, params }));
          });
        },
        close() {
          socket.close();
        }
      });
    });
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      const handler = pending.get(message.id);
      if (!handler) return;
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    });
    socket.once("error", reject);
  });
}

async function run() {
  await fs.mkdir(artifactDirectory, { recursive: true });
  const child = spawn(executablePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDirectory}`,
    "--no-first-run"
  ], {
    stdio: "ignore",
    windowsHide: true,
    env: Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "ELECTRON_RUN_AS_NODE"))
  });

  try {
    const splashTarget = await waitForTarget((target) => target.title === "Creative Whiteboard is starting");
    const splashClient = await connect(splashTarget.webSocketDebuggerUrl);
    const screenshot = await splashClient.call("Page.captureScreenshot", { format: "png", fromSurface: true });
    const splashPath = path.join(artifactDirectory, "packaged-splash.png");
    await fs.writeFile(splashPath, Buffer.from(screenshot.data, "base64"));
    splashClient.close();

    const mainTarget = await waitForTarget((target) => target.title === "Creative Whiteboard");
    const mainClient = await connect(mainTarget.webSocketDebuggerUrl);
    const deadline = Date.now() + 20_000;
    let applicationReady = false;
    while (Date.now() < deadline && !applicationReady) {
      const result = await mainClient.call("Runtime.evaluate", {
        expression: "Boolean(document.querySelector('.app-shell'))",
        returnByValue: true
      });
      applicationReady = result.result.value === true;
      if (!applicationReady) await delay(150);
    }
    if (!applicationReady) throw new Error("The packaged renderer did not create the application interface.");
    const mainScreenshot = await mainClient.call("Page.captureScreenshot", { format: "png", fromSurface: true });
    const mainPath = path.join(artifactDirectory, "packaged-workspace.png");
    await fs.writeFile(mainPath, Buffer.from(mainScreenshot.data, "base64"));
    mainClient.close();
    console.log(JSON.stringify({ applicationReady, splashPath, mainPath }));
  } finally {
    child.kill();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
