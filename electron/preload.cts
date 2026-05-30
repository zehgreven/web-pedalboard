// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
import { contextBridge, ipcRenderer } from 'electron'

/**
 * Safe IPC bridge exposed to the renderer via window.electronAPI.
 * Add new capabilities here when the native plugin host is implemented.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** Current OS platform ('linux' | 'darwin' | 'win32'). */
  platform: process.platform as NodeJS.Platform,

  /** Returns the Electron app version. */
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  // ── Future: native plugin host ──────────────────────────────────────────
  // pluginHost: {
  //   load:   (path: string) => ipcRenderer.invoke('plugin:load', path),
  //   unload: (id: string)   => ipcRenderer.invoke('plugin:unload', id),
  //   setParam: (id, param, value) => ipcRenderer.invoke('plugin:setParam', id, param, value),
  // },
})

export {}

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform
      getVersion(): Promise<string>
    }
  }
}
