"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
// In CJS context, Electron patches require('electron') to return its APIs.
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
// ─── Paths ────────────────────────────────────────────────────────────────────
// dist-electron/ is sibling to dist/ after vite build.
const RENDERER_DIST = node_path_1.default.join(__dirname, '../dist');
const PRELOAD_PATH = node_path_1.default.join(__dirname, 'preload.cjs');
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
    // Open external links in the system browser, not in Electron.
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
// ─── IPC handlers ─────────────────────────────────────────────────────────────
electron_1.ipcMain.handle('app:version', () => electron_1.app.getVersion());
electron_1.ipcMain.handle('app:platform', () => process.platform);
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
