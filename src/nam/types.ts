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
  inputGainNode: GainNode | null
  outputGainNode: GainNode | null
  bypassNode: GainNode | null
  inputMeterNode: AnalyserNode | null
  outputMeterNode: AnalyserNode | null
}

export const EMPTY_NAM_AUDIO_NODES: NamAudioNodes = {
  audioContext: null,
  audioWorkletNode: null,
  audioElement: null,
  sourceNode: null,
  liveSourceNode: null,
  mediaStream: null,
  inputGainNode: null,
  outputGainNode: null,
  bypassNode: null,
  inputMeterNode: null,
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
