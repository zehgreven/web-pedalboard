import { defineStore } from 'pinia'
import { pedalboardAssetService } from '@/services/PedalboardAssetService'
import type { AudioNode, IrFileRef, NamModelRef, PedalboardChain } from '@/types/audio'

/** Converts the 0–100 knob value to a linear gain factor (50 = ×1.0). */
export function knobToGain(value: number): number {
  return value / 50
}

export const usePedalboardStore = defineStore('pedalboard', {
  state: (): PedalboardChain => ({
    nodes: [],
    hydrated: false,
  }),
  actions: {
    async hydrate(): Promise<void> {
      this.nodes = await pedalboardAssetService.hydrate()
      this.hydrated = true
    },
    async persist(): Promise<void> {
      await pedalboardAssetService.persist(this.nodes)
    },
    async addNode(node: AudioNode): Promise<boolean> {
      // 'plugin' nodes are unlimited; 'nam' and 'ir' are limited to one each.
      if (node.type !== 'plugin' && this.nodes.some((n) => n.type === node.type)) return false
      this.nodes.push(node)
      await this.persist()
      return true
    },
    async removeNode(id: string): Promise<void> {
      const node = this.nodes.find((n) => n.id === id)
      if (node?.type === 'nam') {
        await pedalboardAssetService.clearAsset(id, 'nam')
      } else if (node?.type === 'ir') {
        await pedalboardAssetService.clearAsset(id, 'ir')
      }
      // 'plugin' nodes have no stored assets — nothing to clear.
      this.nodes = this.nodes.filter((n) => n.id !== id)
      await this.persist()
    },
    async toggleNode(id: string): Promise<void> {
      const node = this.nodes.find((n) => n.id === id)
      if (node) node.enabled = !node.enabled
      await this.persist()
    },
    async setNamModel(id: string, model: NamModelRef | null): Promise<void> {
      const node = this.nodes.find((n) => n.id === id)
      if (!node || node.type !== 'nam') return
      node.model = model
      await this.persist()
    },
    async setIrFile(id: string, ir: IrFileRef | null): Promise<void> {
      const node = this.nodes.find((n) => n.id === id)
      if (!node || node.type !== 'ir') return
      node.ir = ir
      await this.persist()
    },
    async updateNamParams(
      id: string,
      params: Partial<{
        inputGain: number
        outputLevel: number
        noiseGateThreshold: number
        noiseGateActive: boolean
        bass: number
        mid: number
        treble: number
        eqActive: boolean
      }>,
    ): Promise<void> {
      const node = this.nodes.find((n) => n.id === id)
      if (!node || node.type !== 'nam') return
      if (params.inputGain !== undefined) node.inputGain = params.inputGain
      if (params.outputLevel !== undefined) node.outputLevel = params.outputLevel
      if (params.noiseGateThreshold !== undefined) node.noiseGateThreshold = params.noiseGateThreshold
      if (params.noiseGateActive !== undefined) node.noiseGateActive = params.noiseGateActive
      if (params.bass !== undefined) node.bass = params.bass
      if (params.mid !== undefined) node.mid = params.mid
      if (params.treble !== undefined) node.treble = params.treble
      if (params.eqActive !== undefined) node.eqActive = params.eqActive
      await this.persist()
    },
    async updateIrParams(
      id: string,
      params: Partial<{ level: number; lowCut: number; highCut: number }>,
    ): Promise<void> {
      const node = this.nodes.find((n) => n.id === id)
      if (!node || node.type !== 'ir') return
      if (params.level !== undefined) node.level = params.level
      if (params.lowCut !== undefined) node.lowCut = params.lowCut
      if (params.highCut !== undefined) node.highCut = params.highCut
      await this.persist()
    },
    async moveNode(fromIndex: number, toIndex: number): Promise<void> {
      const nodes = [...this.nodes]
      const [moved] = nodes.splice(fromIndex, 1)
      if (moved) nodes.splice(toIndex, 0, moved)
      this.nodes = nodes
      await this.persist()
    },
  },
})
