import { defineStore } from 'pinia'
import type { PedalboardChain } from '@/types/audio'

export const usePedalboardStore = defineStore('pedalboard', {
  state: (): PedalboardChain => ({
    nodes: [],
  }),
  actions: {
    addNode(node: PedalboardChain['nodes'][number]) {
      this.nodes.push(node)
    },
    removeNode(id: string) {
      this.nodes = this.nodes.filter((n) => n.id !== id)
    },
    toggleNode(id: string) {
      const node = this.nodes.find((n) => n.id === id)
      if (node) node.enabled = !node.enabled
    },
  },
})
