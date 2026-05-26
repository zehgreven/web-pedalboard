import { describe, expect, it } from 'vitest'
import { buildChainPlan } from '@/audio/engine/chainPlan'
import type { AudioNode } from '@/types/audio'

describe('buildChainPlan', () => {
  it('builds segments in pedalboard order', () => {
    const nodes: AudioNode[] = [
      { id: 'ir1', type: 'ir', label: 'IR', enabled: true, ir: { name: 'cab.wav', url: 'blob:ir' } },
      { id: 'nam1', type: 'nam', label: 'NAM', enabled: true, model: { name: 'amp.nam', url: 'blob:nam' } },
    ]

    const plan = buildChainPlan(nodes)
    expect(plan.segments).toEqual([
      { nodeId: 'ir1', type: 'ir' },
      { nodeId: 'nam1', type: 'nam' },
    ])
    expect(plan.namModelUrl).toBe('blob:nam')
    expect(plan.missingNamModel).toBe(false)
  })

  it('skips effects without loaded assets', () => {
    const nodes: AudioNode[] = [
      { id: 'nam1', type: 'nam', label: 'NAM', enabled: true, model: null },
      { id: 'ir1', type: 'ir', label: 'IR', enabled: true, ir: null },
    ]

    const plan = buildChainPlan(nodes)
    expect(plan.segments).toEqual([])
    expect(plan.missingNamModel).toBe(true)
  })
})
