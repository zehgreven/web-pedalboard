<script setup lang="ts">
import { computed } from 'vue'
import type { IrAudioNode } from '@/types/audio'
import { useEffectAsset } from '@/composables/useEffectAsset'
import { usePedalboardStore } from '@/stores/pedalboard'
import KnobControl from '@/components/effects/KnobControl.vue'

const props = defineProps<{ node: IrAudioNode }>()

const store = usePedalboardStore()
const { error, loading, saveFile, clearAsset } = useEffectAsset(props.node.id, 'ir')

const hasIr = computed(() => Boolean(props.node.ir?.url))

function validateIrFile(name: string): string | null {
  if (!name.toLowerCase().endsWith('.wav')) return 'Select a .wav file'
  return null
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await saveFile(file, validateIrFile)
  input.value = ''
}

function param(values: Parameters<typeof store.updateIrParams>[1]) {
  store.updateIrParams(props.node.id, values)
}

// ─── Knob formatters ─────────────────────────────────────────────────────────

function formatHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} k` : `${Math.round(hz)}`
}

function formatLowCut(v: number): string {
  if (v === 0) return 'off'
  const freq = 20 * Math.pow(25, v / 100)
  return formatHz(freq)
}

function formatHighCut(v: number): string {
  if (v === 0) return 'off'
  const freq = 20_000 * Math.pow(0.1, v / 100)
  return formatHz(freq)
}
</script>

<template>
  <div class="ir-loader">
    <!-- Knobs: Low Cut | Level | High Cut -->
    <div class="ir-loader__knobs">
      <KnobControl
        label="Level"
        :model-value="node.level"
        :default="50"
        @update:model-value="(v) => param({ level: v })"
      />
      <KnobControl
        label="Lo Cut"
        :model-value="node.lowCut"
        :min="0"
        :max="100"
        :default="0"
        :format-value="formatLowCut"
        @update:model-value="(v) => param({ lowCut: v })"
      />
      <KnobControl
        label="Hi Cut"
        :model-value="node.highCut"
        :min="0"
        :max="100"
        :default="0"
        :format-value="formatHighCut"
        @update:model-value="(v) => param({ highCut: v })"
      />
    </div>

    <!-- File controls -->
    <div class="ir-loader__file-row">
      <label class="ir-loader__file">
        <input
          class="ir-loader__file-input"
          type="file"
          accept=".wav,audio/wav"
          :disabled="loading"
          @change="onFileChange"
        />
        <span class="ir-loader__file-btn">{{ hasIr ? 'Change' : 'Load .wav' }}</span>
      </label>

      <button
        v-if="hasIr"
        class="ir-loader__clear"
        type="button"
        :disabled="loading"
        @click="clearAsset"
      >
        Clear
      </button>
    </div>

    <p v-if="node.ir" class="ir-loader__name">{{ node.ir.name }}</p>
    <p v-else class="ir-loader__hint">Load an impulse response</p>
    <p v-if="error" class="ir-loader__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.ir-loader {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.ir-loader__knobs {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 2px 0;
}

.ir-loader__file-row {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.ir-loader__file-input {
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

.ir-loader__file-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #3a3a3a;
  background: #1f1f1f;
  color: #ddd;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.ir-loader__clear {
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid #3a3a3a;
  background: transparent;
  color: #bbb;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

.ir-loader__name {
  margin: 0;
  font-size: 10px;
  color: #aaa;
  word-break: break-all;
  text-align: center;
}

.ir-loader__hint {
  margin: 0;
  font-size: 10px;
  color: #555;
  text-align: center;
}

.ir-loader__error {
  margin: 0;
  font-size: 10px;
  color: #e74c3c;
}
</style>
