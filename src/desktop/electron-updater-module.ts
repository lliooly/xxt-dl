import type { AppUpdater } from "electron-updater";

export interface ElectronUpdaterModule {
  autoUpdater?: unknown;
  default?: {
    autoUpdater?: unknown;
  };
}

export function resolveAutoUpdaterModule(moduleExports: ElectronUpdaterModule): AppUpdater | undefined {
  const updater = moduleExports.autoUpdater ?? moduleExports.default?.autoUpdater;
  return isAppUpdater(updater) ? updater : undefined;
}

export function getAutoUpdaterResolutionError(moduleExports: ElectronUpdaterModule): string | undefined {
  if (resolveAutoUpdaterModule(moduleExports)) {
    return undefined;
  }

  return "electron-updater 模块未暴露可用的 autoUpdater 导出，请检查当前版本的导出结构。";
}

function isAppUpdater(value: unknown): value is AppUpdater {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppUpdater>;
  return (
    typeof candidate.checkForUpdates === "function" &&
    typeof candidate.downloadUpdate === "function" &&
    typeof candidate.quitAndInstall === "function"
  );
}
