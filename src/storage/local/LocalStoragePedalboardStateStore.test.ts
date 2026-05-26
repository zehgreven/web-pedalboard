import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStoragePedalboardStateStore } from '@/storage/local/LocalStoragePedalboardStateStore'

describe('LocalStoragePedalboardStateStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads pedalboard layout', async () => {
    const store = new LocalStoragePedalboardStateStore()
    await store.save({
      version: 1,
      nodes: [
        {
          id: 'nam1',
          type: 'nam',
          label: 'NAM',
          enabled: true,
          fileName: 'amp.nam',
        },
      ],
    })

    const loaded = await store.load()
    expect(loaded?.nodes[0]?.fileName).toBe('amp.nam')
  })
})
