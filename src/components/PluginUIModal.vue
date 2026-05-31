<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import type { PluginAudioNode } from '@/types/audio'
import { useCarlaEngine } from '@/composables/useCarlaEngine'

const props = defineProps<{
  node: PluginAudioNode
  formatColor: string
}>()

const emit = defineEmits<{ close: [] }>()

// ─── Keyboard ─────────────────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ─── Carla integration ────────────────────────────────────────────────────────
const { carlaStatus, fetchParams, setParam, carlaRackIndex } = useCarlaEngine()

const isInCarlaChain = computed(
  () => carlaStatus.value === 'running' && carlaRackIndex(props.node.id) >= 0,
)

// ─── Metadata loading ─────────────────────────────────────────────────────────
const isElectron = !!window.electronAPI
const loading = ref(false)
const loadError = ref('')

interface Param {
  id: string
  label: string
  value: number
  default: number
  min: number
  max: number
  unit: string
}

const metaName = ref('')
const metaDescription = ref('')
const params = ref<Param[]>([])

/** True only when params came from actual plugin metadata (not generic fallback). */
const hasRealParams = ref(false)

const GENERIC_PARAMS: Param[] = [
  { id: 'gain',   label: 'Gain',    value: 0,   default: 0,   min: -24, max: 24,  unit: 'dB' },
  { id: 'output', label: 'Output',  value: 0,   default: 0,   min: -24, max: 6,   unit: 'dB' },
  { id: 'mix',    label: 'Dry/Wet', value: 100, default: 100, min: 0,   max: 100, unit: '%'  },
]

function toParam(p: ElectronPluginParam): Param {
  return { id: p.id, label: p.label, value: p.default, default: p.default, min: p.min, max: p.max, unit: p.unit }
}

async function loadMetadata() {
  loading.value   = true
  loadError.value = ''

  // Priority: if Carla is running and this plugin is in its rack → use live params
  if (isInCarlaChain.value) {
    try {
      const carlaParams = await fetchParams(props.node.id)
      if (carlaParams.length > 0) {
        params.value    = carlaParams.map((p) => ({
          id:      String(p.id),
          label:   p.name || p.symbol,
          value:   p.value,
          default: p.default,
          min:     p.min,
          max:     p.max,
          unit:    p.unit,
        }))
        hasRealParams.value = true
        loading.value = false
        return
      }
    } catch { /* fall through */ }
  }

  // Fallback: read params from file metadata (TTL / moduleinfo.json)
  if (!isElectron || !props.node.pluginPath) {
    params.value        = GENERIC_PARAMS.map((p) => ({ ...p }))
    hasRealParams.value = false
    loading.value       = false
    return
  }

  try {
    const meta = await window.electronAPI!.plugin.metadata(props.node.pluginPath, props.node.format)
    if (meta && meta.params.length > 0) {
      metaName.value        = meta.name
      metaDescription.value = meta.description
      params.value          = meta.params.map(toParam)
      hasRealParams.value   = true
    } else {
      params.value        = GENERIC_PARAMS.map((p) => ({ ...p }))
      hasRealParams.value = false
    }
  } catch {
    loadError.value     = 'Could not read plugin metadata.'
    params.value        = GENERIC_PARAMS.map((p) => ({ ...p }))
    hasRealParams.value = false
  } finally {
    loading.value = false
  }
}

// Reload params if Carla status changes (e.g. engine just started)
watch(isInCarlaChain, (inChain) => {
  if (inChain) loadMetadata()
})

onMounted(loadMetadata)

// ─── Native UI launcher ───────────────────────────────────────────────────────
type LaunchState = 'idle' | 'loading' | 'ok' | 'error'
const launchState = ref<LaunchState>('idle')
const launchTool  = ref('')
const launchError = ref('')

/** Formats that support native GUI launch (jalv / carla). */
const canLaunchNative = computed(() =>
  isElectron && (props.node.format === 'lv2' || props.node.format === 'vst3' || props.node.format === 'vst')
)

async function launchNativeUI() {
  if (!isElectron) return
  launchState.value = 'loading'
  launchTool.value  = ''
  launchError.value = ''
  try {
    const result = await window.electronAPI!.plugin.openNativeUI(props.node.pluginPath, props.node.format)
    if (result.launched) {
      launchState.value = 'ok'
      launchTool.value  = result.tool
    } else {
      launchState.value = 'error'
      launchError.value = result.error ?? 'Unknown error'
    }
  } catch (e) {
    launchState.value = 'error'
    launchError.value = String(e)
  }
}

