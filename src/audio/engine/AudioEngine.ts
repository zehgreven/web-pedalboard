import { SignalChain } from '@/audio/engine/SignalChain'
import type { AudioNode as PedalboardNode } from '@/types/audio'

/**
 * AudioEngine bootstraps the Web Audio API context and manages
 * the top-level signal chain.
 */
export class AudioEngine {
  private chain = new SignalChain()

  async start(
    inputDeviceId: string,
    outputDeviceId: string | undefined,
    nodes: PedalboardNode[],
  ): Promise<void> {
    await this.chain.start(inputDeviceId, outputDeviceId, nodes)
  }

  async syncChain(nodes: PedalboardNode[]): Promise<void> {
    await this.chain.sync(nodes)
  }

  async stop(): Promise<void> {
    await this.chain.stop()
  }

  /** Full teardown — disconnects mic and closes all AudioContexts. */
  async destroy(): Promise<void> {
    await this.chain.destroy()
  }

  get isRunning(): boolean {
    return this.chain.isRunning
  }

  get isUsingNam(): boolean {
    return this.chain.usesNam
  }
}
