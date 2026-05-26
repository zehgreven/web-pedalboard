<script setup lang="ts">
import { computed } from 'vue'
import type { NamAudioNode } from '@/types/audio'
import { useEffectAsset } from '@/composables/useEffectAsset'

const props = defineProps<{ node: NamAudioNode }>()

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

async function clearModel() {
  await clearAsset()
}
</script>

<template>
  <div class="nam-capture">
    <label class="nam-capture__file">
      <input
        class="nam-capture__file-input"
        type="file"
        accept=".nam"
        :disabled="loading"
        @change="onFileChange"
      />
      <span class="nam-capture__file-btn">{{ hasModel ? 'Change .nam' : 'Load .nam' }}</span>
    </label>

    <button
      v-if="hasModel"
      class="nam-capture__clear"
      type="button"
      :disabled="loading"
      @click="clearModel"
    >
      Clear
    </button>

    <p v-if="node.model" class="nam-capture__model">{{ node.model.name }}</p>
    <p v-else class="nam-capture__hint">Load a capture, then press Start</p>
    <p v-if="error" class="nam-capture__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.nam-capture {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.nam-capture__file-input {
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

.nam-capture__file-btn {
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

.nam-capture__clear {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #3a3a3a;
  background: transparent;
  color: #bbb;
  font-size: 11px;
  cursor: pointer;
  align-self: flex-start;
}

.nam-capture__model {
  margin: 0;
  font-size: 11px;
  color: #ccc;
  word-break: break-all;
}

.nam-capture__hint {
  margin: 0;
  font-size: 11px;
  color: #666;
}

.nam-capture__error {
  margin: 0;
  font-size: 11px;
  color: #e74c3c;
}
</style>
