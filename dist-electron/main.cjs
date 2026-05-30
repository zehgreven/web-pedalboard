"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
// In CJS context, Electron patches require('electron') to return its APIs.
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
// ─── Paths ────────────────────────────────────────────────────────────────────
const RENDERER_DIST = node_path_1.default.join(__dirname, '../dist');
const PRELOAD_PATH = node_path_1.default.join(__dirname, 'preload.cjs');
/** Persistent JSON file that stores the list of plugin folder paths. */
function foldersConfigPath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'plugin-folders.json');
}
// ─── Folder persistence helpers ───────────────────────────────────────────────
function loadFolderPaths() {
    try {
        const raw = node_fs_1.default.readFileSync(foldersConfigPath(), 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
    }
    catch {
        return [];
    }
}
function saveFolderPaths(paths) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(foldersConfigPath()), { recursive: true });
    node_fs_1.default.writeFileSync(foldersConfigPath(), JSON.stringify(paths, null, 2), 'utf-8');
}
const PLUGIN_EXTENSIONS = {
    '.vst3': 'vst3',
    '.vst': 'vst',
    '.lv2': 'lv2',
    '.so': 'ladspa',
    '.dll': 'vst',
};
async function scanDir(dir, relativePath, depth, results) {
    if (depth > 5)
        return;
    let entries;
    try {
        entries = await promises_1.default.readdir(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const ext = node_path_1.default.extname(entry.name).toLowerCase();
        const entryRel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const format = PLUGIN_EXTENSIONS[ext];
        if (format) {
            results.push({
                id: `${dir}::${entryRel}`,
                name: entry.name.replace(/\.(vst3?|lv2|so|dll)$/i, ''),
                format,
                path: node_path_1.default.join(dir, entryRel),
            });
            continue; // don't recurse into plugin bundles
        }
        if (entry.isDirectory()) {
            await scanDir(node_path_1.default.join(dir, entry.name), entryRel, depth + 1, results);
        }
    }
}
// ─── COOP / COEP headers (required for SharedArrayBuffer / WASM worklet) ─────
function injectCrossOriginHeaders() {
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Cross-Origin-Opener-Policy': ['same-origin'],
                'Cross-Origin-Embedder-Policy': ['require-corp'],
            },
        });
    });
}
// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
    const win = new electron_1.BrowserWindow({
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
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
    if (devServerUrl) {
        win.loadURL(devServerUrl);
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(node_path_1.default.join(RENDERER_DIST, 'index.html'));
    }
    return win;
}
// ── LV2: parse Turtle (.ttl) files inside a .lv2 bundle ──────────────────────
/**
 * Extracts all top-level blank-node blocks `[ ... ]` from a Turtle string.
 * LV2 uses these for port declarations, including comma-chained variants:
 *   lv2:port [ ... ] , [ ... ] , [ ... ] .
 * We scan all `[...]` blocks in the file and filter by type predicates.
 */
function extractTtlBlocks(content) {
    const blocks = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '[') {
            if (depth === 0)
                start = i + 1;
            depth++;
        }
        else if (content[i] === ']') {
            depth--;
            if (depth === 0 && start !== -1) {
                blocks.push(content.slice(start, i));
                start = -1;
            }
        }
    }
    return blocks;
}
function parseTtlString(content) {
    const params = [];
    for (const block of extractTtlBlocks(content)) {
        // Only include control input ports.
        if (!block.includes('ControlPort'))
            continue;
        if (!block.includes('InputPort'))
            continue;
        const sym = block.match(/lv2:symbol\s+"([^"]+)"/)?.[1] ?? '';
        const label = block.match(/lv2:name\s+"([^"]+)"/)?.[1] ?? sym;
        const def = parseFloat(block.match(/lv2:default\s+([\d.eE+\-]+)/)?.[1] ?? '0');
        const min = parseFloat(block.match(/lv2:minimum\s+([\d.eE+\-]+)/)?.[1] ?? '0');
        const max = parseFloat(block.match(/lv2:maximum\s+([\d.eE+\-]+)/)?.[1] ?? '1');
        const unit = block.match(/units:unit\s+units:(\w+)/)?.[1] ?? '';
        if (sym) {
            params.push({ id: sym, label, default: def, min, max, unit });
        }
    }
    return params;
}
function lv2PluginName(content) {
    return (content.match(/doap:name\s+"([^"]+)"/)?.[1] ??
        content.match(/lv2:name\s+"([^"]+)"/)?.[1] ??
        '');
}
function lv2Description(content) {
    return (content.match(/doap:shortdesc\s+"([^"]+)"/)?.[1] ??
        content.match(/rdfs:comment\s+"([^"]+)"/)?.[1] ??
        '');
}
async function loadLv2Metadata(pluginPath) {
    // pluginPath points to the .lv2 directory.
    let entries;
    try {
        entries = await promises_1.default.readdir(pluginPath);
    }
    catch {
        return null;
    }
    const ttlFiles = entries.filter((e) => e.endsWith('.ttl'));
    let combinedContent = '';
    for (const f of ttlFiles) {
        try {
            combinedContent += await promises_1.default.readFile(node_path_1.default.join(pluginPath, f), 'utf-8') + '\n';
        }
        catch { /* skip unreadable */ }
    }
    if (!combinedContent)
        return null;
    return {
        name: lv2PluginName(combinedContent) || node_path_1.default.basename(pluginPath, '.lv2'),
        description: lv2Description(combinedContent),
        params: parseTtlString(combinedContent),
    };
}
// ── VST3: read moduleinfo.json inside the .vst3 bundle ───────────────────────
async function loadVst3Metadata(pluginPath) {
    // .vst3 on Linux is typically a directory bundle: Contents/moduleinfo.json
    const candidates = [
        node_path_1.default.join(pluginPath, 'Contents', 'moduleinfo.json'),
        node_path_1.default.join(pluginPath, 'moduleinfo.json'),
    ];
    for (const file of candidates) {
        try {
            const raw = await promises_1.default.readFile(file, 'utf-8');
            const info = JSON.parse(raw);
            // moduleinfo.json structure: { name, classes: [{ name, parameters: [...] }] }
            const cls = info?.classes?.[0];
            const params = (cls?.parameters ?? []).map((p, i) => ({
                id: `param_${i}`,
                label: String(p['title'] ?? p['name'] ?? `Param ${i}`),
                default: Number(p['defaultNormalizedValue'] ?? 0.5),
                min: 0,
                max: 1,
                unit: String(p['unitName'] ?? ''),
            }));
            return {
                name: String(info?.name ?? cls?.name ?? node_path_1.default.basename(pluginPath, '.vst3')),
                description: '',
                params,
            };
        }
        catch { /* not found, try next */ }
    }
    return null;
}
/**
 * Looks for a binary in common system paths.
 * Using fs.existsSync is more reliable than exec('which') inside Electron,
 * because Electron's subprocess PATH can differ from the user's shell PATH.
 */
