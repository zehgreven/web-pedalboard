/**
 * AudioEngine bootstraps the Web Audio API context and manages
 * the top-level signal chain.
 */
export class AudioEngine {
  private context: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null

  async start(inputDeviceId: string): Promise<void> {
    this.context = new AudioContext()

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: inputDeviceId ? { exact: inputDeviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    this.sourceNode = this.context.createMediaStreamSource(this.stream)
    this.sourceNode.connect(this.context.destination)
  }

  stop(): void {
    this.sourceNode?.disconnect()
    this.sourceNode = null

    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null

    this.context?.close()
    this.context = null
  }

  get isRunning(): boolean {
    return this.context !== null
  }

  getContext(): AudioContext {
    if (!this.context) throw new Error('AudioEngine not started')
    return this.context
  }
}
