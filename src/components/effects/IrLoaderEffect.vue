<script setup lang="ts">
import { computed } from 'vue'
import type { IrAudioNode } from '@/types/audio'
import { useEffectAsset } from '@/composables/useEffectAsset'

const props = defineProps<{ node: IrAudioNode }>()

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

async function clearIr() {
  await clearAsset()
}
</script>

<template>
  <div class="ir-loader">
    <label class="ir-loader__file">
      <input
        class="ir-loader__file-input"
        type="file"
        accept=".wav,audio/wav"
        :disabled="loading"
        @change="onFileChange"
      />
      <span class="ir-loader__file-btn">{{ hasIr ? 'Change .wav' : 'Load .wav' }}</span>
    </label>

    <button
      v-if="hasIr"
      class="ir-loader__clear"
      type="button"
      :disabled="loading"
      @click="clearIr"
    >
      Clear
    </button>

    <p v-if="node.ir" class="ir-loader__name">{{ node.ir.name }}</p>
    <p v-else class="ir-loader__hint">Load an impulse response</p>
    <p v-if="error" class="ir-loader__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.ir-loader {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
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
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #3a3a3a;
  background: #1f1f1f;
  color: #ddd;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.ir-loader__clear {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #3a3a3a;
  background: transparent;
  color: #bbb;
  font-size: 11px;
  cursor: pointer;
  align-self: flex-start;
}

.ir-loader__name {
  margin: 0;
  font-size: 11px;
  color: #ccc;
  word-break: break-all;
}

.ir-loader__hint {
  margin: 0;
  font-size: 11px;
  color: #666;
}

.ir-loader__error {
  margin: 0;
  font-size: 11px;
  color: #e74c3c;
}
</style>
