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

function setInputGain(value: number) {
  store.updateNamParams(props.node.id, { inputGain: value })
}

function setOutputLevel(value: number) {
  store.updateNamParams(props.node.id, { outputLevel: value })
}
</script>

<template>
  <div class="nam-capture">
    <!-- Knobs row -->
    <div class="nam-capture__knobs">
      <KnobControl
        label="Input"
        :model-value="node.inputGain"
        :default="50"
        @update:model-value="setInputGain"
      />
      <KnobControl
        label="Output"
        :model-value="node.outputLevel"
        :default="50"
        @update:model-value="setOutputLevel"
      />
    </div>

    <!-- File controls -->
    <div class="nam-capture__file-row">
      <label class="nam-capture__file">
        <input
          class="nam-capture__file-input"
          type="file"
          accept=".nam"
          :disabled="loading"
          @change="onFileChange"
        />
        <span class="nam-capture__file-btn">{{ hasModel ? 'Change' : 'Load .nam' }}</span>
      </label>

      <button
        v-if="hasModel"
        class="nam-capture__clear"
        type="button"
        :disabled="loading"
        @click="clearAsset"
      >
        Clear
      </button>
    </div>

    <p v-if="node.model" class="nam-capture__model">{{ node.model.name }}</p>
    <p v-else class="nam-capture__hint">Load a capture, then press Start</p>
    <p v-if="error" class="nam-capture__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.nam-capture {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.nam-capture__knobs {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding: 4px 0;
}

.nam-capture__file-row {
  display: flex;
  gap: 6px;
  align-items: center;
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

.nam-capture__clear {
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid #3a3a3a;
  background: transparent;
  color: #bbb;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

.nam-capture__model {
  margin: 0;
  font-size: 10px;
  color: #aaa;
  word-break: break-all;
  text-align: center;
}

.nam-capture__hint {
  margin: 0;
  font-size: 10px;
  color: #555;
  text-align: center;
}

.nam-capture__error {
  margin: 0;
  font-size: 10px;
  color: #e74c3c;
}
</style>
