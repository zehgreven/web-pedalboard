<script setup lang="ts">
import { computed } from 'vue'
import type { NamAudioNode } from '@/types/audio'
import { useEffectAsset } from '@/composables/useEffectAsset'
import { usePedalboardStore } from '@/stores/pedalboard'
import KnobControl from '@/components/effects/KnobControl.vue'

const props = defineProps<{ node: NamAudioNode }>()

const store = usePedalboardStore()
const { error, loading, saveFile, clearAsset } = useEffectAsset(props.node.id, 'nam')

const hasModel = computed(() => Boolean(props.node.model?.url))

function validateNamFile(name: string): string | null {
  if (!name.toLowerCase().endsWith('.nam')) return 'Select a .nam file'
  return null
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await saveFile(file, validateNamFile)
  input.value = ''
}

function param(values: Parameters<typeof store.updateNamParams>[1]) {
  store.updateNamParams(props.node.id, values)
}

// ─── Knob formatters ─────────────────────────────────────────────────────────

function formatGate(v: number): string {
  const db = Math.round((v / 100) * 80 - 80)
  return `${db} dB`
}

function formatEq(v: number): string {
  const db = Math.round(((v - 50) / 50) * 12)
  if (db === 0) return '—'
  return db > 0 ? `+${db} dB` : `${db} dB`
}
</script>

<template>
  <div class="nam">
    <!-- ── Main gain row (Gate + Input + Output) ── -->
    <div class="nam__row">
      <KnobControl
        label="Gate"
        :model-value="node.noiseGateThreshold"
        :min="0"
        :max="100"
        :default="0"
        :format-value="formatGate"
        @update:model-value="(v) => param({ noiseGateThreshold: v })"
      />
      <KnobControl
        label="Input"
        :model-value="node.inputGain"
        :default="50"
        @update:model-value="(v) => param({ inputGain: v })"
      />
      <KnobControl
        label="Output"
        :model-value="node.outputLevel"
        :default="50"
        @update:model-value="(v) => param({ outputLevel: v })"
      />
    </div>

    <!-- ── Tone Stack ── -->
    <div class="nam__row">
      <KnobControl
        label="Bass"
        :model-value="node.bass"
        :default="50"
        :format-value="formatEq"
        @update:model-value="(v) => param({ bass: v })"
      />
      <KnobControl
        label="Mid"
        :model-value="node.mid"
        :default="50"
        :format-value="formatEq"
        @update:model-value="(v) => param({ mid: v })"
      />
      <KnobControl
        label="Treble"
        :model-value="node.treble"
        :default="50"
        :format-value="formatEq"
        @update:model-value="(v) => param({ treble: v })"
      />
    </div>

    <!-- ── File controls ── -->
    <div class="nam__file-row">
      <label class="nam__file">
        <input
          class="nam__file-input"
          type="file"
          accept=".nam"
          :disabled="loading"
          @change="onFileChange"
        />
        <span class="nam__file-btn">{{ hasModel ? 'Change' : 'Load .nam' }}</span>
      </label>
      <button
        v-if="hasModel"
        class="nam__clear"
        type="button"
        :disabled="loading"
        @click="clearAsset"
      >
        Clear
      </button>
    </div>

    <p v-if="node.model" class="nam__model">{{ node.model.name }}</p>
    <p v-else class="nam__hint">Load a capture, then press Start</p>
    <p v-if="error" class="nam__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.nam {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
}

/* ── Rows ── */
.nam__row {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 2px 0;
}

/* ── File controls ── */
.nam__file-row {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.nam__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.nam__file-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-sub);
  background: var(--bg-input);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.nam__clear {
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-sub);
  background: transparent;
  color: var(--text-3);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

.nam__model {
  margin: 0;
  font-size: 10px;
  color: var(--text-2);
  word-break: break-all;
  text-align: center;
}

.nam__hint {
  margin: 0;
  font-size: 10px;
  color: var(--text-4);
  text-align: center;
}

.nam__error {
  margin: 0;
  font-size: 10px;
  color: var(--danger);
}
</style>
