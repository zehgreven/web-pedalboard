export type EffectType = 'nam' | 'ir'

export interface BaseAudioNode {
  id: string
  type: EffectType
  label: string
  enabled: boolean
}

export interface NamModelRef {
  name: string
  url: string
}

export interface NamAudioNode extends BaseAudioNode {
  type: 'nam'
  model: NamModelRef | null
}

export interface IrFileRef {
  name: string
  url: string
}

export interface IrAudioNode extends BaseAudioNode {
  type: 'ir'
  ir: IrFileRef | null
}

export type AudioNode = NamAudioNode | IrAudioNode

export interface PedalboardChain {
  nodes: AudioNode[]
  hydrated: boolean
}

export interface EffectDefinition {
  type: EffectType
  label: string
  category: string
  description: string
}
