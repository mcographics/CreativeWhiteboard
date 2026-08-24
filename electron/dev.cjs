const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const electronPath = require("electron");

const projectRoot = path.resolve(__dirname, "..");
const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
let viteProcess;
let electronProcess;
let shuttingDown = false;

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await portIsAvailable(port)) return port;
  }
  throw new Error("No available development port was found.");
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Vite did not become ready at ${url}.`);
}

function stopChildren(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electronProcess && !electronProcess.killed) electronProcess.kill();
  if (viteProcess && !viteProcess.killed) viteProcess.kill();
  setTimeout(() => process.exit(exitCode), 100);
}

async function start() {
  const port = await findAvailablePort(1420);
  const developmentUrl = `http://127.0.0.1:${port}`;

  viteProcess = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: projectRoot,
    stdio: "inherit"
  });
  viteProcess.once("exit", (code) => {
    if (!shuttingDown) stopChildren(code ?? 1);
  });

  await waitForServer(developmentUrl);

  const environment = {
    ...process.env,
    CREATIVE_WHITEBOARD_DEV_URL: developmentUrl
  };
  delete environment.ELECTRON_RUN_AS_NODE;

  electronProcess = spawn(electronPath, ["."], {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit"
  });
  electronProcess.once("exit", (code) => stopChildren(code ?? 0));
  electronProcess.once("error", (error) => {
    console.error("Unable to start Creative Whiteboard:", error);
    stopChildren(1);
  });
}

process.on("SIGINT", () => stopChildren(0));
process.on("SIGTERM", () => stopChildren(0));

start().catch((error) => {
  console.error(error);
  stopChildren(1);
});
