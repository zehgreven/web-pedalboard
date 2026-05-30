"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
// In CJS, Electron patches require('electron') to return its APIs.
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    getVersion: () => electron_1.ipcRenderer.invoke('app:version'),
    storage: {
        pedalboard: {
            load: () => electron_1.ipcRenderer.invoke('storage:pedalboard:load'),
            save: (data) => electron_1.ipcRenderer.invoke('storage:pedalboard:save', data),
            clear: () => electron_1.ipcRenderer.invoke('storage:pedalboard:clear'),
        },
        prefs: {
            load: () => electron_1.ipcRenderer.invoke('storage:prefs:load'),
            save: (data) => electron_1.ipcRenderer.invoke('storage:prefs:save', data),
        },
        asset: {
            save: (key, buffer) => electron_1.ipcRenderer.invoke('storage:asset:save', key, Buffer.from(buffer)),
            read: (key) => electron_1.ipcRenderer.invoke('storage:asset:read', key),
            delete: (key) => electron_1.ipcRenderer.invoke('storage:asset:delete', key),
        },
    },
    folders: {
        load: () => electron_1.ipcRenderer.invoke('folders:load'),
        add: () => electron_1.ipcRenderer.invoke('folders:add'),
        remove: (folderPath) => electron_1.ipcRenderer.invoke('folders:remove', folderPath),
        scan: (folderPaths) => electron_1.ipcRenderer.invoke('folders:scan', folderPaths),
    },
});
