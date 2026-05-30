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
  /** Noise gate threshold. 0–100 maps to −80–0 dB. Default: 0 (−80 dB). */
  noiseGateThreshold: number
  /** Whether the noise gate is active. Default: true */
  noiseGateActive: boolean
  /** Bass shelf. 0–100 where 50 = flat (0 dB). Default: 50 */
  bass: number
  /** Mid peak. 0–100 where 50 = flat (0 dB). Default: 50 */
  mid: number
  /** Treble shelf. 0–100 where 50 = flat (0 dB). Default: 50 */
  treble: number
  /** Whether the tone stack is active. Default: true */
  eqActive: boolean
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
