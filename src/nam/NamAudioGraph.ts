import { readModel } from '@/nam/readModel'
import { loadWasmModule, loadWasmScript, resetWasmRuntime } from '@/nam/wasmModule'
import { EMPTY_NAM_AUDIO_NODES, type NamAudioNodes } from '@/nam/types'

/** Minimal silent WAV so the WASM init graph can attach a MediaElementSource. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

const WORKLET_INIT_TIMEOUT_MS = 15_000

/**
 * NAM inference via t3k-wasm-module (Emscripten + AudioWorklet).
 * Ported from tone-3000/neural-amp-modeler-wasm — no React dependency.
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

  async init(modelUrl: string): Promise<void> {
    if (this.initialized || this.initializing) return

    this.initializing = true
    try {
      if (typeof window === 'undefined' || !window.AudioContext || !window.AudioWorklet) {
        throw new Error('AudioWorklet is not supported in this browser')
      }

      const audioReady = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('NAM AudioWorklet failed to initialize'))
        }, WORKLET_INIT_TIMEOUT_MS)

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

          const audioElement = this.nodes.audioElement
          if (!audioElement) {
            throw new Error('Audio element missing during WASM callback')
          }

          this.nodes.sourceNode = context.createMediaElementSource(audioElement)

          const {
            sourceNode,
            inputGainNode,
            inputMeterNode,
            bypassNode,
            outputGainNode,
            outputMeterNode,
          } = this.nodes

          sourceNode.connect(inputGainNode!)
          inputGainNode!.connect(inputMeterNode!)
          inputMeterNode!.connect(bypassNode!)
          bypassNode!.connect(outputGainNode!)
          inputMeterNode!.connect(workletNode)
          workletNode.connect(outputGainNode!)
          outputGainNode!.connect(outputMeterNode!)
          // Chain continues from outputMeterNode — wired by SignalChain.

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
        const onLoad = () => resolve()
        const onError = () => reject(new Error('Failed to load silent audio for NAM init'))
        audio.addEventListener('loadeddata', onLoad, { once: true })
        audio.addEventListener('error', onError, { once: true })
        audio.load()
      })

      await this.loadModelInternal(modelUrl)
      await audioReady

      this.initialized = true
      this.modelUrl = modelUrl
    } catch (error) {
      await this.stop()
      throw error
    } finally {
      this.initializing = false
    }
  }

  getAudioContext(): AudioContext {
    if (!this.nodes.audioContext) {
      throw new Error('NAM audio context is not ready')
    }
    return this.nodes.audioContext
  }

  getChainInput(): AudioNode {
    if (!this.nodes.inputGainNode) {
      throw new Error('NAM chain input is not ready')
    }
    return this.nodes.inputGainNode
  }

  getChainTail(): AudioNode {
    if (!this.nodes.outputMeterNode) {
      throw new Error('NAM chain tail is not ready')
    }
    return this.nodes.outputMeterNode
  }

  async loadModel(modelUrl: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('NAM audio not initialized')
    }
    await this.loadModelInternal(modelUrl)
    this.modelUrl = modelUrl
  }

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

  async stop(): Promise<void> {
    const { audioElement, audioContext } = this.nodes
    audioElement?.pause()

    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close()
    }

    this.nodes = { ...EMPTY_NAM_AUDIO_NODES }
    this.initialized = false
    this.modelUrl = null
    resetWasmRuntime()
  }

  private isAudioReady(): boolean {
    return Boolean(this.nodes.audioContext && this.nodes.audioWorkletNode)
  }

  private async loadModelInternal(modelUrl: string, forceA2Nano = false): Promise<void> {
    const response = await fetch(modelUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.statusText}`)
    }

    const blob = await response.blob()
    const file = new File([blob], 'profile.nam', { type: '.nam' })
    const jsonStr = await readModel(file)
    if (!jsonStr) {
      throw new Error('Failed to read .nam model')
    }

    const module = await loadWasmModule()
    const byteLength = new TextEncoder().encode(jsonStr).length + 1

    const maxAttempts = 3
    let lastError: unknown

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const ptr = module._malloc(byteLength)
        module.stringToUTF8(jsonStr, ptr, byteLength)

        try {
          const context = this.nodes.audioContext
          if (context?.state === 'running') {
            await context.suspend()
          }

          await module.ccall('setDsp', null, ['number', 'number'], [ptr, forceA2Nano ? 1 : 0], {
            async: true,
          })
          module._free(ptr)

          if (context?.state === 'suspended') {
            await context.resume()
          }
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
