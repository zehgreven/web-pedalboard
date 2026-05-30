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
  /** Pre-model input gain. 0–100 where 50 = unity (×1.0). Default: 50 */
  inputGain: number
  /** Post-model output level. 0–100 where 50 = unity (×1.0). Default: 50 */
  outputLevel: number
}

export interface IrFileRef {
  name: string
  url: string
}

export interface IrAudioNode extends BaseAudioNode {
  type: 'ir'
  ir: IrFileRef | null
  /** Output level. 0–100 where 50 = unity (×1.0). Default: 50 */
  level: number
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
