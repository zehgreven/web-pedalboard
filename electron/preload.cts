// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
// In CJS, Electron patches require('electron') to return its APIs.
import { contextBridge, ipcRenderer } from 'electron'

type FoundPlugin = {
  id: string
  name: string
  format: 'vst3' | 'vst' | 'lv2' | 'ladspa'
  path: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform as NodeJS.Platform,
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  storage: {
    pedalboard: {
      load: (): Promise<unknown> => ipcRenderer.invoke('storage:pedalboard:load'),
      save: (data: unknown): Promise<void> => ipcRenderer.invoke('storage:pedalboard:save', data),
      clear: (): Promise<void> => ipcRenderer.invoke('storage:pedalboard:clear'),
    },
    prefs: {
      load: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('storage:prefs:load'),
      save: (data: Record<string, unknown>): Promise<void> => ipcRenderer.invoke('storage:prefs:save', data),
    },
    asset: {
      save: (key: string, buffer: Uint8Array): Promise<string> =>
        ipcRenderer.invoke('storage:asset:save', key, Buffer.from(buffer)),
      read: (key: string): Promise<Uint8Array | null> =>
        ipcRenderer.invoke('storage:asset:read', key),
      delete: (key: string): Promise<void> =>
        ipcRenderer.invoke('storage:asset:delete', key),
    },
  },

  folders: {
    load: (): Promise<string[]> =>
      ipcRenderer.invoke('folders:load'),

    add: (): Promise<string[] | null> =>
      ipcRenderer.invoke('folders:add'),

    remove: (folderPath: string): Promise<string[]> =>
      ipcRenderer.invoke('folders:remove', folderPath),

    scan: (folderPaths: string[]): Promise<FoundPlugin[]> =>
      ipcRenderer.invoke('folders:scan', folderPaths),
  },

  plugin: {
    metadata: (pluginPath: string, format: string) =>
      ipcRenderer.invoke('plugin:metadata', pluginPath, format) as Promise<{
        name: string
        description: string
        params: Array<{ id: string; label: string; default: number; min: number; max: number; unit: string }>
      } | null>,

    openNativeUI: (pluginPath: string, format: string) =>
      ipcRenderer.invoke('plugin:open-native-ui', pluginPath, format) as Promise<{
        launched: boolean
        tool: string
        error?: string
      }>,
  },

  carla: {
    available: (): Promise<boolean> =>
      ipcRenderer.invoke('carla:available'),

    getLv2Uri: (bundlePath: string): Promise<string | null> =>
      ipcRenderer.invoke('carla:get-lv2-uri', bundlePath),

    status: (): Promise<{ status: string; error: string }> =>
      ipcRenderer.invoke('carla:status'),

    start: (
      plugins: Array<{
        pluginType: string; binary: string; name: string; label: string; uniqueId?: number
      }>,
      driver?: string,
      device?: string,
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('carla:start', plugins, driver ?? 'JACK', device ?? ''),

    stop: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('carla:stop'),

    setParam: (pluginId: number, paramId: number, value: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('carla:set-param', pluginId, paramId, value),

    setActive: (pluginId: number, active: boolean): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('carla:set-active', pluginId, active),

    getParams: (pluginId: number): Promise<Array<{
      id: number; name: string; symbol: string; unit: string
      value: number; min: number; max: number; default: number
    }>> =>
      ipcRenderer.invoke('carla:get-params', pluginId),

    onStatusChanged: (
      cb: (payload: { status: string; error: string }) => void
    ): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, payload: { status: string; error: string }) => cb(payload)
      ipcRenderer.on('carla:status-changed', handler)
      return () => ipcRenderer.removeListener('carla:status-changed', handler)
    },
  },
})

export {}

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform
      getVersion(): Promise<string>
      folders: {
        load(): Promise<string[]>
        add(): Promise<string[] | null>
        remove(folderPath: string): Promise<string[]>
        scan(folderPaths: string[]): Promise<FoundPlugin[]>
      }
    }
  }
}
