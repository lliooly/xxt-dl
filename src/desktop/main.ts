import { BrowserWindow, app, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { DesktopDownloadJob, type StartDownloadInput } from "./downloader.js";
import { DesktopUpdateService } from "./update-service.js";

const DEFAULT_START_URL = "https://i.chaoxing.com/";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "../../..");

let mainWindow: BrowserWindow | undefined;
let activeJob: DesktopDownloadJob | undefined;
let updateService: DesktopUpdateService | undefined;

async function createWindow(): Promise<void> {
  configurePlaywrightBrowsers();

  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    title: "学习通作业整理",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  updateService = new DesktopUpdateService(getAppReleaseVersion(), (state) => send("update:state", state));

  await mainWindow.loadFile(path.join(appRoot, "out/index.html"));
}

function getWritableAppDataPath(): string {
  return app.isPackaged ? app.getPath("userData") : appRoot;
}

function configurePlaywrightBrowsers(): void {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    return;
  }

  const browserPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "playwright-core", ".local-browsers")
    : path.join(appRoot, "node_modules", "playwright-core", ".local-browsers");

  process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
}

function getAppReleaseVersion(): string {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8")) as {
      version?: string;
    };

    if (packageJson.version) {
      return packageJson.version;
    }
  } catch {
    // Fall back to Electron's app version only if package metadata is unavailable.
  }

  return app.getVersion();
}

function send(channel: string, value: unknown): void {
  mainWindow?.webContents.send(channel, value);
}

ipcMain.handle("download:start", async (_event, input: StartDownloadInput = {}) => {
  if (activeJob) {
    throw new Error("已有下载任务正在运行。");
  }

  activeJob = new DesktopDownloadJob(
    {
      profileDir: path.join(getWritableAppDataPath(), ".xxt-profile"),
      outDir: path.join(getWritableAppDataPath(), "output"),
      startUrl: DEFAULT_START_URL,
      courseQuery: input.courseQuery,
      limit: input.limit,
      headless: true,
    },
    {
      status: (status) => send("download:status", status),
      log: (message) => send("download:log", message),
      qr: (qr) => send("download:qr", qr),
      courses: (courses) => send("download:courses", courses),
      progress: (progress) => send("download:progress", progress),
      done: (result) => send("download:done", result),
      error: (message) => send("download:error", message),
    },
  );

  activeJob.run().finally(() => {
    activeJob = undefined;
  });
});

ipcMain.handle("download:select-course", async (_event, value: string) => {
  activeJob?.selectCourse(value);
});

ipcMain.handle("download:stop", async () => {
  await activeJob?.stop();
  activeJob = undefined;
});

ipcMain.handle("output:open", async () => {
  await shell.openPath(path.join(getWritableAppDataPath(), "output"));
});

ipcMain.handle("update:get-state", () => {
  return updateService?.getState();
});

ipcMain.handle("update:check", async (_event, input = {}) => {
  return updateService?.checkForUpdates(input);
});

ipcMain.handle("update:download", async () => {
  return updateService?.downloadUpdate();
});

ipcMain.handle("update:cancel", () => {
  return updateService?.cancelUpdateOperation();
});

ipcMain.handle("update:install", () => {
  return updateService?.installDownloadedUpdate();
});

ipcMain.handle("update:open-release-page", async () => {
  await updateService?.openReleasePage();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
