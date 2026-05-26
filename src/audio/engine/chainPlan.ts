import type { AudioNode, NamAudioNode } from '@/types/audio'

export interface ChainSegment {
  nodeId: string
  type: 'nam' | 'ir'
}

export interface ChainPlan {
  segments: ChainSegment[]
  namModelUrl: string | null
  missingNamModel: boolean
}

export function buildChainPlan(nodes: AudioNode[]): ChainPlan {
  const segments: ChainSegment[] = []
  let namModelUrl: string | null = null
  let missingNamModel = false

  for (const node of nodes) {
    if (node.type === 'nam') {
      if (!node.model?.url) {
        missingNamModel = true
        continue
      }
      namModelUrl = node.model.url
      segments.push({ nodeId: node.id, type: 'nam' })
      continue
    }

    if (node.type === 'ir' && node.ir?.url) {
      segments.push({ nodeId: node.id, type: 'ir' })
    }
  }

  return { segments, namModelUrl, missingNamModel }
}

export function findNamNode(nodes: AudioNode[]): NamAudioNode | undefined {
  const node = nodes.find((n) => n.type === 'nam')
  return node?.type === 'nam' ? node : undefined
}
