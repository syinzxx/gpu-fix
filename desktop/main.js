"use strict";

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  shell,
  nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------
const CONFIG_PATH = path.join(app.getPath("userData"), "gpu-fix-config.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let mainWindow = null;
let tray = null;
let pollTimer = null;
let lastLatestTicketId = null;
let serverUrl = null;

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "GPU Fix Shop",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "build", "icon.ico"),
    show: false,
  });

  mainWindow.loadURL(url);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (Notification.isSupported()) {
        new Notification({
          title: "GPU Fix Shop",
          body: "Running in the tray. Right-click the tray icon to quit.",
        }).show();
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createSetupWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 380,
    resizable: false,
    title: "GPU Fix Shop — Setup",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "build", "icon.ico"),
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "setup.html"));
  return win;
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------
function createTray() {
  // Use a 16x16 empty image as placeholder when no icon file is present
  let icon;
  const iconPath = path.join(__dirname, "build", "icon.ico");
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("GPU Fix Shop");
  updateTrayMenu();

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "Open Dashboard",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else if (serverUrl) {
          createMainWindow(serverUrl + "/dashboard");
        }
      },
    },
    {
      label: "New Ticket",
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL(serverUrl + "/dashboard/tickets/new");
          mainWindow.show();
          mainWindow.focus();
        } else if (serverUrl) {
          createMainWindow(serverUrl + "/dashboard/tickets/new");
        }
      },
    },
    { type: "separator" },
    {
      label: "Change Server URL",
      click: () => {
        stopPolling();
        if (mainWindow) mainWindow.destroy();
        createSetupWindow();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollSummary, 60_000);
  // Initial poll right away
  pollSummary();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollSummary() {
  if (!serverUrl || !mainWindow) return;

  try {
    // Use the session cookies from the BrowserWindow
    const cookies = await mainWindow.webContents.session.cookies.get({
      url: serverUrl,
    });

    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await fetch(`${serverUrl}/api/desktop/summary`, {
      headers: {
        Cookie: cookieHeader,
        Accept: "application/json",
      },
    });

    if (!res.ok) return; // 401 = not logged in yet; skip silently

    const data = await res.json();

    // Fire notification when a new ticket appears
    if (
      data.latestTicketId &&
      lastLatestTicketId !== null &&
      data.latestTicketId !== lastLatestTicketId
    ) {
      if (Notification.isSupported()) {
        const n = new Notification({
          title: "New Ticket — GPU Fix Shop",
          body: `Ticket ${data.latestTicketCode} just arrived.`,
        });
        n.on("click", () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        });
        n.show();
      }
    }

    lastLatestTicketId = data.latestTicketId;
  } catch {
    // Network offline — skip this poll
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.on("save-server-url", (_event, url) => {
  serverUrl = url;
  const cfg = loadConfig();
  cfg.serverUrl = url;
  saveConfig(cfg);

  // Close the setup window and open the main window
  BrowserWindow.getAllWindows().forEach((w) => w.destroy());
  createMainWindow(serverUrl + "/dashboard");
  mainWindow.webContents.on("did-finish-load", () => {
    startPolling();
  });
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  const cfg = loadConfig();
  serverUrl = cfg.serverUrl || null;

  createTray();

  if (!serverUrl) {
    createSetupWindow();
  } else {
    createMainWindow(serverUrl + "/dashboard");
    mainWindow.webContents.on("did-finish-load", () => {
      startPolling();
    });
  }
});

// Intentionally do not quit when all windows close — the tray keeps the app
// alive so notifications keep working. Quit is only via the tray menu.
app.on("window-all-closed", () => {});

app.on("activate", () => {
  // macOS: re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0 && serverUrl) {
    createMainWindow(serverUrl + "/dashboard");
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopPolling();
});
