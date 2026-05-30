import { IrLoader } from '@/audio/effects/IrLoader'
import { buildChainPlan } from '@/audio/engine/chainPlan'
import { NamAudioGraph } from '@/nam/NamAudioGraph'
import type { AudioNode as PedalboardNode } from '@/types/audio'

/**
 * Builds and runs the pedalboard signal chain in store order.
 * INPUT → [effects…] → OUTPUT
 *
 * Lifecycle:
 *   start() → wires the full chain and connects the microphone
 *   stop()  → disconnects the mic and suspends audio (graph stays wired)
 *   start() → reconnects the mic and resumes audio
 *
 * The NamAudioGraph is preserved across Stop/Start cycles; it is only destroyed
 * when the chain order changes or the effect is removed.
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
  private running = false

  get isRunning(): boolean {
    return this.running
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

    const order = nodes.map((n) => n.id).join(',')
    const namNode = nodes.find((n) => n.type === 'nam')
    const newModelUrl = namNode?.type === 'nam' ? (namNode.model?.url ?? null) : null
    const chainNeedsRebuild =
      order !== this.orderSignature ||
      (this.namGraph !== null && newModelUrl !== this.namGraph.loadedModelUrl) ||
      (this.namGraph === null && newModelUrl !== null)

    if (chainNeedsRebuild) {
      await this.destroyChain()
      await this.buildChain(nodes)
    } else {
      // Reuse existing graph — just reconnect the mic.
      await this.reconnectInputs(nodes)
    }

    this.running = true
  }

  async sync(nodes: PedalboardNode[]): Promise<void> {
    if (!this.running) return

    const order = nodes.map((n) => n.id).join(',')
    if (order !== this.orderSignature) {
      // Order changed: full rebuild.
      const { inputDeviceId, outputDeviceId } = this
      await this.destroyChain()
      await this.buildChain(nodes)
      await this.reconnectInputs(nodes)
      this.inputDeviceId = inputDeviceId
      this.outputDeviceId = outputDeviceId
      this.running = true
      return
    }

    for (const node of nodes) {
      if (node.type === 'nam' && this.namGraph) {
        this.namGraph.setBypass(!node.enabled)
        this.namGraph.setInputGain(node.inputGain / 50)
        this.namGraph.setOutputLevel(node.outputLevel / 50)
        this.namGraph.setNoiseGateThreshold((node.noiseGateThreshold / 100) * 80 - 80)
        this.namGraph.setNoiseGateActive(node.noiseGateActive)
        if (node.eqActive) {
          this.namGraph.setBass(((node.bass - 50) / 50) * 12)
          this.namGraph.setMid(((node.mid - 50) / 50) * 12)
          this.namGraph.setTreble(((node.treble - 50) / 50) * 12)
        } else {
          this.namGraph.setEqActive(false)
        }
        if (node.model?.url) await this.namGraph.loadModel(node.model.url)
      }
      if (node.type === 'ir') {
        const ir = this.irLoaders.get(node.id)
        if (ir) {
          ir.setBypass(!node.enabled)
          ir.setLevel(node.level / 50)
          if (node.ir?.url) await ir.load(node.ir.url)
        }
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false

    // Disconnect the mic but keep the graph wired so the next Start is fast.
    this.disconnectLiveInput()

    if (this.namGraph) {
      await this.namGraph.suspend()
    } else if (this.context && this.context.state !== 'closed') {
      await this.context.suspend()
    }
  }

  /** Full teardown — call when the component is destroyed. */
  async destroy(): Promise<void> {
    this.running = false
    this.disconnectLiveInput()
    await this.destroyChain()
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async buildChain(nodes: PedalboardNode[]): Promise<void> {
    const plan = buildChainPlan(nodes)
    const namInChain = nodes.some((n) => n.type === 'nam')

    if (namInChain && plan.missingNamModel) {
      throw new Error('Load a .nam file on the NAM Capture before starting')
    }

    if (plan.segments.length === 0) {
      await this.buildPassthrough()
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

    if (!this.context) throw new Error('Audio context failed to initialize')

    let head: globalThis.AudioNode | null = null
    let tail: globalThis.AudioNode | null = null

    for (const segment of plan.segments) {
      const node = nodes.find((n) => n.id === segment.nodeId)
      if (!node) continue

      if (segment.type === 'nam' && this.namGraph) {
        this.namGraph.setBypass(!node.enabled)
        this.namGraph.setInputGain(node.inputGain / 50)
        this.namGraph.setOutputLevel(node.outputLevel / 50)
        this.namGraph.setNoiseGateThreshold((node.noiseGateThreshold / 100) * 80 - 80)
        this.namGraph.setNoiseGateActive(node.noiseGateActive)
        if (node.eqActive) {
          this.namGraph.setBass(((node.bass - 50) / 50) * 12)
          this.namGraph.setMid(((node.mid - 50) / 50) * 12)
          this.namGraph.setTreble(((node.treble - 50) / 50) * 12)
        }
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
        ir.setLevel(node.level / 50)
        this.irLoaders.set(node.id, ir)

        const input = ir.getInput()
        const output = ir.getOutput()
        if (!head) head = input
        if (tail) tail.connect(input)
        tail = output
      }
    }

    if (!head || !tail) throw new Error('Signal chain failed to wire')

    tail.connect(this.context.destination)
    await this.setOutputDevice(this.outputDeviceId)

    this.orderSignature = nodes.map((n) => n.id).join(',')
  }

  private async reconnectInputs(nodes: PedalboardNode[]): Promise<void> {
    const head = this.getChainHead(nodes)
    if (!head) return

    if (this.namGraph) {
      await this.namGraph.resume(this.inputDeviceId)
    } else if (this.context) {
      await this.connectLiveInputPassthrough(head)
    }
  }

  private getChainHead(nodes: PedalboardNode[]): globalThis.AudioNode | null {
    if (this.namGraph) return this.namGraph.getChainInput() // gateAnalyserNode

    const firstNode = nodes.find((n) => this.irLoaders.has(n.id))
    if (firstNode) return this.irLoaders.get(firstNode.id)!.getInput()

    // Passthrough: the gain node connected to destination.
    return this.context ? (this.context.destination as unknown as globalThis.AudioNode) : null
  }

  private async buildPassthrough(): Promise<void> {
    this.context = new AudioContext()
    const gain = this.context.createGain()
    gain.connect(this.context.destination)
    await this.setOutputDevice(this.outputDeviceId)
  }

  private async connectLiveInputPassthrough(head: globalThis.AudioNode): Promise<void> {
    if (!this.context) return

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.inputDeviceId ? { exact: this.inputDeviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    this.sourceNode = this.context.createMediaStreamSource(this.stream)
    this.sourceNode.connect(head)

    if (this.context.state === 'suspended') await this.context.resume()
  }

  private disconnectLiveInput(): void {
    this.sourceNode?.disconnect()
    this.sourceNode = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }

  private async destroyChain(): Promise<void> {
    this.disconnectLiveInput()

    for (const ir of this.irLoaders.values()) ir.dispose()
    this.irLoaders.clear()

    if (this.namGraph) {
      await this.namGraph.destroy()
      this.namGraph = null
      this.context = null
    } else if (this.context && this.context.state !== 'closed') {
      await this.context.close()
      this.context = null
    }

    this.orderSignature = ''
  }

  private async setOutputDevice(deviceId: string | undefined): Promise<void> {
    if (!this.context || !deviceId) return
    const ctx = this.context as AudioContext & { setSinkId?: (id: string) => Promise<void> }
    if (typeof ctx.setSinkId === 'function') await ctx.setSinkId(deviceId)
  }
}
