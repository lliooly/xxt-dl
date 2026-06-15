import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import type { CourseEntry } from "../types.js";
import type {
  DesktopDoneResult,
  DesktopDownloadStatus,
  DesktopProgress,
  DesktopQrCode,
  StartDownloadInput,
} from "./downloader.js";

export interface XxtDesktopApi {
  startDownload: (input: StartDownloadInput) => Promise<void>;
  selectCourse: (value: string) => Promise<void>;
  stopDownload: () => Promise<void>;
  openOutput: () => Promise<void>;
  onStatus: (callback: (status: DesktopDownloadStatus) => void) => () => void;
  onLog: (callback: (message: string) => void) => () => void;
  onQr: (callback: (qr: DesktopQrCode) => void) => () => void;
  onCourses: (callback: (courses: CourseEntry[]) => void) => () => void;
  onProgress: (callback: (progress: DesktopProgress) => void) => () => void;
  onDone: (callback: (result: DesktopDoneResult) => void) => () => void;
  onError: (callback: (message: string) => void) => () => void;
}

const on = <T>(channel: string, callback: (value: T) => void) => {
  const listener = (_event: IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
};

const api: XxtDesktopApi = {
  startDownload: (input) => ipcRenderer.invoke("download:start", input),
  selectCourse: (value) => ipcRenderer.invoke("download:select-course", value),
  stopDownload: () => ipcRenderer.invoke("download:stop"),
  openOutput: () => ipcRenderer.invoke("output:open"),
  onStatus: (callback) => on("download:status", callback),
  onLog: (callback) => on("download:log", callback),
  onQr: (callback) => on("download:qr", callback),
  onCourses: (callback) => on("download:courses", callback),
  onProgress: (callback) => on("download:progress", callback),
  onDone: (callback) => on("download:done", callback),
  onError: (callback) => on("download:error", callback),
};

contextBridge.exposeInMainWorld("xxt", api);
