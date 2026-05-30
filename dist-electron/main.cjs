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
