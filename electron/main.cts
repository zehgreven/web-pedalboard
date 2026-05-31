// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
// In CJS context, Electron patches require('electron') to return its APIs.
import { app, BrowserWindow, session, ipcMain, shell, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { carlaHost } from './carla-host.cjs'
import type { CarlaPluginSpec } from './carla-host.cjs'

const execFileAsync = promisify(execFile)

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

// ─── Plugin metadata parser ───────────────────────────────────────────────────

export interface PluginParam {
  id: string
  label: string
  default: number
  min: number
  max: number
  unit: string
}

export interface PluginMetadata {
  name: string
  description: string
  params: PluginParam[]
}

// ── LV2: parse Turtle (.ttl) files inside a .lv2 bundle ──────────────────────

/**
 * Extracts all top-level blank-node blocks `[ ... ]` from a Turtle string.
 * LV2 uses these for port declarations, including comma-chained variants:
 *   lv2:port [ ... ] , [ ... ] , [ ... ] .
 * We scan all `[...]` blocks in the file and filter by type predicates.
 */
function extractTtlBlocks(content: string): string[] {
  const blocks: string[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '[') {
      if (depth === 0) start = i + 1
      depth++
    } else if (content[i] === ']') {
      depth--
      if (depth === 0 && start !== -1) {
        blocks.push(content.slice(start, i))
        start = -1
      }
    }
  }
  return blocks
}

function parseTtlString(content: string): PluginParam[] {
  const params: PluginParam[] = []

  for (const block of extractTtlBlocks(content)) {
    // Only include control input ports.
    if (!block.includes('ControlPort')) continue
    if (!block.includes('InputPort')) continue

    const sym   = block.match(/lv2:symbol\s+"([^"]+)"/)?.[1] ?? ''
    const label = block.match(/lv2:name\s+"([^"]+)"/)?.[1] ?? sym
    const def   = parseFloat(block.match(/lv2:default\s+([\d.eE+\-]+)/)?.[1] ?? '0')
    const min   = parseFloat(block.match(/lv2:minimum\s+([\d.eE+\-]+)/)?.[1] ?? '0')
    const max   = parseFloat(block.match(/lv2:maximum\s+([\d.eE+\-]+)/)?.[1] ?? '1')
    const unit  = block.match(/units:unit\s+units:(\w+)/)?.[1] ?? ''

    if (sym) {
      params.push({ id: sym, label, default: def, min, max, unit })
    }
  }
  return params
}

function lv2PluginName(content: string): string {
  return (
    content.match(/doap:name\s+"([^"]+)"/)?.[1] ??
    content.match(/lv2:name\s+"([^"]+)"/)?.[1] ??
    ''
  )
}

function lv2Description(content: string): string {
  return (
    content.match(/doap:shortdesc\s+"([^"]+)"/)?.[1] ??
    content.match(/rdfs:comment\s+"([^"]+)"/)?.[1] ??
    ''
  )
}

async function loadLv2Metadata(pluginPath: string): Promise<PluginMetadata | null> {
  // pluginPath points to the .lv2 directory.
  let entries: string[]
  try {
    entries = await fsPromises.readdir(pluginPath)
  } catch {
    return null
  }

  const ttlFiles = entries.filter((e) => e.endsWith('.ttl'))
  let combinedContent = ''
  for (const f of ttlFiles) {
    try {
      combinedContent += await fsPromises.readFile(path.join(pluginPath, f), 'utf-8') + '\n'
    } catch { /* skip unreadable */ }
  }
  if (!combinedContent) return null

  return {
    name: lv2PluginName(combinedContent) || path.basename(pluginPath, '.lv2'),
    description: lv2Description(combinedContent),
    params: parseTtlString(combinedContent),
  }
}

