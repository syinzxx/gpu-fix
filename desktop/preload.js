"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Exposes a minimal API to the setup page renderer.
 * Only methods explicitly listed here are available — the full Node/Electron
 * API is never exposed to the web content.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Save the server URL to the app config and restart the main window.
   * @param {string} url - e.g. "http://localhost:3000" or "https://gpufix.example.com"
   */
  saveServerUrl: (url) => ipcRenderer.send("save-server-url", url),
});
