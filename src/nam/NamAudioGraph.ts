import { readModel } from '@/nam/readModel'
import { loadWasmModule, loadWasmScript } from '@/nam/wasmModule'
import { EMPTY_NAM_AUDIO_NODES, type NamAudioNodes } from '@/nam/types'

/** Minimal silent WAV so the WASM init graph can attach a MediaElementSource. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

const WORKLET_INIT_TIMEOUT_MS = 15_000

/**
 * Lifecycle:
 *   init()         – loads WASM script + calls setDsp once; AudioContext created by WASM
 *   connectInput() – attaches a MediaStream to the processing graph
 *   suspend()      – stops mic tracks, suspends AudioContext (Stop button)
 *   resume()       – re-attaches mic, resumes AudioContext (Start button again)
 *   loadModel()    – hot-swaps the .nam model while running or suspended
 *   destroy()      – closes AudioContext for real (effect removed from board)
 */
export class NamAudioGraph {
  private nodes: NamAudioNodes = { ...EMPTY_NAM_AUDIO_NODES }
  private initialized = false
  private initializing = false
  private modelUrl: string | null = null

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

      // The WASM module calls this global once — when setDsp creates the worklet.
      const audioReady = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error('NAM AudioWorklet failed to initialize')),
          WORKLET_INIT_TIMEOUT_MS,
        )

        window.wasmAudioWorkletCreated = (workletNode, context) => {
          window.clearTimeout(timeout)
          this.nodes.audioWorkletNode = workletNode
          this.nodes.audioContext = context

          this.nodes.inputGainNode = new GainNode(context, { gain: 1 })
          this.nodes.outputGainNode = new GainNode(context, { gain: 1 })
          this.nodes.bypassNode = new GainNode(context, { gain: 0 })

          const meterConfig = { fftSize: 2048 }
          this.nodes.inputMeterNode = new AnalyserNode(context, meterConfig)
          this.nodes.outputMeterNode = new AnalyserNode(context, meterConfig)

          // Dummy media-element source required by the Emscripten graph setup.
          const audioElement = this.nodes.audioElement
          if (!audioElement) {
            throw new Error('Audio element missing during WASM callback')
          }
          this.nodes.sourceNode = context.createMediaElementSource(audioElement)

          const { sourceNode, inputGainNode, inputMeterNode, bypassNode, outputGainNode, outputMeterNode } = this.nodes

          // Internal signal path (mic is connected later via connectInput):
          // [liveSource] → inputGainNode → inputMeterNode ──► workletNode → outputGainNode → outputMeterNode → [tail, wired by SignalChain]
          // bypassNode is a parallel path from inputMeterNode to outputGainNode (bypass when gain=1)
          sourceNode.connect(inputGainNode!)
          inputGainNode!.connect(inputMeterNode!)
          inputMeterNode!.connect(bypassNode!)
          bypassNode!.connect(outputGainNode!)
          inputMeterNode!.connect(workletNode)
          workletNode.connect(outputGainNode!)
          outputGainNode!.connect(outputMeterNode!)

          void context.resume()
          resolve()
        }
      })

      await loadWasmScript()

      // A dummy audio element is needed so Emscripten can create a MediaElementSource.
      // We never play it; the live mic replaces it as the actual signal source.
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.src = SILENT_WAV
      this.nodes.audioElement = audio
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('loadeddata', () => resolve(), { once: true })
        audio.addEventListener('error', () => reject(new Error('Failed to load silent audio')), { once: true })
        audio.load()
      })

      await this.loadModelInternal(modelUrl)
      await audioReady

      // Clear the one-time init callback so subsequent setDsp calls (hot-swap)
      // don't re-run the init logic and corrupt the node graph.
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
    this.nodes.liveSourceNode = context.createMediaStreamSource(stream)
    this.nodes.liveSourceNode.connect(this.nodes.inputGainNode!)

    if (context.state === 'suspended') await context.resume()
  }

  /** Disconnect the mic and suspend the AudioContext. The graph stays wired. */
  async suspend(): Promise<void> {
    this.disconnectInput()
    const ctx = this.nodes.audioContext
    if (ctx && ctx.state === 'running') await ctx.suspend()
  }

  /** Resume the AudioContext and re-attach the mic. */
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

  // ─── Gain controls ───────────────────────────────────────────────────────

  /** Linear gain factor applied before the NAM model (0 = mute, 1 = unity). */
  setInputGain(gain: number): void {
    const node = this.nodes.inputGainNode
    if (!node || !this.nodes.audioContext) return
    node.gain.setTargetAtTime(gain, this.nodes.audioContext.currentTime, 0.005)
  }

  /** Linear gain factor applied after the NAM model (0 = mute, 1 = unity). */
  setOutputLevel(gain: number): void {
    const node = this.nodes.outputGainNode
    if (!node || !this.nodes.audioContext) return
    node.gain.setTargetAtTime(gain, this.nodes.audioContext.currentTime, 0.005)
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
    if (!this.nodes.inputGainNode) throw new Error('NAM chain input is not ready')
    return this.nodes.inputGainNode
  }

  getChainTail(): globalThis.AudioNode {
    if (!this.nodes.outputMeterNode) throw new Error('NAM chain tail is not ready')
    return this.nodes.outputMeterNode
  }

  // ─── Full teardown (effect removed) ──────────────────────────────────────

  async destroy(): Promise<void> {
    window.wasmAudioWorkletCreated = undefined
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

          await module.ccall('setDsp', null, ['number', 'number'], [ptr, forceA2Nano ? 1 : 0], { async: true })
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
