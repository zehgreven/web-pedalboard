import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePedalboardStore } from '@/stores/pedalboard'

describe('pedalboard store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('rejects adding duplicated effect types', async () => {
    const store = usePedalboardStore()
    const ok1 = await store.addNode({
      id: '1',
      type: 'nam',
      label: 'NAM',
      enabled: true,
      model: null,
    })
    const ok2 = await store.addNode({
      id: '2',
      type: 'nam',
      label: 'NAM2',
      enabled: true,
      model: null,
    })
    expect(ok1).toBe(true)
    expect(ok2).toBe(false)
    expect(store.nodes).toHaveLength(1)
  })

  it('sets NAM model only for NAM nodes', async () => {
    const store = usePedalboardStore()
    await store.addNode({ id: 'nam1', type: 'nam', label: 'NAM', enabled: true, model: null })
    await store.addNode({ id: 'ir1', type: 'ir', label: 'IR', enabled: true, ir: null })

    await store.setNamModel('ir1', { name: 'x.nam', url: 'blob:abc' })
    expect(store.nodes.find((n) => n.id === 'ir1')).toMatchObject({ type: 'ir' })

    await store.setNamModel('nam1', { name: 'x.nam', url: 'blob:abc' })
    const nam = store.nodes.find((n) => n.id === 'nam1')
    expect(nam?.type).toBe('nam')
    if (nam?.type === 'nam') expect(nam.model?.name).toBe('x.nam')
  })
})
