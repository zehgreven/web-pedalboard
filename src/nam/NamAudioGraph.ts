import { readModel } from '@/nam/readModel'
import { loadWasmModule, loadWasmScript } from '@/nam/wasmModule'
import { EMPTY_NAM_AUDIO_NODES, type NamAudioNodes } from '@/nam/types'

/** Minimal silent WAV so the WASM init graph can attach a MediaElementSource. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

const WORKLET_INIT_TIMEOUT_MS = 15_000

// ─── Tone-stack helpers ────────────────────────────────────────────────────

/** Maps knob 0–100 (50 = flat) to filter gain in dB (±12 dB). */
function knobToEqGain(value: number): number {
  return ((value - 50) / 50) * 12
}

/** Maps 0–100 knob to threshold in dB (0 → −80 dB, 100 → 0 dB). */
function knobToGateDb(value: number): number {
  return (value / 100) * 80 - 80
}

/**
 * Lifecycle:
 *   init()         – loads WASM script + calls setDsp once; AudioContext created by WASM
 *   connectInput() – attaches a MediaStream to the processing graph
 *   suspend()      – stops mic tracks, suspends AudioContext (Stop button)
 *   resume()       – re-attaches mic, resumes AudioContext (Start button again)
 *   loadModel()    – hot-swaps the .nam model while running or suspended
 *   destroy()      – closes AudioContext for real (effect removed from board)
 *
 * Signal path:
 *   [liveSrc] → gateAnalyser → gateGain → inputGain → inputMeter
 *               → bypassNode ──────────────────────────────► outputGain
 *               → workletNode (NAM) ────────────────────────► outputGain
 *               outputGain → bass → mid → treble → outputMeter → [chain tail]
 */
export class NamAudioGraph {
  private nodes: NamAudioNodes = { ...EMPTY_NAM_AUDIO_NODES }
  private initialized = false
  private initializing = false
  private modelUrl: string | null = null

  // Noise-gate state
  private gateActive = true
  private gateThresholdDb = -80
  private gateOpen = true
  private gatePollHandle: number | null = null

  get isInitialized(): boolean {
    return this.initialized
  }

  get loadedModelUrl(): string | null {
    return this.modelUrl
  }

  // ─── Init (called once) ───────────────────────────────────────────────────

  async init(modelUrl: string): Promise<void> {
    if (this.initialized || this.initializing) return

    this.initializing = true
    try {
      if (typeof window === 'undefined' || !window.AudioContext || !window.AudioWorklet) {
        throw new Error('AudioWorklet is not supported in this browser')
      }

      const audioReady = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error('NAM AudioWorklet failed to initialize')),
          WORKLET_INIT_TIMEOUT_MS,
        )

