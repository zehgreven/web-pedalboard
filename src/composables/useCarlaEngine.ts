/**
 * useCarlaEngine — Vue composable for managing the Carla audio host.
 *
 * In Electron mode: native LV2/VST3/VST/LADSPA plugins are processed by
 * Carla running in a JACK/PipeWire chain.  Audio flow:
 *
 *   Guitar → Carla (pw-jack) → [Plugin1 → Plugin2 → …] → Speakers
 *
 * In browser mode: this composable is a no-op (returns unavailable).
 */
import { ref, readonly, onUnmounted } from 'vue'
import type { AudioNode, PluginAudioNode } from '@/types/audio'

// ─── Types ────────────────────────────────────────────────────────────────────
export type CarlaEngineStatus = 'unavailable' | 'stopped' | 'starting' | 'running' | 'error'

// ─── Module-level singletons (shared across composable instances) ─────────────
const isElectron     = typeof window !== 'undefined' && !!window.electronAPI
const available      = ref(false)
const status         = ref<CarlaEngineStatus>('unavailable')
const lastError      = ref('')
/** nodeId → Carla rack index  */
const nodeToCarlaIdx = ref<Record<string, number>>({})

let statusUnsubscribe: (() => void) | null = null

if (isElectron) {
  window.electronAPI!.carla.available().then((ok) => {
    available.value = ok
    status.value    = ok ? 'stopped' : 'unavailable'
  })

  statusUnsubscribe = window.electronAPI!.carla.onStatusChanged(({ status: s, error: e }) => {
    status.value    = s as CarlaEngineStatus
    lastError.value = e ?? ''
  })
}

// ─── Composable function ──────────────────────────────────────────────────────
export function useCarlaEngine() {
  // Nothing to clean up per-instance (singleton state is global)
  onUnmounted(() => { /* intentionally empty */ })

  // ── LV2 URI helper ──────────────────────────────────────────────────────────

  async function lv2UriFor(bundlePath: string): Promise<string | null> {
    return window.electronAPI!.carla.getLv2Uri(bundlePath)
  }

  // ── Node → CarlaPluginSpec mapping ─────────────────────────────────────────

  async function nodeToSpec(node: PluginAudioNode): Promise<CarlaPluginSpec | null> {
    switch (node.format) {
      case 'lv2': {
        const uri = await lv2UriFor(node.pluginPath)
        if (!uri) return null
        return { pluginType: 'lv2', binary: '', name: node.pluginName, label: uri }
      }
      case 'vst3':
        return { pluginType: 'vst3', binary: node.pluginPath, name: node.pluginName, label: '' }
      case 'vst':
        return { pluginType: 'vst2', binary: node.pluginPath, name: node.pluginName, label: '' }
      case 'ladspa':
        return { pluginType: 'ladspa', binary: node.pluginPath, name: node.pluginName, label: node.pluginName }
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Start Carla with all enabled native-plugin nodes from the chain. */
  async function startCarla(nodes: AudioNode[]): Promise<{ ok: boolean; error?: string }> {
    if (!isElectron || !available.value) {
      return { ok: false, error: 'Carla not available in this environment' }
    }

    status.value    = 'starting'
    lastError.value = ''

    const pluginNodes = nodes.filter(
      (n): n is PluginAudioNode => n.type === 'plugin' && n.enabled,
    )
    if (pluginNodes.length === 0) {
      status.value = 'stopped'
      return { ok: false, error: 'No native plugins in chain' }
    }

    // Build ordered spec list, skipping nodes whose URI cannot be resolved
    const ordered: Array<{ nodeId: string; spec: CarlaPluginSpec }> = []
    for (const node of pluginNodes) {
      const spec = await nodeToSpec(node)
      if (spec) ordered.push({ nodeId: node.id, spec })
      else      console.warn('[useCarlaEngine] Skipping', node.pluginName, '— cannot resolve spec')
    }

    if (ordered.length === 0) {
      status.value = 'stopped'
      return { ok: false, error: 'Could not resolve specs for any native plugin' }
    }

    const result = await window.electronAPI!.carla.start(ordered.map(o => o.spec))

    if (result.ok) {
      const map: Record<string, number> = {}
      ordered.forEach(({ nodeId }, i) => { map[nodeId] = i })
      nodeToCarlaIdx.value = map
      status.value         = 'running'
    } else {
      status.value    = 'error'
      lastError.value = result.error ?? 'Unknown error'
    }

    return result
  }

  /** Stop Carla and clear the plugin index map. */
  async function stopCarla(): Promise<void> {
    if (!isElectron) return
    await window.electronAPI!.carla.stop()
    nodeToCarlaIdx.value = {}
    status.value         = 'stopped'
    lastError.value      = ''
  }

  /** Update a plugin parameter in real-time (by node.id + Carla param index). */
  async function setParam(nodeId: string, paramId: number, value: number): Promise<void> {
    if (!isElectron || status.value !== 'running') return
    const carlaId = nodeToCarlaIdx.value[nodeId]
    if (carlaId === undefined) return
    await window.electronAPI!.carla.setParam(carlaId, paramId, value)
  }

  /** Enable or bypass a plugin in Carla by node.id. */
  async function setNodeActive(nodeId: string, active: boolean): Promise<void> {
    if (!isElectron || status.value !== 'running') return
    const carlaId = nodeToCarlaIdx.value[nodeId]
    if (carlaId === undefined) return
    await window.electronAPI!.carla.setActive(carlaId, active)
  }

  /** Fetch the live parameter list for a plugin (used to populate the UI modal). */
  async function fetchParams(nodeId: string): Promise<CarlaParam[]> {
    if (!isElectron || status.value !== 'running') return []
    const carlaId = nodeToCarlaIdx.value[nodeId]
    if (carlaId === undefined) return []
    return window.electronAPI!.carla.getParams(carlaId)
  }

  /** Returns -1 if the node is not loaded in Carla, otherwise its rack index. */
  function carlaRackIndex(nodeId: string): number {
    return nodeToCarlaIdx.value[nodeId] ?? -1
  }

  return {
    carlaAvailable: readonly(available),
    carlaStatus:    readonly(status),
    carlaError:     readonly(lastError),
    startCarla,
    stopCarla,
    setParam,
    setNodeActive,
    fetchParams,
    carlaRackIndex,
  }
}
