// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
// In CJS context, Electron patches require('electron') to return its APIs.
import { app, BrowserWindow, session, ipcMain, shell } from 'electron'
import path from 'node:path'

// ─── Paths ────────────────────────────────────────────────────────────────────
// dist-electron/ is sibling to dist/ after vite build.
const RENDERER_DIST = path.join(__dirname, '../dist')
const PRELOAD_PATH = path.join(__dirname, 'preload.cjs')

// ─── COOP / COEP headers (required for SharedArrayBuffer / WASM worklet) ─────
function injectCrossOriginHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    })
  })
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: 'Guitar Pedalboard',
    backgroundColor: '#121212',
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Open external links in the system browser, not in Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env['VITE_DEV_SERVER_URL']
  if (devServerUrl) {
    win.loadURL(devServerUrl)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  return win
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:platform', () => process.platform)

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  injectCrossOriginHeaders()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