// ─── Controls ─────────────────────────────────────────────────────────────────
function resetParam(param: Param) {
  param.value = param.default
  sendToCarla(param)
}

function resetAll() {
  params.value.forEach((p) => {
    p.value = p.default
    sendToCarla(p)
  })
}

/** Send a parameter change to Carla in real-time (no-op if Carla is not running). */
function sendToCarla(param: Param) {
  if (!isInCarlaChain.value) return
  const paramIdx = parseInt(param.id, 10)
  if (!isNaN(paramIdx)) {
    setParam(props.node.id, paramIdx, param.value)
  }
}

/** Called by the range input's @input event for live updates. */
function onSliderInput(param: Param) {
  sendToCarla(param)
}

function formatValue(p: Param): string {
  const decimals = p.unit === '%' || Math.abs(p.max - p.min) > 10 ? 0 : 2
  return `${p.value.toFixed(decimals)}${p.unit ? ' ' + p.unit : ''}`
}

const FORMAT_LABEL: Record<string, string> = {
  vst3: 'VST3', vst: 'VST', lv2: 'LV2', ladspa: 'LADSPA',
}
</script>

<template>
  <Teleport to="body">
    <div class="plugin-modal-backdrop" @click.self="emit('close')">
      <div class="plugin-modal" role="dialog" :aria-label="`${node.pluginName} UI`">

        <!-- Header -->
        <div class="plugin-modal__header" :style="{ borderTopColor: formatColor }">
          <div class="plugin-modal__title-row">
            <span class="plugin-modal__badge" :style="{ background: formatColor }">
              {{ FORMAT_LABEL[node.format] ?? node.format.toUpperCase() }}
            </span>
            <h2 class="plugin-modal__title">{{ metaName || node.pluginName }}</h2>
          </div>
          <button class="plugin-modal__close" @click="emit('close')" aria-label="Close">✕</button>
        </div>

        <!-- Path info -->
        <div class="plugin-modal__path" :title="node.pluginPath">
          <span class="plugin-modal__path-icon">📁</span>
          <span class="plugin-modal__path-text">{{ node.pluginPath || '(path unknown)' }}</span>
        </div>

        <!-- Description (from metadata) -->
        <p v-if="metaDescription" class="plugin-modal__desc">{{ metaDescription }}</p>

        <!-- Native GUI launcher (Electron only, supported formats) -->
        <div v-if="canLaunchNative" class="plugin-modal__native-ui">
          <button
            class="plugin-modal__launch-btn"
            :class="{ 'plugin-modal__launch-btn--loading': launchState === 'loading' }"
            :disabled="launchState === 'loading'"
            :style="{ '--fmt-color': formatColor }"
            @click="launchNativeUI"
          >
            <span v-if="launchState === 'loading'" class="plugin-modal__spinner" />
            <span v-else class="plugin-modal__launch-icon">⬡</span>
            Launch Native UI
          </button>

          <p v-if="launchState === 'ok'" class="plugin-modal__launch-ok">
            ✓ Opened with <strong>{{ launchTool }}</strong>
          </p>
          <p v-else-if="launchState === 'error'" class="plugin-modal__launch-err">
            ✗ {{ launchError }}
          </p>
          <p v-else class="plugin-modal__launch-hint">
            Opens the plugin's original GUI in a separate native window
          </p>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="plugin-modal__loading">
          <span class="plugin-modal__spinner" />
          Reading plugin metadata…
        </div>

        <!-- Error -->
        <p v-else-if="loadError" class="plugin-modal__error">{{ loadError }}</p>

        <!-- Source badge (real metadata vs generic) -->
        <div v-else-if="!loading" class="plugin-modal__source">
          <span v-if="hasRealParams" class="plugin-modal__source-badge plugin-modal__source-badge--real">
            {{ isInCarlaChain ? '⚡ Live — controls sent to Carla in real-time' : '✓ Real parameters from plugin metadata' }}
          </span>
          <span v-else class="plugin-modal__source-badge plugin-modal__source-badge--generic">
            Generic controls (metadata not available for this format)
          </span>
        </div>

        <!-- Parameter panel -->
        <div v-if="!loading" class="plugin-modal__params">
          <div v-for="param in params" :key="param.id" class="plugin-modal__param">
            <div class="plugin-modal__param-header">
              <label :for="`param-${node.id}-${param.id}`" class="plugin-modal__param-label">
                {{ param.label }}
              </label>
              <span class="plugin-modal__param-value">{{ formatValue(param) }}</span>
              <button class="plugin-modal__param-reset" title="Reset" @click="resetParam(param)">↺</button>
            </div>
            <input
              :id="`param-${node.id}-${param.id}`"
              v-model.number="param.value"
              type="range"
              :min="param.min"
              :max="param.max"
              :step="(param.max - param.min) / 1000"
              class="plugin-modal__slider"
              :class="{ 'plugin-modal__slider--live': isInCarlaChain }"
              :style="{ '--accent-color': formatColor }"
              @input="onSliderInput(param)"
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="plugin-modal__footer">
          <button class="plugin-modal__btn plugin-modal__btn--ghost" @click="resetAll">
            Reset all
          </button>
          <button class="plugin-modal__btn plugin-modal__btn--primary" :style="{ background: formatColor }" @click="emit('close')">
            Close
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.plugin-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
}

