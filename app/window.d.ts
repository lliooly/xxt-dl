import type { XxtDesktopApi } from "../src/desktop/preload.js";

declare global {
  interface Window {
    xxt: XxtDesktopApi;
  }
}

export {};
