import { defineStore } from 'pinia'
import type { AudioNode, PedalboardChain } from '@/types/audio'

export const usePedalboardStore = defineStore('pedalboard', {
  state: (): PedalboardChain => ({
    nodes: [],
  }),
  actions: {
    addNode(node: AudioNode): boolean {
      if (this.nodes.some((n) => n.type === node.type)) return false
      this.nodes.push(node)
      return true
    },
    removeNode(id: string) {
      this.nodes = this.nodes.filter((n) => n.id !== id)
    },
    toggleNode(id: string) {
      const node = this.nodes.find((n) => n.id === id)
      if (node) node.enabled = !node.enabled
    },
    moveNode(fromIndex: number, toIndex: number) {
      const nodes = [...this.nodes]
      const [moved] = nodes.splice(fromIndex, 1)
      if (moved) nodes.splice(toIndex, 0, moved)
      this.nodes = nodes
    },
  },
})
