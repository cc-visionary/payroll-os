// =============================================================================
// PeopleOS PH - Electron Main Process
// =============================================================================
// Main process that creates windows and manages the embedded Next.js server.
// Includes auto-update functionality via electron-updater.
// =============================================================================

import { app, BrowserWindow, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import path from "path";
import { spawn, ChildProcess } from "child_process";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
const isDev = !app.isPackaged;

// Use a high port to avoid conflicts, bind to localhost only for security
const PORT = isDev ? 3000 : 51847;
const HOSTNAME = "127.0.0.1";

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: "default",
    icon: path.join(__dirname, "../public/icon.png"),
    show: false, // Don't show until ready
  });

  // Show window when ready to avoid flicker
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Load the app
  const url = isDev ? `http://localhost:${PORT}` : `http://${HOSTNAME}:${PORT}`;
  mainWindow.loadURL(url);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // In development, assume dev server is running
      resolve();
      return;
    }

    // In production, start the Next.js standalone server
    const serverPath = path.join(app.getAppPath(), ".next", "standalone", "server.js");

    serverProcess = spawn("node", [serverPath], {
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: HOSTNAME,
        NODE_ENV: "production",
      },
      cwd: path.join(app.getAppPath()),
    });

    serverProcess.stdout?.on("data", (data) => {
      console.log(`Server: ${data}`);
      if (data.toString().includes("Ready") || data.toString().includes("started")) {
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on("error", reject);

    // Fallback resolve after timeout
    setTimeout(resolve, 5000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// =============================================================================
// IPC Handlers
// =============================================================================

// Get app version
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// Check for updates
ipcMain.handle("check-for-updates", async () => {
  // Skip update check in development
  if (isDev) {
    return { available: false, currentVersion: app.getVersion() };
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    const latestVersion = result?.updateInfo?.version;
    const currentVersion = app.getVersion();

    // Only mark as available if we have a valid version and it's different
    const available = !!(latestVersion && latestVersion !== currentVersion);

    return {
      available,
      version: latestVersion,
      currentVersion,
      releaseNotes: result?.updateInfo?.releaseNotes,
      releaseDate: result?.updateInfo?.releaseDate,
    };
  } catch (error) {
    console.error("Update check failed:", error);
    return { available: false, error: (error as Error).message };
  }
});

// Download update
ipcMain.handle("download-update", async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Install update and restart
ipcMain.handle("install-update", () => {
  autoUpdater.quitAndInstall(false, true);
});

// Open external URL
ipcMain.handle("open-external", async (_, url: string) => {
  await shell.openExternal(url);
});

// =============================================================================
// Auto-updater Events
// =============================================================================

autoUpdater.on("checking-for-update", () => {
  console.log("Checking for update...");
});

autoUpdater.on("update-available", (info) => {
  console.log("Update available:", info.version);
  mainWindow?.webContents.send("update-available", {
    version: info.version,
    releaseNotes: info.releaseNotes,
    releaseDate: info.releaseDate,
  });
});

autoUpdater.on("update-not-available", () => {
  console.log("Update not available");
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded:", info.version);
  mainWindow?.webContents.send("update-downloaded", {
    version: info.version,
    releaseNotes: info.releaseNotes,
  });
});

autoUpdater.on("download-progress", (progress) => {
  mainWindow?.webContents.send("download-progress", {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    total: progress.total,
    transferred: progress.transferred,
  });
});

autoUpdater.on("error", (error) => {
  console.error("Update error:", error);
  mainWindow?.webContents.send("update-error", error.message);
});

// =============================================================================
// App Lifecycle
// =============================================================================

app.whenReady().then(async () => {
  await startServer();
  createWindow();

  // Check for updates on startup (production only)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(console.error);
    }, 3000);
  }
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("before-quit", () => {
  stopServer();
});
