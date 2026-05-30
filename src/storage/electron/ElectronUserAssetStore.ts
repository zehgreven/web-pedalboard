import type { UserAssetStore } from '@/storage/types'

/**
 * Stores binary assets (NAM models, IR WAV files) as real files in Electron's
 * userData/assets/ directory via IPC. Replaces BrowserUserAssetStore.
 */
export class ElectronUserAssetStore implements UserAssetStore {
  async save(key: string, file: File | Blob): Promise<void> {
    const buffer = await file.arrayBuffer()
    await window.electronAPI!.storage.asset.save(key, new Uint8Array(buffer))
  }

  async read(key: string): Promise<Blob | null> {
    const bytes = await window.electronAPI!.storage.asset.read(key)
    if (!bytes) return null
    return new Blob([bytes])
  }

  async delete(key: string): Promise<void> {
    await window.electronAPI!.storage.asset.delete(key)
  }
}
