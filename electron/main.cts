// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
// In CJS context, Electron patches require('electron') to return its APIs.
import { app, BrowserWindow, session, ipcMain, shell, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'

// ─── Paths ────────────────────────────────────────────────────────────────────
const RENDERER_DIST = path.join(__dirname, '../dist')
const PRELOAD_PATH  = path.join(__dirname, 'preload.cjs')

/** Persistent JSON file that stores the list of plugin folder paths. */
function foldersConfigPath(): string {
  return path.join(app.getPath('userData'), 'plugin-folders.json')
}

// ─── Folder persistence helpers ───────────────────────────────────────────────
function loadFolderPaths(): string[] {
  try {
    const raw = fs.readFileSync(foldersConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

function saveFolderPaths(paths: string[]): void {
  fs.mkdirSync(path.dirname(foldersConfigPath()), { recursive: true })
  fs.writeFileSync(foldersConfigPath(), JSON.stringify(paths, null, 2), 'utf-8')
}

// ─── Plugin scanner ───────────────────────────────────────────────────────────
type PluginFormat = 'vst3' | 'vst' | 'lv2' | 'ladspa'

interface FoundPlugin {
  id: string
  name: string
  format: PluginFormat
  path: string
}

const PLUGIN_EXTENSIONS: Record<string, PluginFormat> = {
  '.vst3': 'vst3',
  '.vst':  'vst',
  '.lv2':  'lv2',
  '.so':   'ladspa',
  '.dll':  'vst',
}

async function scanDir(
  dir: string,
  relativePath: string,
  depth: number,
  results: FoundPlugin[],
): Promise<void> {
  if (depth > 5) return
  let entries: fs.Dirent[]
  try {
    entries = await fsPromises.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const ext = path.extname(entry.name).toLowerCase()
    const entryRel = relativePath ? `${relativePath}/${entry.name}` : entry.name
    const format = PLUGIN_EXTENSIONS[ext]
    if (format) {
      results.push({
        id: `${dir}::${entryRel}`,
        name: entry.name.replace(/\.(vst3?|lv2|so|dll)$/i, ''),
        format,
        path: path.join(dir, entryRel),
      })
      continue // don't recurse into plugin bundles
    }
    if (entry.isDirectory()) {
      await scanDir(path.join(dir, entry.name), entryRel, depth + 1, results)
    }
  }
}

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

// ─── Generic JSON store helper ────────────────────────────────────────────────
function jsonRead<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function jsonWrite(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:platform', () => process.platform)

// ── Pedalboard state ──────────────────────────────────────────────────────────
ipcMain.handle('storage:pedalboard:load', () => {
  const file = path.join(app.getPath('userData'), 'pedalboard.json')
  return jsonRead(file, null)
})
ipcMain.handle('storage:pedalboard:save', (_event, data: unknown) => {
  jsonWrite(path.join(app.getPath('userData'), 'pedalboard.json'), data)
})
ipcMain.handle('storage:pedalboard:clear', () => {
  try { fs.unlinkSync(path.join(app.getPath('userData'), 'pedalboard.json')) } catch { /* ignore */ }
})

// ── Preferences (theme + audio devices) ──────────────────────────────────────
ipcMain.handle('storage:prefs:load', () => {
  return jsonRead(path.join(app.getPath('userData'), 'preferences.json'), {})
})
ipcMain.handle('storage:prefs:save', (_event, data: unknown) => {
  jsonWrite(path.join(app.getPath('userData'), 'preferences.json'), data)
})

// ── Binary assets (NAM models, IR files) ──────────────────────────────────────
const assetsDir = () => path.join(app.getPath('userData'), 'assets')

ipcMain.handle('storage:asset:save', (_event, key: string, buffer: Buffer) => {
  const file = path.join(assetsDir(), key.replace(/[:/]/g, '_'))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, buffer)
  return file
})
ipcMain.handle('storage:asset:read', (_event, key: string) => {
  try {
    const file = path.join(assetsDir(), key.replace(/[:/]/g, '_'))
    return fs.readFileSync(file) // returns Buffer → transferred as Uint8Array
  } catch {
    return null
  }
})
ipcMain.handle('storage:asset:delete', (_event, key: string) => {
  try { fs.unlinkSync(path.join(assetsDir(), key.replace(/[:/]/g, '_'))) } catch { /* ignore */ }
})

/** Returns the currently saved plugin folder paths. */
ipcMain.handle('folders:load', () => loadFolderPaths())

/** Opens a folder picker dialog and saves the chosen path. Returns new list. */
ipcMain.handle('folders:add', async (_event) => {
  const win = BrowserWindow.getFocusedWindow()
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory', 'multiSelections'],
    title: 'Select Plugin Folder',
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const current = loadFolderPaths()
  const merged = Array.from(new Set([...current, ...result.filePaths]))
  saveFolderPaths(merged)
  return merged
})

/** Removes a folder path and persists the new list. */
ipcMain.handle('folders:remove', (_event, folderPath: string) => {
  const current = loadFolderPaths()
  const updated = current.filter((p) => p !== folderPath)
  saveFolderPaths(updated)
  return updated
})

/** Recursively scans the given folder paths and returns found plugins. */
ipcMain.handle('folders:scan', async (_event, folderPaths: string[]) => {
  const results: FoundPlugin[] = []
  for (const dir of folderPaths) {
    if (fs.existsSync(dir)) {
      await scanDir(dir, '', 0, results)
    }
  }
  return results
})

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
