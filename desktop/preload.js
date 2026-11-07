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

/**
 * NexusBV control for the board library. The main process refuses these unless
 * the calling page is on the configured server address.
 */
contextBridge.exposeInMainWorld("nexusbv", {
  open: (files) => ipcRenderer.invoke("nexusbv:open", files),
  selectNet: (net) => ipcRenderer.invoke("nexusbv:select-net", net),
  selectComponent: (refdes) => ipcRenderer.invoke("nexusbv:select-component", refdes),
  selectPin: (refdes, pin) => ipcRenderer.invoke("nexusbv:select-pin", refdes, pin),
  getState: () => ipcRenderer.invoke("nexusbv:state"),
});