.plugin-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 520px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
.plugin-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-top: 3px solid transparent;
  border-radius: 12px 12px 0 0;
  border-bottom: 1px solid var(--border-faint);
}

.plugin-modal__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plugin-modal__badge {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #fff;
}

.plugin-modal__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
}

.plugin-modal__close {
  background: none;
  border: none;
  font-size: 16px;
  color: var(--text-3);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color 0.15s;
}
.plugin-modal__close:hover { color: var(--text-1); }

/* ── Path ── */
.plugin-modal__path {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-faint);
}
.plugin-modal__path-icon { font-size: 13px; flex-shrink: 0; }
.plugin-modal__path-text {
  font-size: 11px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
}

/* ── Description ── */
.plugin-modal__desc {
  margin: 0;
  padding: 8px 20px;
  font-size: 12px;
  color: var(--text-3);
  border-bottom: 1px solid var(--border-faint);
  font-style: italic;
}

/* ── Native UI launcher ── */
.plugin-modal__native-ui {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-faint);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.plugin-modal__launch-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 16px;
  border-radius: 8px;
  border: 1.5px solid var(--fmt-color, var(--accent));
  background: color-mix(in srgb, var(--fmt-color, var(--accent)) 12%, transparent);
  color: var(--fmt-color, var(--accent));
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, filter 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.plugin-modal__launch-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--fmt-color, var(--accent)) 22%, transparent);
}
.plugin-modal__launch-btn:disabled { opacity: 0.6; cursor: wait; }
.plugin-modal__launch-icon { font-size: 14px; }

.plugin-modal__launch-hint {
  margin: 0;
  font-size: 11px;
  color: var(--text-4);
  font-style: italic;
}
.plugin-modal__launch-ok {
  margin: 0;
  font-size: 12px;
  color: var(--success);
}
.plugin-modal__launch-err {
  margin: 0;
  font-size: 12px;
  color: var(--danger);
  flex: 1;
}

/* ── Loading ── */
.plugin-modal__loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  font-size: 13px;
  color: var(--text-3);
}
.plugin-modal__spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg) } }

.plugin-modal__error {
  margin: 0;
  padding: 10px 20px;
  font-size: 12px;
  color: var(--danger);
}

/* ── Source badge ── */
.plugin-modal__source {
  padding: 6px 20px;
  border-bottom: 1px solid var(--border-faint);
}
.plugin-modal__source-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
}
.plugin-modal__source-badge--real {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
}
.plugin-modal__source-badge--generic {
  background: color-mix(in srgb, var(--text-4) 15%, transparent);
  color: var(--text-4);
}

/* ── Params ── */
.plugin-modal__params {
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.plugin-modal__param-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
.plugin-modal__param-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  flex: 1;
}
.plugin-modal__param-value {
  font-size: 11px;
  color: var(--text-3);
  min-width: 60px;
  text-align: right;
  font-family: monospace;
}
.plugin-modal__param-reset {
  background: none;
  border: none;
  color: var(--text-4);
  font-size: 14px;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.15s;
}
.plugin-modal__param-reset:hover { color: var(--text-1); }

.plugin-modal__slider {
  width: 100%;
  accent-color: var(--accent-color, var(--accent));
  height: 4px;
  cursor: pointer;
}
.plugin-modal__slider--live {
  accent-color: var(--success);
}

/* ── Footer ── */
.plugin-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border-faint);
}
.plugin-modal__btn {
  padding: 7px 18px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s, border-color 0.15s;
}
.plugin-modal__btn--ghost {
  background: transparent;
  border: 1px solid var(--border-sub);
  color: var(--text-2);
}
.plugin-modal__btn--ghost:hover { border-color: var(--border); color: var(--text-1); }
.plugin-modal__btn--primary {
  border: 1px solid transparent;
  color: #fff;
}
.plugin-modal__btn--primary:hover { filter: brightness(1.1); }
</style>
