import { BrowserUserAssetStore } from '@/storage/local/BrowserUserAssetStore'
import { LocalStoragePedalboardStateStore } from '@/storage/local/LocalStoragePedalboardStateStore'
import { ElectronPedalboardStateStore } from '@/storage/electron/ElectronPedalboardStateStore'
import { ElectronUserAssetStore } from '@/storage/electron/ElectronUserAssetStore'
import type { PedalboardStateStore, UserAssetStore } from '@/storage/types'

export type { PedalboardStateStore, PersistedPedalboardState, UserAssetStore } from '@/storage/types'
export { assetStorageKey } from '@/storage/types'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

let assetStore: UserAssetStore | null = null
let stateStore: PedalboardStateStore | null = null

/**
 * Asset backend:
 *   - Electron → files in userData/assets/ (via IPC)
 *   - Browser  → IndexedDB (BrowserUserAssetStore)
 */
export function getUserAssetStore(): UserAssetStore {
  assetStore ??= isElectron
    ? new ElectronUserAssetStore()
    : new BrowserUserAssetStore()
  return assetStore
}

/**
 * Pedalboard layout backend:
 *   - Electron → pedalboard.json in userData (via IPC)
 *   - Browser  → localStorage (LocalStoragePedalboardStateStore)
 */
export function getPedalboardStateStore(): PedalboardStateStore {
  stateStore ??= isElectron
    ? new ElectronPedalboardStateStore()
    : new LocalStoragePedalboardStateStore()
  return stateStore
}

/** Test helper — inject a custom store implementation. */
export function setUserAssetStore(store: UserAssetStore): void {
  assetStore = store
}

export function setPedalboardStateStore(store: PedalboardStateStore): void {
  stateStore = store
}