        window.wasmAudioWorkletCreated = (workletNode, context) => {
          window.clearTimeout(timeout)
          this.nodes.audioWorkletNode = workletNode
          this.nodes.audioContext = context

          // ── Input-side nodes ──
          this.nodes.gateAnalyserNode = new AnalyserNode(context, { fftSize: 1024 })
          this.nodes.gateGainNode = new GainNode(context, { gain: 1 })
          this.nodes.inputGainNode = new GainNode(context, { gain: 1 })
          this.nodes.inputMeterNode = new AnalyserNode(context, { fftSize: 2048 })
          this.nodes.bypassNode = new GainNode(context, { gain: 0 })

          // ── Output-side nodes ──
          this.nodes.outputGainNode = new GainNode(context, { gain: 1 })
          this.nodes.bassNode = new BiquadFilterNode(context, {
            type: 'lowshelf',
            frequency: 250,
            gain: 0,
          })
          this.nodes.midNode = new BiquadFilterNode(context, {
            type: 'peaking',
            frequency: 1000,
            Q: 1,
            gain: 0,
          })
          this.nodes.trebleNode = new BiquadFilterNode(context, {
            type: 'highshelf',
            frequency: 3500,
            gain: 0,
          })
          this.nodes.outputMeterNode = new AnalyserNode(context, { fftSize: 2048 })

          // Dummy element source (Emscripten requirement; signal is silence).
          const audioElement = this.nodes.audioElement
          if (!audioElement) throw new Error('Audio element missing during WASM callback')
          this.nodes.sourceNode = context.createMediaElementSource(audioElement)

          // Wire input side:
          // dummy → gateGain (silent, so no effect)
          this.nodes.sourceNode.connect(this.nodes.gateGainNode!)
          // gate chain: [liveSrc] → gateAnalyser → gateGain → inputGain → inputMeter
          this.nodes.gateAnalyserNode!.connect(this.nodes.gateGainNode!)
          this.nodes.gateGainNode!.connect(this.nodes.inputGainNode!)
          this.nodes.inputGainNode!.connect(this.nodes.inputMeterNode!)
          // bypass path: inputMeter → bypass → outputGain
          this.nodes.inputMeterNode!.connect(this.nodes.bypassNode!)
          this.nodes.bypassNode!.connect(this.nodes.outputGainNode!)
          // NAM path: inputMeter → worklet → outputGain
          this.nodes.inputMeterNode!.connect(workletNode)
          workletNode.connect(this.nodes.outputGainNode!)
          // Wire output side: outputGain → bass → mid → treble → outputMeter
          this.nodes.outputGainNode!.connect(this.nodes.bassNode!)
          this.nodes.bassNode!.connect(this.nodes.midNode!)
          this.nodes.midNode!.connect(this.nodes.trebleNode!)
          this.nodes.trebleNode!.connect(this.nodes.outputMeterNode!)

          void context.resume()
          resolve()
        }
      })

      await loadWasmScript()

      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.src = SILENT_WAV
      this.nodes.audioElement = audio
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('loadeddata', () => resolve(), { once: true })
        audio.addEventListener('error', () => reject(new Error('Failed to load silent audio')), {
          once: true,
        })
        audio.load()
      })

      await this.loadModelInternal(modelUrl)
      await audioReady

      // Clear one-time init callback.
      window.wasmAudioWorkletCreated = undefined

      this.initialized = true
      this.modelUrl = modelUrl
    } catch (error) {
      await this.destroy()
      throw error
    } finally {
      this.initializing = false
    }
  }

  // ─── Live-input management ────────────────────────────────────────────────

  async connectInput(deviceId: string): Promise<void> {
    if (!this.isAudioReady()) throw new Error('NAM not initialized')
    this.disconnectInput()

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    const context = this.nodes.audioContext!
    this.nodes.mediaStream = stream
    // Connect: liveSource → gateAnalyser (the gate wires gateAnalyser → gateGain already)
    this.nodes.liveSourceNode = context.createMediaStreamSource(stream)
    this.nodes.liveSourceNode.connect(this.nodes.gateAnalyserNode!)

    if (context.state === 'suspended') await context.resume()
    this.startGatePoll()
  }

  async suspend(): Promise<void> {
    this.stopGatePoll()
    this.disconnectInput()
    const ctx = this.nodes.audioContext
    if (ctx && ctx.state === 'running') await ctx.suspend()
  }

  async resume(deviceId: string): Promise<void> {
    if (!this.isAudioReady()) throw new Error('NAM not initialized')
    await this.connectInput(deviceId)
  }

  // ─── Model ────────────────────────────────────────────────────────────────

  async loadModel(modelUrl: string): Promise<void> {
    if (!this.initialized) throw new Error('NAM audio not initialized')
    if (this.modelUrl === modelUrl) return
    await this.loadModelInternal(modelUrl)
    this.modelUrl = modelUrl
  }

  // ─── Gain controls ────────────────────────────────────────────────────────

  setInputGain(gain: number): void {
    const node = this.nodes.inputGainNode
    if (!node || !this.nodes.audioContext) return
    node.gain.setTargetAtTime(gain, this.nodes.audioContext.currentTime, 0.005)
  }

  setOutputLevel(gain: number): void {
    const node = this.nodes.outputGainNode
    if (!node || !this.nodes.audioContext) return
    node.gain.setTargetAtTime(gain, this.nodes.audioContext.currentTime, 0.005)
  }

  // ─── Noise gate ───────────────────────────────────────────────────────────

  setNoiseGateThreshold(db: number): void {
    this.gateThresholdDb = db
  }

  setNoiseGateActive(active: boolean): void {
    this.gateActive = active
    if (!active) {
      // Open gate immediately when disabled.
      const ctx = this.nodes.audioContext
      const gateGain = this.nodes.gateGainNode
      if (ctx && gateGain) gateGain.gain.setTargetAtTime(1, ctx.currentTime, 0.002)
      this.gateOpen = true
    }
  }

  // ─── Tone stack ───────────────────────────────────────────────────────────

  setBass(gainDb: number): void {
    const node = this.nodes.bassNode
    if (!node || !this.nodes.audioContext) return
    node.gain.setTargetAtTime(gainDb, this.nodes.audioContext.currentTime, 0.005)
  }

  setMid(gainDb: number): void {
    const node = this.nodes.midNode
    if (!node || !this.nodes.audioContext) return
    node.gain.setTargetAtTime(gainDb, this.nodes.audioContext.currentTime, 0.005)
  }

  setTreble(gainDb: number): void {
    const node = this.nodes.trebleNode
    if (!node || !this.nodes.audioContext) return
    node.gain.setTargetAtTime(gainDb, this.nodes.audioContext.currentTime, 0.005)
  }

  setEqActive(active: boolean): void {
    // Setting all filter gains to 0 makes them transparent (passthrough).
    const gain = active ? undefined : 0
    const ctx = this.nodes.audioContext
    if (!ctx) return
    const t = ctx.currentTime
    if (gain === 0) {
      this.nodes.bassNode?.gain.setTargetAtTime(0, t, 0.005)
      this.nodes.midNode?.gain.setTargetAtTime(0, t, 0.005)
      this.nodes.trebleNode?.gain.setTargetAtTime(0, t, 0.005)
    }
    // When re-enabling, callers must re-apply the knob values via setBass/Mid/Treble.
  }

  // ─── Bypass ───────────────────────────────────────────────────────────────

  setBypass(bypassed: boolean): void {
    if (!this.isAudioReady()) return
    const { audioWorkletNode, audioContext, bypassNode, outputGainNode } = this.nodes
    if (!audioWorkletNode || !audioContext || !bypassNode || !outputGainNode) return

    const currentlyBypassed = bypassNode.gain.value > 0.5
    if (currentlyBypassed === bypassed) return

    if (bypassed) {
      audioWorkletNode.disconnect(outputGainNode)
      bypassNode.gain.setTargetAtTime(1, audioContext.currentTime, 0.002)
    } else {
      audioWorkletNode.connect(outputGainNode)
      bypassNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.002)
    }
  }

  // ─── Chain access ─────────────────────────────────────────────────────────

  getAudioContext(): AudioContext {
    if (!this.nodes.audioContext) throw new Error('NAM audio context is not ready')
    return this.nodes.audioContext
  }

  getChainInput(): globalThis.AudioNode {
    if (!this.nodes.gateAnalyserNode) throw new Error('NAM chain input is not ready')
    return this.nodes.gateAnalyserNode
  }

  getChainTail(): globalThis.AudioNode {
    if (!this.nodes.outputMeterNode) throw new Error('NAM chain tail is not ready')
    return this.nodes.outputMeterNode
  }

  // ─── Full teardown ────────────────────────────────────────────────────────

  async destroy(): Promise<void> {
    window.wasmAudioWorkletCreated = undefined
    this.stopGatePoll()
    this.disconnectInput()

    const { audioContext } = this.nodes
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close()
    }

    this.nodes = { ...EMPTY_NAM_AUDIO_NODES }
    this.initialized = false
    this.modelUrl = null
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private isAudioReady(): boolean {
    return Boolean(this.nodes.audioContext && this.nodes.audioWorkletNode)
  }

  private disconnectInput(): void {
    if (this.nodes.liveSourceNode) {
      this.nodes.liveSourceNode.disconnect()
      this.nodes.liveSourceNode = null
    }
    if (this.nodes.mediaStream) {
      this.nodes.mediaStream.getTracks().forEach((t) => t.stop())
      this.nodes.mediaStream = null
    }
  }

  // ─── Noise gate polling ───────────────────────────────────────────────────

  private startGatePoll(): void {
    this.stopGatePoll()
    this.gatePollHandle = window.setInterval(() => this.tickGate(), 16)
  }

  private stopGatePoll(): void {
    if (this.gatePollHandle !== null) {
      clearInterval(this.gatePollHandle)
      this.gatePollHandle = null
    }
  }

  private tickGate(): void {
    // Gate is considered "off" when threshold is at the floor (−80 dB).
    if (!this.gateActive || this.gateThresholdDb <= -80) {
      if (!this.gateOpen) {
        const ctx = this.nodes.audioContext
        const gateGain = this.nodes.gateGainNode
        if (ctx && gateGain) gateGain.gain.setTargetAtTime(1, ctx.currentTime, 0.002)
        this.gateOpen = true
      }
      return
    }
    const { gateAnalyserNode, gateGainNode, audioContext } = this.nodes
    if (!gateAnalyserNode || !gateGainNode || !audioContext) return

    const buf = new Float32Array(gateAnalyserNode.fftSize)
    gateAnalyserNode.getFloatTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!
    const rmsDb = 20 * Math.log10(Math.max(Math.sqrt(sum / buf.length), 1e-10))

    const shouldOpen = rmsDb > this.gateThresholdDb
    if (shouldOpen === this.gateOpen) return

    this.gateOpen = shouldOpen
    const t = audioContext.currentTime
    // Fast attack (1 ms), slower release (80 ms) to avoid click artefacts.
    gateGainNode.gain.setTargetAtTime(shouldOpen ? 1 : 0, t, shouldOpen ? 0.001 : 0.08)
  }

  // ─── Model loading ────────────────────────────────────────────────────────

  private async loadModelInternal(modelUrl: string, forceA2Nano = false): Promise<void> {
    const response = await fetch(modelUrl)
    if (!response.ok) throw new Error(`Failed to fetch model: ${response.statusText}`)

    const blob = await response.blob()
    const file = new File([blob], 'profile.nam', { type: '.nam' })
    const jsonStr = await readModel(file)
    if (!jsonStr) throw new Error('Failed to read .nam model')

    const module = await loadWasmModule()
    const byteLength = new TextEncoder().encode(jsonStr).length + 1

    const maxAttempts = 3
    let lastError: unknown

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const ptr = module._malloc(byteLength)
        module.stringToUTF8(jsonStr, ptr, byteLength)
        try {
          const ctx = this.nodes.audioContext
          if (ctx?.state === 'running') await ctx.suspend()
          await module.ccall('setDsp', null, ['number', 'number'], [ptr, forceA2Nano ? 1 : 0], {
            async: true,
          })
          module._free(ptr)
          if (ctx?.state === 'suspended') await ctx.resume()
          return
        } catch (error) {
          module._free(ptr)
          throw error
        }
      } catch (error) {
        lastError = error
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
        }
      }
    }

    throw lastError
  }
}
