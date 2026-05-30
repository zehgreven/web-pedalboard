export interface NamWasmModule {
  _malloc: (size: number) => number
  _free: (ptr: number) => void
  stringToUTF8: (str: string, ptr: number, maxBytes: number) => void
  ccall: (
    name: string,
    returnType: string | null,
    argTypes: string[],
    args: unknown[],
    options?: { async?: boolean },
  ) => Promise<unknown>
  runtimeInitialized?: boolean
  wasmMemory?: WebAssembly.Memory
}

export interface NamAudioNodes {
  audioContext: AudioContext | null
  audioWorkletNode: AudioWorkletNode | null
  audioElement: HTMLAudioElement | null
  sourceNode: MediaElementAudioSourceNode | null
  liveSourceNode: MediaStreamAudioSourceNode | null
  mediaStream: MediaStream | null
  /** Measures raw mic level for the noise gate. */
  gateAnalyserNode: AnalyserNode | null
  /** Controlled by NoiseGate to open/close the signal. */
  gateGainNode: GainNode | null
  inputGainNode: GainNode | null
  outputGainNode: GainNode | null
  bypassNode: GainNode | null
  inputMeterNode: AnalyserNode | null
  /** Tone stack — Bass low-shelf filter. */
  bassNode: BiquadFilterNode | null
  /** Tone stack — Mid peaking filter. */
  midNode: BiquadFilterNode | null
  /** Tone stack — Treble high-shelf filter. */
  trebleNode: BiquadFilterNode | null
  outputMeterNode: AnalyserNode | null
}

export const EMPTY_NAM_AUDIO_NODES: NamAudioNodes = {
  audioContext: null,
  audioWorkletNode: null,
  audioElement: null,
  sourceNode: null,
  liveSourceNode: null,
  mediaStream: null,
  gateAnalyserNode: null,
  gateGainNode: null,
  inputGainNode: null,
  outputGainNode: null,
  bypassNode: null,
  inputMeterNode: null,
  bassNode: null,
  midNode: null,
  trebleNode: null,
  outputMeterNode: null,
}

declare global {
  interface Window {
    Module?: NamWasmModule
    wasmAudioWorkletCreated?: (
      workletNode: AudioWorkletNode,
      audioContext: AudioContext,
    ) => void
  }
}