// ── VST3: read moduleinfo.json inside the .vst3 bundle ───────────────────────
async function loadVst3Metadata(pluginPath: string): Promise<PluginMetadata | null> {
  // .vst3 on Linux is typically a directory bundle: Contents/moduleinfo.json
  const candidates = [
    path.join(pluginPath, 'Contents', 'moduleinfo.json'),
    path.join(pluginPath, 'moduleinfo.json'),
  ]
  for (const file of candidates) {
    try {
      const raw = await fsPromises.readFile(file, 'utf-8')
      const info = JSON.parse(raw)
      // moduleinfo.json structure: { name, classes: [{ name, parameters: [...] }] }
      const cls = info?.classes?.[0]
      const params: PluginParam[] = (cls?.parameters ?? []).map((p: Record<string, unknown>, i: number) => ({
        id: `param_${i}`,
        label: String(p['title'] ?? p['name'] ?? `Param ${i}`),
        default: Number(p['defaultNormalizedValue'] ?? 0.5),
        min: 0,
        max: 1,
        unit: String(p['unitName'] ?? ''),
      }))
      return {
        name: String(info?.name ?? cls?.name ?? path.basename(pluginPath, '.vst3')),
        description: '',
        params,
      }
    } catch { /* not found, try next */ }
  }
  return null
}

// ─── Native plugin GUI launcher ───────────────────────────────────────────────

export interface NativeUIResult {
  launched: boolean
  tool: string
  error?: string
}

/**
 * Looks for a binary in common system paths.
 * Using fs.existsSync is more reliable than exec('which') inside Electron,
 * because Electron's subprocess PATH can differ from the user's shell PATH.
 */
function findBin(name: string): string | null {
  const dirs = ['/usr/bin', '/usr/local/bin', '/bin', '/usr/sbin']
  for (const dir of dirs) {
    const full = path.join(dir, name)
    if (fs.existsSync(full)) return full
  }
  return null
}

/**
 * Spawns a detached process, optionally wrapping it with pw-jack so that
 * JACK clients work under PipeWire without needing a running jackd daemon.
 */
function launchDetached(bin: string, args: string[]): string {
  const pwjack = findBin('pw-jack')
  if (pwjack && bin !== pwjack) {
    console.log('[plugin:open-native-ui] spawn:', pwjack, [bin, ...args].join(' '))
    spawn(pwjack, [bin, ...args], { detached: true, stdio: 'ignore' }).unref()
    return `pw-jack ${path.basename(bin)}`
  }
  console.log('[plugin:open-native-ui] spawn:', bin, args.join(' '))
  spawn(bin, args, { detached: true, stdio: 'ignore' }).unref()
  return path.basename(bin)
}

/** Reads the LV2 plugin URI from a bundle's manifest.ttl. */
async function lv2Uri(bundlePath: string): Promise<string | null> {
  const manifestPath = path.join(bundlePath, 'manifest.ttl')
  let content: string
  try {
    content = await fsPromises.readFile(manifestPath, 'utf-8')
  } catch (e) {
    console.error('[plugin:open-native-ui] Cannot read manifest.ttl:', e)
    return null
  }
  // Match <http://...> followed (possibly with whitespace) by "a lv2:Plugin"
  const m = content.match(/<([^>]+)>\s*(?:\r?\n\s*)?a\s+lv2:Plugin/)
    ?? content.match(/<([^>]+)>/)
  const uri = m?.[1] ?? null
  console.log('[plugin:open-native-ui] LV2 URI:', uri, 'from', bundlePath)
  return uri
}

