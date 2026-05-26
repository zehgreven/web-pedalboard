import { defineStore } from 'pinia'
import { pedalboardAssetService } from '@/services/PedalboardAssetService'
import type { AudioNode, IrFileRef, NamModelRef, PedalboardChain } from '@/types/audio'

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
      if (this.nodes.some((n) => n.type === node.type)) return false
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
    async moveNode(fromIndex: number, toIndex: number): Promise<void> {
      const nodes = [...this.nodes]
      const [moved] = nodes.splice(fromIndex, 1)
      if (moved) nodes.splice(toIndex, 0, moved)
      this.nodes = nodes
      await this.persist()
    },
  },
})
