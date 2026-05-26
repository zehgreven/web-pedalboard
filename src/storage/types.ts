import type { EffectType } from '@/types/audio'

/** Metadata persisted alongside the pedalboard layout (no blob URLs). */
export interface PersistedPedalboardState {
  version: 1
  nodes: PersistedEffectNode[]
}

export interface PersistedEffectNode {
  id: string
  type: EffectType
  label: string
  enabled: boolean
  /** Original file name when an asset is stored for this node. */
  fileName: string | null
}

/** Binary asset storage — swap this implementation for cloud sync later. */
export interface UserAssetStore {
  save(key: string, file: File | Blob): Promise<void>
  read(key: string): Promise<Blob | null>
  delete(key: string): Promise<void>
}

/** Pedalboard layout persistence (small JSON). */
export interface PedalboardStateStore {
  load(): Promise<PersistedPedalboardState | null>
  save(state: PersistedPedalboardState): Promise<void>
  clear(): Promise<void>
}

export function assetStorageKey(type: EffectType, nodeId: string): string {
  return `${type}:${nodeId}`
}
