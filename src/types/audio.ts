export type EffectType = 'nam' | 'ir'

export interface AudioNode {
  id: string
  type: EffectType
  label: string
  enabled: boolean
}

export interface PedalboardChain {
  nodes: AudioNode[]
}

export interface EffectDefinition {
  type: EffectType
  label: string
  category: string
  description: string
}
