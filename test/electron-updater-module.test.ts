import test from "node:test";
import assert from "node:assert/strict";

import {
  getAutoUpdaterResolutionError,
  resolveAutoUpdaterModule,
  type ElectronUpdaterModule,
} from "../src/desktop/electron-updater-module.js";

test("resolveAutoUpdaterModule accepts named autoUpdater exports", () => {
  const updater = {
    checkForUpdates() {
      return Promise.resolve(null);
    },
    downloadUpdate() {
      return Promise.resolve([]);
    },
    quitAndInstall() {
      return undefined;
    },
  };
  const moduleExports = { autoUpdater: updater } as ElectronUpdaterModule;

  assert.equal(resolveAutoUpdaterModule(moduleExports), updater);
});

test("resolveAutoUpdaterModule accepts CommonJS default autoUpdater exports", () => {
  const updater = {
    checkForUpdates() {
      return Promise.resolve(null);
    },
    downloadUpdate() {
      return Promise.resolve([]);
    },
    quitAndInstall() {
      return undefined;
    },
  };
  const moduleExports = { default: { autoUpdater: updater } } as ElectronUpdaterModule;

  assert.equal(resolveAutoUpdaterModule(moduleExports), updater);
});

test("getAutoUpdaterResolutionError reports invalid electron-updater exports", () => {
  const moduleExports = { default: { autoUpdater: {} } } as ElectronUpdaterModule;

  assert.match(getAutoUpdaterResolutionError(moduleExports) ?? "", /autoUpdater/);
});