function findBin(name) {
    const dirs = ['/usr/bin', '/usr/local/bin', '/bin', '/usr/sbin'];
    for (const dir of dirs) {
        const full = node_path_1.default.join(dir, name);
        if (node_fs_1.default.existsSync(full))
            return full;
    }
    return null;
}
/**
 * Spawns a detached process, optionally wrapping it with pw-jack so that
 * JACK clients work under PipeWire without needing a running jackd daemon.
 */
function launchDetached(bin, args) {
    const pwjack = findBin('pw-jack');
    if (pwjack && bin !== pwjack) {
        console.log('[plugin:open-native-ui] spawn:', pwjack, [bin, ...args].join(' '));
        (0, node_child_process_1.spawn)(pwjack, [bin, ...args], { detached: true, stdio: 'ignore' }).unref();
        return `pw-jack ${node_path_1.default.basename(bin)}`;
    }
    console.log('[plugin:open-native-ui] spawn:', bin, args.join(' '));
    (0, node_child_process_1.spawn)(bin, args, { detached: true, stdio: 'ignore' }).unref();
    return node_path_1.default.basename(bin);
}
/** Reads the LV2 plugin URI from a bundle's manifest.ttl. */
async function lv2Uri(bundlePath) {
    const manifestPath = node_path_1.default.join(bundlePath, 'manifest.ttl');
    let content;
    try {
        content = await promises_1.default.readFile(manifestPath, 'utf-8');
    }
    catch (e) {
        console.error('[plugin:open-native-ui] Cannot read manifest.ttl:', e);
        return null;
    }
    // Match <http://...> followed (possibly with whitespace) by "a lv2:Plugin"
    const m = content.match(/<([^>]+)>\s*(?:\r?\n\s*)?a\s+lv2:Plugin/)
        ?? content.match(/<([^>]+)>/);
    const uri = m?.[1] ?? null;
    console.log('[plugin:open-native-ui] LV2 URI:', uri, 'from', bundlePath);
    return uri;
}
/** Launches the native GUI for a plugin in a detached subprocess. */
async function openNativePluginUI(pluginPath, format) {
    console.log('[plugin:open-native-ui] request:', format, pluginPath);
    const isLinux = process.platform === 'linux';
    const isMac = process.platform === 'darwin';
    // ── LV2 ──────────────────────────────────────────────────────────────────
    if (format === 'lv2') {
        const uri = await lv2Uri(pluginPath);
        if (!uri)
            return { launched: false, tool: '', error: 'Could not extract LV2 URI from manifest.ttl' };
        if (isLinux || isMac) {
            // Prefer jalv (native LV2 host), fall back to carla-single
            for (const name of ['jalv.gtk3', 'jalv.gtk', 'jalv']) {
                const bin = findBin(name);
                if (bin) {
                    const tool = launchDetached(bin, [uri]);
                    return { launched: true, tool };
                }
            }
            const carlaBin = findBin('carla-single');
            if (carlaBin) {
                // carla-single accepts lowercase format: lv2 <uri>
                const tool = launchDetached(carlaBin, ['lv2', uri]);
                return { launched: true, tool };
            }
            return { launched: false, tool: '', error: 'Install jalv or Carla to open LV2 GUIs.\nRun: sudo apt install jalv   OR   sudo apt install carla' };
        }
    }
    // ── VST3 ─────────────────────────────────────────────────────────────────
    if (format === 'vst3') {
        if (isLinux || isMac) {
            const bin = findBin('carla-single');
            if (bin) {
                const tool = launchDetached(bin, ['vst3', pluginPath]);
                return { launched: true, tool };
            }
            return { launched: false, tool: '', error: 'Install Carla to open VST3 GUIs.\nRun: sudo apt install carla' };
        }
    }
    // ── VST (legacy) ─────────────────────────────────────────────────────────
    if (format === 'vst') {
        if (isLinux || isMac) {
            const bin = findBin('carla-single');
            if (bin) {
                const tool = launchDetached(bin, ['vst2', pluginPath]);
                return { launched: true, tool };
            }
            return { launched: false, tool: '', error: 'Install Carla to open VST GUIs.\nRun: sudo apt install carla' };
        }
    }
    return {
        launched: false,
        tool: '',
        error: `Native GUI for ${format.toUpperCase()} is not yet supported on ${process.platform}`,
    };
}
// ─── Generic JSON store helper ────────────────────────────────────────────────
function jsonRead(file, fallback) {
    try {
        return JSON.parse(node_fs_1.default.readFileSync(file, 'utf-8'));
    }
    catch {
        return fallback;
    }
}
function jsonWrite(file, data) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(file), { recursive: true });
    node_fs_1.default.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}
