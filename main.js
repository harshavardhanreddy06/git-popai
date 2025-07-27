try {
  require('electron-reload')(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`)
  });
} catch (e) {
  // Ignore if electron-reload is not installed
}
const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');

// Suppress uncaught exceptions from being shown to the user
process.on('uncaughtException', (err) => {
  // Do nothing, suppress all uncaught exceptions
});

// Suppress unhandled promise rejections from being shown to the user
process.on('unhandledRejection', (reason, promise) => {
  // Do nothing, suppress all unhandled promise rejections
});

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    visibleOnAllWorkspaces: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: []
    }
  });

  // Prevents window from being captured by screen recording/sharing tools (where supported)
  win.setContentProtection(true);

  // Ensure the window stays on all workspaces
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  // Set window level to ensure it stays on top across workspaces
  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating');
  }

  win.loadFile('index.html');

  win.on('closed', () => {
    win = null;
  });
}

ipcMain.on('window-hide', () => {
  if (win && !win.isDestroyed()) win.hide();
});
ipcMain.on('window-exit', () => {
  app.quit();
});

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
  createWindow();

  // Make app follow to current workspace - more robust approach
  if (win && !win.isDestroyed()) {
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (e) {}
    if (process.platform === 'darwin') {
      try { win.setAlwaysOnTop(true, 'screen-saver'); } catch (e) {}
      try { win.setAlwaysOnTop(true, 'floating'); } catch (e) {}
    }
  }

  // Re-add Shift+O shortcut to toggle window
  globalShortcut.register('Shift+O', () => {
    try {
      if (win && !win.isDestroyed()) {
        if (win.isVisible()) {
          try { win.hide(); } catch (e) {}
        } else {
          try { win.show(); } catch (e) {}
          try { win.focus(); } catch (e) {}
        }
      }
    } catch (err) {
      // Suppress all errors
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
