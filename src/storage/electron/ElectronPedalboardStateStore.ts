import type { PedalboardStateStore, PersistedPedalboardState } from '@/storage/types'

/**
 * Reads and writes the pedalboard layout as a JSON file in Electron's userData
 * directory via IPC. Replaces LocalStoragePedalboardStateStore when running in Electron.
 */
export class ElectronPedalboardStateStore implements PedalboardStateStore {
  async load(): Promise<PersistedPedalboardState | null> {
    const data = await window.electronAPI!.storage.pedalboard.load()
    if (!data || typeof data !== 'object') return null
    return data as PersistedPedalboardState
  }

  async save(state: PersistedPedalboardState): Promise<void> {
    await window.electronAPI!.storage.pedalboard.save(state)
  }

  async clear(): Promise<void> {
    await window.electronAPI!.storage.pedalboard.clear()
  }
}