// ─── IPC handlers ─────────────────────────────────────────────────────────────
electron_1.ipcMain.handle('app:version', () => electron_1.app.getVersion());
electron_1.ipcMain.handle('app:platform', () => process.platform);
// ── Pedalboard state ──────────────────────────────────────────────────────────
electron_1.ipcMain.handle('storage:pedalboard:load', () => {
    const file = node_path_1.default.join(electron_1.app.getPath('userData'), 'pedalboard.json');
    return jsonRead(file, null);
});
electron_1.ipcMain.handle('storage:pedalboard:save', (_event, data) => {
    jsonWrite(node_path_1.default.join(electron_1.app.getPath('userData'), 'pedalboard.json'), data);
});
electron_1.ipcMain.handle('storage:pedalboard:clear', () => {
    try {
        node_fs_1.default.unlinkSync(node_path_1.default.join(electron_1.app.getPath('userData'), 'pedalboard.json'));
    }
    catch { /* ignore */ }
});
// ── Preferences (theme + audio devices) ──────────────────────────────────────
electron_1.ipcMain.handle('storage:prefs:load', () => {
    return jsonRead(node_path_1.default.join(electron_1.app.getPath('userData'), 'preferences.json'), {});
});
electron_1.ipcMain.handle('storage:prefs:save', (_event, data) => {
    jsonWrite(node_path_1.default.join(electron_1.app.getPath('userData'), 'preferences.json'), data);
});
// ── Binary assets (NAM models, IR files) ──────────────────────────────────────
const assetsDir = () => node_path_1.default.join(electron_1.app.getPath('userData'), 'assets');
electron_1.ipcMain.handle('storage:asset:save', (_event, key, buffer) => {
    const file = node_path_1.default.join(assetsDir(), key.replace(/[:/]/g, '_'));
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(file), { recursive: true });
    node_fs_1.default.writeFileSync(file, buffer);
    return file;
});
electron_1.ipcMain.handle('storage:asset:read', (_event, key) => {
    try {
        const file = node_path_1.default.join(assetsDir(), key.replace(/[:/]/g, '_'));
        return node_fs_1.default.readFileSync(file); // returns Buffer → transferred as Uint8Array
    }
    catch {
        return null;
    }
});
electron_1.ipcMain.handle('storage:asset:delete', (_event, key) => {
    try {
        node_fs_1.default.unlinkSync(node_path_1.default.join(assetsDir(), key.replace(/[:/]/g, '_')));
    }
    catch { /* ignore */ }
});
/** Reads metadata (name, parameters) for a plugin from its bundle/files. */
electron_1.ipcMain.handle('plugin:metadata', async (_event, pluginPath, format) => {
    if (format === 'lv2')
        return loadLv2Metadata(pluginPath);
    if (format === 'vst3')
        return loadVst3Metadata(pluginPath);
    return null;
});
/** Launches the native plugin GUI via jalv / carla-single. */
electron_1.ipcMain.handle('plugin:open-native-ui', async (_event, pluginPath, format) => openNativePluginUI(pluginPath, format));
/** Returns the currently saved plugin folder paths. */
electron_1.ipcMain.handle('folders:load', () => loadFolderPaths());
/** Opens a folder picker dialog and saves the chosen path. Returns new list. */
electron_1.ipcMain.handle('folders:add', async (_event) => {
    const win = electron_1.BrowserWindow.getFocusedWindow();
    const result = await electron_1.dialog.showOpenDialog(win, {
        properties: ['openDirectory', 'multiSelections'],
        title: 'Select Plugin Folder',
    });
    if (result.canceled || result.filePaths.length === 0)
        return null;
    const current = loadFolderPaths();
    const merged = Array.from(new Set([...current, ...result.filePaths]));
    saveFolderPaths(merged);
    return merged;
});
/** Removes a folder path and persists the new list. */
electron_1.ipcMain.handle('folders:remove', (_event, folderPath) => {
    const current = loadFolderPaths();
    const updated = current.filter((p) => p !== folderPath);
    saveFolderPaths(updated);
    return updated;
});
/** Recursively scans the given folder paths and returns found plugins. */
electron_1.ipcMain.handle('folders:scan', async (_event, folderPaths) => {
    const results = [];
    for (const dir of folderPaths) {
        if (node_fs_1.default.existsSync(dir)) {
            await scanDir(dir, '', 0, results);
        }
    }
    return results;
});
// ─── App lifecycle ────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    injectCrossOriginHeaders();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
