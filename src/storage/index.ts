import { BrowserUserAssetStore } from '@/storage/local/BrowserUserAssetStore'
import { LocalStoragePedalboardStateStore } from '@/storage/local/LocalStoragePedalboardStateStore'
import type { PedalboardStateStore, UserAssetStore } from '@/storage/types'

export type { PedalboardStateStore, PersistedPedalboardState, UserAssetStore } from '@/storage/types'
export { assetStorageKey } from '@/storage/types'

let assetStore: UserAssetStore | null = null
let stateStore: PedalboardStateStore | null = null

/** Default browser-local asset backend (IndexedDB). Replace for cloud storage. */
export function getUserAssetStore(): UserAssetStore {
  assetStore ??= new BrowserUserAssetStore()
  return assetStore
}

/** Default layout backend (localStorage JSON). */
export function getPedalboardStateStore(): PedalboardStateStore {
  stateStore ??= new LocalStoragePedalboardStateStore()
  return stateStore
}

/** Test helper — inject a custom store implementation. */
export function setUserAssetStore(store: UserAssetStore): void {
  assetStore = store
}

export function setPedalboardStateStore(store: PedalboardStateStore): void {
  stateStore = store
}
