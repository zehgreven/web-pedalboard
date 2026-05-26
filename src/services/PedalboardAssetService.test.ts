import { beforeEach, describe, expect, it } from 'vitest'
import { assetStorageKey } from '@/storage/types'
import type { PedalboardStateStore, UserAssetStore } from '@/storage/types'
import { setPedalboardStateStore, setUserAssetStore } from '@/storage'
import { PedalboardAssetService } from '@/services/PedalboardAssetService'

class MemoryAssetStore implements UserAssetStore {
  private files = new Map<string, Blob>()

  async save(key: string, file: File | Blob): Promise<void> {
    this.files.set(key, file)
  }

  async read(key: string): Promise<Blob | null> {
    return this.files.get(key) ?? null
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key)
  }
}

class MemoryStateStore implements PedalboardStateStore {
  private state: Awaited<ReturnType<PedalboardStateStore['load']>> = null

  async load() {
    return this.state
  }

  async save(state: NonNullable<typeof this.state>): Promise<void> {
    this.state = state
  }

  async clear(): Promise<void> {
    this.state = null
  }
}

describe('PedalboardAssetService', () => {
  let assets: MemoryAssetStore
  let state: MemoryStateStore
  let service: PedalboardAssetService

  beforeEach(() => {
    assets = new MemoryAssetStore()
    state = new MemoryStateStore()
    setUserAssetStore(assets)
    setPedalboardStateStore(state)
    service = new PedalboardAssetService()
  })

  it('persists and hydrates NAM assets', async () => {
    const file = new File(['{"version":"0.5.4"}'], 'amp.nam', { type: 'text/plain' })
    const saved = await service.saveAsset('nam1', 'nam', file)

    await service.persist([
      {
        id: 'nam1',
        type: 'nam',
        label: 'NAM Capture',
        enabled: true,
        model: saved,
      },
    ])

    const hydrated = await service.hydrate()
    expect(hydrated).toHaveLength(1)
    expect(hydrated[0]?.type).toBe('nam')
    if (hydrated[0]?.type === 'nam') {
      expect(hydrated[0].model?.name).toBe('amp.nam')
      expect(hydrated[0].model?.url).toMatch(/^blob:/)
    }
  })

  it('uses stable storage keys per effect', () => {
    expect(assetStorageKey('nam', 'abc')).toBe('nam:abc')
    expect(assetStorageKey('ir', 'xyz')).toBe('ir:xyz')
  })
})
