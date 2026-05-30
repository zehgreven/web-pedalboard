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
  /** NAM only: pre-model input gain (0–100, default 50). */
  inputGain?: number
  /** NAM only: post-model output level (0–100, default 50). */
  outputLevel?: number
  /** NAM only: noise gate threshold (0–100, default 0). */
  noiseGateThreshold?: number
  /** NAM only: noise gate active (default true). */
  noiseGateActive?: boolean
  /** NAM only: bass knob (0–100, default 50). */
  bass?: number
  /** NAM only: mid knob (0–100, default 50). */
  mid?: number
  /** NAM only: treble knob (0–100, default 50). */
  treble?: number
  /** NAM only: tone stack active (default true). */
  eqActive?: boolean
  /** IR only: output level (0–100, default 50). */
  level?: number
  /** IR only: low-cut knob (0–100, default 0). */
  lowCut?: number
  /** IR only: high-cut knob (0–100, default 0). */
  highCut?: number
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