/** Launches the native GUI for a plugin in a detached subprocess. */
async function openNativePluginUI(pluginPath: string, format: string): Promise<NativeUIResult> {
  console.log('[plugin:open-native-ui] request:', format, pluginPath)
  const isLinux = process.platform === 'linux'
  const isMac   = process.platform === 'darwin'

  // ── LV2 ──────────────────────────────────────────────────────────────────
  if (format === 'lv2') {
    const uri = await lv2Uri(pluginPath)
    if (!uri) return { launched: false, tool: '', error: 'Could not extract LV2 URI from manifest.ttl' }

    if (isLinux || isMac) {
      // Prefer jalv (native LV2 host), fall back to carla-single
      for (const name of ['jalv.gtk3', 'jalv.gtk', 'jalv']) {
        const bin = findBin(name)
        if (bin) {
          const tool = launchDetached(bin, [uri])
          return { launched: true, tool }
        }
      }
      const carlaBin = findBin('carla-single')
      if (carlaBin) {
        // carla-single accepts lowercase format: lv2 <uri>
        const tool = launchDetached(carlaBin, ['lv2', uri])
        return { launched: true, tool }
      }
      return { launched: false, tool: '', error: 'Install jalv or Carla to open LV2 GUIs.\nRun: sudo apt install jalv   OR   sudo apt install carla' }
    }
  }

  // ── VST3 ─────────────────────────────────────────────────────────────────
  if (format === 'vst3') {
    if (isLinux || isMac) {
      const bin = findBin('carla-single')
      if (bin) {
        const tool = launchDetached(bin, ['vst3', pluginPath])
        return { launched: true, tool }
      }
      return { launched: false, tool: '', error: 'Install Carla to open VST3 GUIs.\nRun: sudo apt install carla' }
    }
  }

  // ── VST (legacy) ─────────────────────────────────────────────────────────
  if (format === 'vst') {
    if (isLinux || isMac) {
      const bin = findBin('carla-single')
      if (bin) {
        const tool = launchDetached(bin, ['vst2', pluginPath])
        return { launched: true, tool }
      }
      return { launched: false, tool: '', error: 'Install Carla to open VST GUIs.\nRun: sudo apt install carla' }
    }
  }

  return {
    launched: false,
    tool: '',
    error: `Native GUI for ${format.toUpperCase()} is not yet supported on ${process.platform}`,
  }
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

/** Reads metadata (name, parameters) for a plugin from its bundle/files. */
ipcMain.handle('plugin:metadata', async (_event, pluginPath: string, format: string): Promise<PluginMetadata | null> => {
  if (format === 'lv2') return loadLv2Metadata(pluginPath)
  if (format === 'vst3') return loadVst3Metadata(pluginPath)
  return null
})

/** Launches the native plugin GUI via jalv / carla-single. */
ipcMain.handle('plugin:open-native-ui', async (_event, pluginPath: string, format: string) =>
  openNativePluginUI(pluginPath, format)
)

// ─── Carla host IPC ───────────────────────────────────────────────────────────

/** Returns whether Carla dependencies (Python + libcarla_standalone2.so) are present. */
ipcMain.handle('carla:available', () => carlaHost.isAvailable())

/** Returns the LV2 plugin URI from the bundle's manifest.ttl — used by Carla to load by URI. */
ipcMain.handle('carla:get-lv2-uri', async (_event, bundlePath: string) =>
  lv2Uri(bundlePath)
)

/** Returns current Carla status and last error. */
ipcMain.handle('carla:status', () => ({
  status: carlaHost.status,
  error:  carlaHost.lastError,
}))

/**
 * Starts Carla engine and loads the specified plugin chain.
 * plugins[]: CarlaPluginSpec[]  — ordered list of plugins to load into Carla rack.
 */
ipcMain.handle('carla:start', async (
  _event,
  plugins: CarlaPluginSpec[],
  driver = 'JACK',
  device = '',
) => {
  // Forward status changes to the renderer window
  carlaHost.onStatus((status, err) => {
    const win = BrowserWindow.getAllWindows()[0]
    win?.webContents.send('carla:status-changed', { status, error: err ?? '' })
  })
  return carlaHost.start(plugins, driver, device)
})

/** Stops Carla engine. */
ipcMain.handle('carla:stop', async () => {
  await carlaHost.stop()
  return { ok: true }
})

/** Sets a plugin parameter value in the running Carla engine. */
ipcMain.handle('carla:set-param', async (_event, pluginId: number, paramId: number, value: number) => {
  await carlaHost.setParam(pluginId, paramId, value)
  return { ok: true }
})

/** Enable/disable a plugin in the Carla rack. */
ipcMain.handle('carla:set-active', async (_event, pluginId: number, active: boolean) => {
  await carlaHost.setActive(pluginId, active)
  return { ok: true }
})

/** Returns all readable parameters for a plugin in the Carla rack. */
ipcMain.handle('carla:get-params', async (_event, pluginId: number) =>
  carlaHost.getParams(pluginId)
)

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
