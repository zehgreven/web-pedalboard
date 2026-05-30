"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
const electron_1 = require("electron");
/**
 * Safe IPC bridge exposed to the renderer via window.electronAPI.
 * Add new capabilities here when the native plugin host is implemented.
 */
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    /** Current OS platform ('linux' | 'darwin' | 'win32'). */
    platform: process.platform,
    /** Returns the Electron app version. */
    getVersion: () => electron_1.ipcRenderer.invoke('app:version'),
    // ── Future: native plugin host ──────────────────────────────────────────
    // pluginHost: {
    //   load:   (path: string) => ipcRenderer.invoke('plugin:load', path),
    //   unload: (id: string)   => ipcRenderer.invoke('plugin:unload', id),
    //   setParam: (id, param, value) => ipcRenderer.invoke('plugin:setParam', id, param, value),
    // },
});
