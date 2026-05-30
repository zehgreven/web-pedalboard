export class IrLoader {
  private readonly inputNode: GainNode
  private readonly outputNode: GainNode
  private readonly convolver: ConvolverNode
  private readonly dryGain: GainNode
  private readonly wetGain: GainNode

  constructor(private readonly context: AudioContext) {
    this.inputNode = context.createGain()
    this.outputNode = context.createGain()
    this.convolver = context.createConvolver()
    this.dryGain = context.createGain()
    this.wetGain = context.createGain()

    this.inputNode.connect(this.dryGain)
    this.inputNode.connect(this.convolver)
    this.convolver.connect(this.wetGain)
    this.dryGain.connect(this.outputNode)
    this.wetGain.connect(this.outputNode)

    this.setBypass(false)
  }

  getInput(): AudioNode {
    return this.inputNode
  }

  getOutput(): AudioNode {
    return this.outputNode
  }

  async load(url: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch IR: ${response.statusText}`)
    }

    const buffer = await this.context.decodeAudioData(await response.arrayBuffer())
    this.convolver.buffer = buffer
  }

  /** Linear gain factor applied at the output (0 = mute, 1 = unity). */
  setLevel(gain: number): void {
    const t = this.context.currentTime
    this.outputNode.gain.setTargetAtTime(gain, t, 0.005)
  }

  setBypass(bypassed: boolean): void {
    const t = this.context.currentTime
    if (bypassed) {
      this.dryGain.gain.setTargetAtTime(1, t, 0.01)
      this.wetGain.gain.setTargetAtTime(0, t, 0.01)
    } else {
      this.dryGain.gain.setTargetAtTime(0, t, 0.01)
      this.wetGain.gain.setTargetAtTime(1, t, 0.01)
    }
  }

  dispose(): void {
    this.inputNode.disconnect()
    this.convolver.disconnect()
    this.dryGain.disconnect()
    this.wetGain.disconnect()
    this.outputNode.disconnect()
  }
}
