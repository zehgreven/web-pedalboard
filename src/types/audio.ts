export interface AudioNode {
  id: string
  type: string
  label: string
  enabled: boolean
}

export interface PedalboardChain {
  nodes: AudioNode[]
}
