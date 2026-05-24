export interface AudioNode {
  id: string
  type: string
  enabled: boolean
}

export interface PedalboardChain {
  nodes: AudioNode[]
}
