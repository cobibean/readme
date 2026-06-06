import { BrowserWindow, screen } from 'electron';

export interface FloatingReadmeButtonOptions {
  devServerUrl?: string;
  preloadPath: string;
  rendererIndexPath: string;
}

export const createFloatingReadmeButtonWindow = ({
  devServerUrl,
  preloadPath,
  rendererIndexPath
}: FloatingReadmeButtonOptions): BrowserWindow => {
  const width = 154;
  const height = 58;
  const workArea = screen.getPrimaryDisplay().workArea;
  const window = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 28,
    y: workArea.y + 72,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    title: 'readme play last',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.setAlwaysOnTop(true, 'floating');
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  });
  window.showInactive();
  window.moveTop();

  if (devServerUrl) {
    void window.loadURL(`${devServerUrl}?view=floating-readme`);
    return window;
  }

  void window.loadFile(rendererIndexPath, {
    query: { view: 'floating-readme' }
  });

  return window;
};
