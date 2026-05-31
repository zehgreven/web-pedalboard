// .cts = CommonJS TypeScript → compiled to .cjs by tsc.
// Manages the carla-bridge.py subprocess and routes PipeWire/JACK ports.
import { ChildProcessWithoutNullStreams, spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'

const execFileAsync = promisify(execFile)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CarlaPluginSpec {
  pluginType: 'lv2' | 'vst3' | 'vst2' | 'vst' | 'ladspa'
  binary: string
  name: string
  label: string
  uniqueId?: number
}

export interface CarlaParam {
  id: number
  name: string
  symbol: string
  unit: string
  value: number
  min: number
  max: number
  default: number
}

export type CarlaStatus = 'stopped' | 'starting' | 'running' | 'error'

interface BridgeMessage {
  type: 'ready' | 'reply' | 'error'
  id?: number
  data?: Record<string, unknown>
  error?: string
  message?: string
}

// ─── CarlaHost ────────────────────────────────────────────────────────────────

export class CarlaHost {
  private proc: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<number, (msg: BridgeMessage) => void>()
  private nextId = 1
  private _status: CarlaStatus = 'stopped'
  private _lastError = ''
  private _onStatus?: (s: CarlaStatus, err?: string) => void

  private readonly bridgeScript = path.join(__dirname, 'carla-bridge.py')
  private readonly python = this.findBin(['python3', 'python']) ?? 'python3'
  private readonly pwjack  = this.findBin(['pw-jack'])
  private readonly pwlink  = this.findBin(['pw-link', 'jack_connect'])

  // -- public surface ---------------------------------------------------------

  get status(): CarlaStatus { return this._status }
  get lastError(): string   { return this._lastError }
  get isRunning(): boolean  { return this._status === 'running' }

  onStatus(cb: (s: CarlaStatus, err?: string) => void): void {
    this._onStatus = cb
  }

  /** Detect whether Carla bridge dependencies are available. */
  isAvailable(): boolean {
    return (
      fs.existsSync(this.bridgeScript) &&
      fs.existsSync('/usr/lib/carla/libcarla_standalone2.so') &&
      !!this.findBin(['python3', 'python'])
    )
  }

  /** Start Carla engine, load plugins in order, route PipeWire. */
  async start(
    plugins: CarlaPluginSpec[],
    driver  = 'JACK',
    device  = '',
    bufferSize = 256,
    sampleRate = 44100,
  ): Promise<{ ok: boolean; error?: string }> {
    if (this.proc) await this.stop()

    if (!this.isAvailable()) {
      return { ok: false, error: 'Carla bridge not available (missing libcarla_standalone2.so or python3)' }
    }

    this.setStatus('starting')

    // Wrap with pw-jack so PipeWire handles JACK I/O without a running jackd
    const [cmd, args] = this.pwjack
      ? [this.pwjack, [this.python, this.bridgeScript]]
      : [this.python, [this.bridgeScript]]

    this.proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })

    // Wire stdout → message parser
    let lineBuffer = ''
    this.proc.stdout.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString()
      let nl: number
      while ((nl = lineBuffer.indexOf('\n')) !== -1) {
        const line = lineBuffer.slice(0, nl).trim()
        lineBuffer  = lineBuffer.slice(nl + 1)
        if (!line) continue
        try {
          const msg = JSON.parse(line) as BridgeMessage
          if (msg.type === 'reply' && msg.id != null) {
            this.pending.get(msg.id)?.(msg)
            this.pending.delete(msg.id)
          } else if (msg.type === 'error') {
            console.error('[carla-bridge]', msg.message ?? msg.error)
          }
        } catch { /* ignore non-JSON lines */ }
      }
    })

    this.proc.stderr.on('data', (d: Buffer) =>
      console.error('[carla-bridge stderr]', d.toString().trim())
    )

    // Wait for 'ready' signal with a timeout
    const ready = await this.waitReady()
    if (!ready) {
      this.proc?.kill()
      this.proc = null
      return this.fail('Carla bridge timed out on startup')
    }

    // Initialize engine
    const init = await this.rpc({ type: 'init', driver, device, bufferSize, sampleRate })
    if (!init.data?.ok) {
      const msg = init.error ?? 'Engine init failed'
      this.proc?.kill()
      this.proc = null
      return this.fail(msg)
    }

    // Load plugins in order
    const pluginIds: number[] = []
    for (const spec of plugins) {
      const r = await this.rpc({ type: 'add_plugin', ...spec })
      if (r.error) {
        console.warn('[carla-host] Failed to add plugin:', spec.name, r.error)
        pluginIds.push(-1)
      } else {
        pluginIds.push((r.data?.pluginId as number) ?? -1)
      }
    }

    this.setStatus('running')

    // Async: wait for JACK ports, then connect PipeWire
    this.routePorts().catch((e) => console.warn('[carla-host] Port routing:', e))

    this.proc.on('exit', (code) => {
      console.log('[carla-bridge] exited with code', code)
      this.proc = null
      if (this._status !== 'stopped') this.setStatus('stopped')
    })

    return { ok: true }
  }

  async stop(): Promise<void> {
    if (!this.proc) return
    try { await this.rpc({ type: 'shutdown' }) } catch { /* ignore */ }
    this.proc?.kill('SIGTERM')
    this.proc = null
    this.pending.clear()
    this.setStatus('stopped')
  }

  async setParam(pluginId: number, paramId: number, value: number): Promise<void> {
    if (!this.proc) return
    await this.rpc({ type: 'set_param', pluginId, paramId, value })
  }

  async setActive(pluginId: number, active: boolean): Promise<void> {
    if (!this.proc) return
    await this.rpc({ type: 'set_active', pluginId, active })
  }

  async getParams(pluginId: number): Promise<CarlaParam[]> {
    if (!this.proc) return []
    const r = await this.rpc({ type: 'get_params', pluginId })
    return (r.data?.params ?? []) as CarlaParam[]
  }

  // -- internal helpers -------------------------------------------------------

  private setStatus(s: CarlaStatus, err?: string) {
    this._status = s
    if (err) this._lastError = err
    this._onStatus?.(s, err)
  }

  private fail(err: string): { ok: false; error: string } {
    this.setStatus('error', err)
    return { ok: false, error: err }
  }

  /** Wait for the 'ready' line emitted by the Python bridge on startup. */
  private waitReady(timeoutMs = 10_000): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.proc) return resolve(false)
      const t = setTimeout(() => resolve(false), timeoutMs)

      // Re-use stdout handler: inject a one-shot ready listener
      let buf = ''
      const onData = (chunk: Buffer) => {
        buf += chunk.toString()
        if (buf.includes('"type": "ready"') || buf.includes('"type":"ready"')) {
          clearTimeout(t)
          this.proc?.stdout.removeListener('data', onData)
          resolve(true)
        }
      }
      this.proc.stdout.on('data', onData)
      this.proc.once('exit', () => { clearTimeout(t); resolve(false) })
    })
  }

  /** Send a JSON-RPC message to the bridge and await the reply. */
  private rpc(msg: Record<string, unknown>, timeoutMs = 8_000): Promise<BridgeMessage> {
    return new Promise<BridgeMessage>((resolve) => {
      if (!this.proc) return resolve({ type: 'error', message: 'not running' })
      const id = this.nextId++
      const t  = setTimeout(() => {
        this.pending.delete(id)
        resolve({ type: 'error', id, message: 'timeout' })
      }, timeoutMs)

      this.pending.set(id, (reply) => {
        clearTimeout(t)
        resolve(reply)
      })
      this.proc.stdin.write(JSON.stringify({ ...msg, id }) + '\n')
    })
  }

  /** Auto-connect Carla JACK ports to system audio via pw-link / jack_connect. */
  private async routePorts(): Promise<void> {
    if (!this.pwlink) return
    // Give JACK time to register ports
    await new Promise<void>((r) => setTimeout(r, 2000))

    const pairs: [string, string][] = [
      ['system:capture_1',            'GuitarPedalboard:audio-in1'],
      ['system:capture_1',            'GuitarPedalboard:audio-in2'],
      ['GuitarPedalboard:audio-out1', 'system:playback_1'],
      ['GuitarPedalboard:audio-out2', 'system:playback_2'],
    ]

    for (const [src, dst] of pairs) {
      try {
        await execFileAsync(this.pwlink, [src, dst])
        console.log('[carla-host] linked:', src, '→', dst)
      } catch { /* port might not exist yet — skip silently */ }
    }
  }

  private findBin(names: string[]): string | null {
    const dirs = ['/usr/bin', '/usr/local/bin', '/bin']
    for (const name of names) {
      for (const dir of dirs) {
        const full = path.join(dir, name)
        if (fs.existsSync(full)) return full
      }
    }
    return null
  }
}

// Singleton exported for use in main.cts
export const carlaHost = new CarlaHost()
