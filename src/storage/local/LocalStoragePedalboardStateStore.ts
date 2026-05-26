import type { PedalboardStateStore, PersistedPedalboardState } from '@/storage/types'

const STORAGE_KEY = 'web-pedalboard:state'

/** Persists pedalboard layout as JSON in localStorage. */
export class LocalStoragePedalboardStateStore implements PedalboardStateStore {
  async load(): Promise<PersistedPedalboardState | null> {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as PersistedPedalboardState
      if (parsed.version !== 1 || !Array.isArray(parsed.nodes)) return null
      return parsed
    } catch {
      return null
    }
  }

  async save(state: PersistedPedalboardState): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY)
  }
}
