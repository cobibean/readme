import { app, BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

const getDevIconPath = (): string | undefined => {
  if (app.isPackaged) {
    return undefined;
  }

  const iconPath = path.join(app.getAppPath(), 'build/icon.png');
  return existsSync(iconPath) ? iconPath : undefined;
};

const preloadPath = (): string => path.join(__dirname, 'preload.cjs');

const rendererIndexPath = (): string => path.join(__dirname, '../renderer/index.html');

const createWindow = (): BrowserWindow => {
  const iconPath = getDevIconPath();
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 660,
    title: 'readme',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = window;
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
    return window;
  }

  void window.loadFile(rendererIndexPath());
  return window;
};

const showMainWindow = (): BrowserWindow => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return createWindow();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
  return mainWindow;
};

app.whenReady().then(() => {
  registerIpcHandlers({
    showMainWindow,
    getMainWindow: () => mainWindow
  });
  const iconPath = getDevIconPath();
  if (process.platform === 'darwin' && iconPath) {
    app.dock?.setIcon(iconPath);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  showMainWindow();
});
