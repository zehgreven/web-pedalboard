/**
 * Types for the Electron IPC bridge exposed via contextBridge in preload.cts.
 * In the browser (no Electron), window.electronAPI is undefined.
 */

interface ElectronPluginParam {
  id: string
  label: string
  default: number
  min: number
  max: number
  unit: string
}

interface ElectronPluginMetadata {
  name: string
  description: string
  params: ElectronPluginParam[]
}

interface ElectronFoundPlugin {
  id: string
  name: string
  format: 'vst3' | 'vst' | 'lv2' | 'ladspa'
  path: string
}

interface ElectronAPI {
  platform: NodeJS.Platform
  getVersion(): Promise<string>

  storage: {
    pedalboard: {
      load(): Promise<unknown>
      save(data: unknown): Promise<void>
      clear(): Promise<void>
    }
    prefs: {
      load(): Promise<Record<string, unknown>>
      save(data: Record<string, unknown>): Promise<void>
    }
    asset: {
      save(key: string, buffer: Uint8Array): Promise<string>
      read(key: string): Promise<Uint8Array | null>
      delete(key: string): Promise<void>
    }
  }

  folders: {
    load(): Promise<string[]>
    add(): Promise<string[] | null>
    remove(folderPath: string): Promise<string[]>
    scan(folderPaths: string[]): Promise<ElectronFoundPlugin[]>
  }

  plugin: {
    metadata(pluginPath: string, format: string): Promise<ElectronPluginMetadata | null>
    openNativeUI(pluginPath: string, format: string): Promise<{ launched: boolean; tool: string; error?: string }>
  }

  carla: {
    available(): Promise<boolean>
    getLv2Uri(bundlePath: string): Promise<string | null>
    status(): Promise<{ status: string; error: string }>
    start(
      plugins: CarlaPluginSpec[],
      driver?: string,
      device?: string,
    ): Promise<{ ok: boolean; error?: string }>
    stop(): Promise<{ ok: boolean }>
    setParam(pluginId: number, paramId: number, value: number): Promise<{ ok: boolean }>
    setActive(pluginId: number, active: boolean): Promise<{ ok: boolean }>
    getParams(pluginId: number): Promise<CarlaParam[]>
    onStatusChanged(cb: (payload: { status: string; error: string }) => void): () => void
  }
}

interface CarlaPluginSpec {
  pluginType: string
  binary: string
  name: string
  label: string
  uniqueId?: number
}

interface CarlaParam {
  id: number
  name: string
  symbol: string
  unit: string
  value: number
  min: number
  max: number
  default: number
}

declare global {
  interface Window {
    /** Only defined when running inside Electron (via contextBridge). */
    electronAPI?: ElectronAPI
  }
}

export {}
