/**
 * Types for the Electron IPC bridge exposed via contextBridge in preload.cts.
 * In the browser (no Electron), window.electronAPI is undefined.
 */

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
}

declare global {
  interface Window {
    /** Only defined when running inside Electron (via contextBridge). */
    electronAPI?: ElectronAPI
  }
}

export {}
