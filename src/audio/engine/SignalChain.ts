import { IrLoader } from '@/audio/effects/IrLoader'
import { buildChainPlan } from '@/audio/engine/chainPlan'
import { NamAudioGraph } from '@/nam/NamAudioGraph'
import type { AudioNode as PedalboardNode } from '@/types/audio'

/**
 * Builds and runs the pedalboard signal chain in store order.
 * INPUT → [effects…] → OUTPUT
 */
export class SignalChain {
  private namGraph: NamAudioGraph | null = null
  private irLoaders = new Map<string, IrLoader>()
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private orderSignature = ''
  private inputDeviceId = ''
  private outputDeviceId: string | undefined

  get isRunning(): boolean {
    return this.context !== null
  }

  get usesNam(): boolean {
    return this.namGraph !== null
  }

  async start(
    inputDeviceId: string,
    outputDeviceId: string | undefined,
    nodes: PedalboardNode[],
  ): Promise<void> {
    this.inputDeviceId = inputDeviceId
    this.outputDeviceId = outputDeviceId
    await this.rebuild(nodes)
  }

  async sync(nodes: PedalboardNode[]): Promise<void> {
    if (!this.isRunning) return

    const order = nodes.map((n) => n.id).join(',')
    if (order !== this.orderSignature) {
      await this.rebuild(nodes)
      return
    }

    for (const node of nodes) {
      if (node.type === 'nam' && this.namGraph) {
        this.namGraph.setBypass(!node.enabled)
        if (node.model?.url) {
          await this.namGraph.loadModel(node.model.url)
        }
      }

      if (node.type === 'ir') {
        const ir = this.irLoaders.get(node.id)
        if (!ir) continue
        ir.setBypass(!node.enabled)
        if (node.ir?.url) {
          await ir.load(node.ir.url)
        }
      }
    }
  }

  async stop(): Promise<void> {
    this.sourceNode?.disconnect()
    this.sourceNode = null

    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null

    for (const ir of this.irLoaders.values()) {
      ir.dispose()
    }
    this.irLoaders.clear()

    const namGraph = this.namGraph
    const passthroughContext = this.namGraph ? null : this.context

    this.namGraph = null
    this.context = null
    this.orderSignature = ''

    if (namGraph) {
      await namGraph.stop()
    } else if (passthroughContext && passthroughContext.state !== 'closed') {
      await passthroughContext.close()
    }
  }

  private async rebuild(nodes: PedalboardNode[]): Promise<void> {
    const plan = buildChainPlan(nodes)
    const namInChain = nodes.some((n) => n.type === 'nam')

    if (namInChain && plan.missingNamModel) {
      throw new Error('Load a .nam file on the NAM Capture before starting')
    }

    await this.stop()

    if (plan.segments.length === 0) {
      await this.startPassthrough(this.inputDeviceId, this.outputDeviceId)
      this.orderSignature = nodes.map((n) => n.id).join(',')
      return
    }

    if (plan.namModelUrl) {
      this.namGraph = new NamAudioGraph()
      await this.namGraph.init(plan.namModelUrl)
      this.context = this.namGraph.getAudioContext()
    } else {
      this.context = new AudioContext()
    }

    if (!this.context) {
      throw new Error('Audio context failed to initialize')
    }

    let head: globalThis.AudioNode | null = null
    let tail: globalThis.AudioNode | null = null

    for (const segment of plan.segments) {
      const node = nodes.find((n) => n.id === segment.nodeId)
      if (!node) continue

      if (segment.type === 'nam' && this.namGraph) {
        this.namGraph.setBypass(!node.enabled)
        const input = this.namGraph.getChainInput()
        const output = this.namGraph.getChainTail()
        if (!head) head = input
        if (tail) tail.connect(input)
        tail = output
        continue
      }

      if (segment.type === 'ir' && node.type === 'ir' && node.ir?.url) {
        const ir = new IrLoader(this.context)
        await ir.load(node.ir.url)
        ir.setBypass(!node.enabled)
        this.irLoaders.set(node.id, ir)

        const input = ir.getInput()
        const output = ir.getOutput()
        if (!head) head = input
        if (tail) tail.connect(input)
        tail = output
      }
    }

    if (!head || !tail) {
      throw new Error('Signal chain failed to wire')
    }

    tail.connect(this.context.destination)
    await this.setOutputDevice(this.outputDeviceId)
    await this.connectLiveInput(this.inputDeviceId, head)

    this.orderSignature = nodes.map((n) => n.id).join(',')
  }

  private async startPassthrough(
    inputDeviceId: string,
    outputDeviceId: string | undefined,
  ): Promise<void> {
    this.context = new AudioContext()
    const gain = this.context.createGain()
    gain.connect(this.context.destination)

    await this.setOutputDevice(outputDeviceId)
    await this.connectLiveInput(inputDeviceId, gain)
  }

  private async connectLiveInput(deviceId: string, head: globalThis.AudioNode): Promise<void> {
    if (!this.context) return

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    this.sourceNode = this.context.createMediaStreamSource(this.stream)
    this.sourceNode.connect(head)

    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  private async setOutputDevice(deviceId: string | undefined): Promise<void> {
    if (!this.context || !deviceId) return

    const ctx = this.context as AudioContext & {
      setSinkId?: (sinkId: string) => Promise<void>
    }
    if (typeof ctx.setSinkId === 'function') {
      await ctx.setSinkId(deviceId)
    }
  }
}
