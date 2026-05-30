/**
 * Low-cut knob 0–100 → highpass frequency (Hz), logarithmic.
 * 0 → 20 Hz (off), 100 → 500 Hz
 */
function knobToLowCutFreq(v: number): number {
  return 20 * Math.pow(25, v / 100)
}

/**
 * High-cut knob 0–100 → lowpass frequency (Hz), logarithmic.
 * 0 → 20 000 Hz (off), 100 → 2 000 Hz
 */
function knobToHighCutFreq(v: number): number {
  return 20_000 * Math.pow(0.1, v / 100)
}

export class IrLoader {
  private readonly inputNode: GainNode
  private readonly outputNode: GainNode
  private readonly convolver: ConvolverNode
  private readonly dryGain: GainNode
  private readonly wetGain: GainNode
  private readonly lowCutNode: BiquadFilterNode
  private readonly highCutNode: BiquadFilterNode

  constructor(private readonly context: AudioContext) {
    this.inputNode = context.createGain()
    this.outputNode = context.createGain()
    this.convolver = context.createConvolver()
    this.dryGain = context.createGain()
    this.wetGain = context.createGain()

    // Filters sit at the output, after the convolver mix.
    this.lowCutNode = new BiquadFilterNode(context, {
      type: 'highpass',
      frequency: 20,
      Q: 0.7,
    })
    this.highCutNode = new BiquadFilterNode(context, {
      type: 'lowpass',
      frequency: 20_000,
      Q: 0.7,
    })

    // Signal path: input → [dry/wet] → lowCut → highCut → output
    this.inputNode.connect(this.dryGain)
    this.inputNode.connect(this.convolver)
    this.convolver.connect(this.wetGain)
    this.dryGain.connect(this.lowCutNode)
    this.wetGain.connect(this.lowCutNode)
    this.lowCutNode.connect(this.highCutNode)
    this.highCutNode.connect(this.outputNode)

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
    if (!response.ok) throw new Error(`Failed to fetch IR: ${response.statusText}`)
    const buffer = await this.context.decodeAudioData(await response.arrayBuffer())
    this.convolver.buffer = buffer
  }

  /** Output level: linear gain factor (1 = unity). */
  setLevel(gain: number): void {
    this.outputNode.gain.setTargetAtTime(gain, this.context.currentTime, 0.005)
  }

  /** Low-cut knob value 0–100. 0 = off (~20 Hz). */
  setLowCut(value: number): void {
    const freq = knobToLowCutFreq(value)
    this.lowCutNode.frequency.setTargetAtTime(freq, this.context.currentTime, 0.01)
  }

  /** High-cut knob value 0–100. 0 = off (~20 kHz). */
  setHighCut(value: number): void {
    const freq = knobToHighCutFreq(value)
    this.highCutNode.frequency.setTargetAtTime(freq, this.context.currentTime, 0.01)
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
    this.lowCutNode.disconnect()
    this.highCutNode.disconnect()
    this.outputNode.disconnect()
  }
}
