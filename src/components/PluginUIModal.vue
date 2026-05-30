<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { PluginAudioNode } from '@/types/audio'

const props = defineProps<{
  node: PluginAudioNode
  formatColor: string
}>()

const emit = defineEmits<{ close: [] }>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// Generic params — stored locally (not wired to audio engine, native plugin)
interface GenericParam {
  id: string
  label: string
  value: number
  min: number
  max: number
  default: number
  unit: string
}

const DEFAULT_PARAMS: GenericParam[] = [
  { id: 'gain',    label: 'Gain',    value: 0,   min: -24, max: 24,  default: 0,   unit: 'dB' },
  { id: 'output',  label: 'Output',  value: 0,   min: -24, max: 6,   default: 0,   unit: 'dB' },
  { id: 'mix',     label: 'Dry/Wet', value: 100, min: 0,   max: 100, default: 100, unit: '%'  },
]

const params = ref<GenericParam[]>(DEFAULT_PARAMS.map((p) => ({ ...p })))

function resetParam(param: GenericParam) {
  param.value = param.default
}

function resetAll() {
  params.value.forEach((p) => (p.value = p.default))
}

const FORMAT_LABEL: Record<string, string> = {
  vst3:   'VST3',
  vst:    'VST',
  lv2:    'LV2',
  ladspa: 'LADSPA',
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
            <h2 class="plugin-modal__title">{{ node.pluginName }}</h2>
          </div>
          <button class="plugin-modal__close" @click="emit('close')" aria-label="Close">✕</button>
        </div>

        <!-- Path info -->
        <div class="plugin-modal__path" :title="node.pluginPath">
          <span class="plugin-modal__path-icon">📁</span>
          <span class="plugin-modal__path-text">{{ node.pluginPath || '(path unknown)' }}</span>
        </div>

        <!-- Native notice -->
        <div class="plugin-modal__notice">
          <span class="plugin-modal__notice-icon">⚠</span>
          Native plugin — the original GUI cannot be rendered in the browser.
          The controls below are generic pass-through parameters.
        </div>

        <!-- Parameter panel -->
        <div class="plugin-modal__params">
          <div
            v-for="param in params"
            :key="param.id"
            class="plugin-modal__param"
          >
            <div class="plugin-modal__param-header">
              <label :for="`param-${node.id}-${param.id}`" class="plugin-modal__param-label">
                {{ param.label }}
              </label>
              <span class="plugin-modal__param-value">
                {{ param.value.toFixed(param.unit === '%' ? 0 : 1) }}{{ param.unit }}
              </span>
              <button
                class="plugin-modal__param-reset"
                title="Reset to default"
                @click="resetParam(param)"
              >↺</button>
            </div>
            <input
              :id="`param-${node.id}-${param.id}`"
              v-model.number="param.value"
              type="range"
              :min="param.min"
              :max="param.max"
              step="0.1"
              class="plugin-modal__slider"
              :style="{ '--accent': formatColor }"
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="plugin-modal__footer">
          <button class="plugin-modal__btn plugin-modal__btn--ghost" @click="resetAll">
            Reset all
          </button>
          <button class="plugin-modal__btn plugin-modal__btn--primary" @click="emit('close')">
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
  width: 480px;
  max-width: 95vw;
  max-height: 90vh;
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

.plugin-modal__close:hover {
  color: var(--text-1);
}

/* ── Path ── */
.plugin-modal__path {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-faint);
}

.plugin-modal__path-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.plugin-modal__path-text {
  font-size: 11px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Notice ── */
.plugin-modal__notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 20px;
  font-size: 11px;
  color: var(--text-3);
  background: color-mix(in srgb, var(--bg-card) 60%, transparent);
  border-bottom: 1px solid var(--border-faint);
  line-height: 1.5;
}

.plugin-modal__notice-icon {
  flex-shrink: 0;
  font-size: 13px;
}

/* ── Params ── */
.plugin-modal__params {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.plugin-modal__param {}

.plugin-modal__param-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
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
  min-width: 48px;
  text-align: right;
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

.plugin-modal__param-reset:hover {
  color: var(--text-1);
}

.plugin-modal__slider {
  width: 100%;
  accent-color: var(--accent, #2e86de);
  height: 4px;
  cursor: pointer;
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
  transition: background 0.15s, border-color 0.15s;
}

.plugin-modal__btn--ghost {
  background: transparent;
  border: 1px solid var(--border-sub);
  color: var(--text-2);
}

.plugin-modal__btn--ghost:hover {
  border-color: var(--border);
  color: var(--text-1);
}

.plugin-modal__btn--primary {
  background: var(--accent, #2e86de);
  border: 1px solid transparent;
  color: #fff;
}

.plugin-modal__btn--primary:hover {
  filter: brightness(1.1);
}
</style>
