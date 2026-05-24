<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAudioDevices } from '@/composables/useAudioDevices'
import { useAudioEngine } from '@/composables/useAudioEngine'

const { inputDevices, outputDevices, loadDevices } = useAudioDevices()
const { start, stop, isRunning } = useAudioEngine()

const selectedInput = ref('')
const selectedOutput = ref('')
const error = ref('')

onMounted(async () => {
  await loadDevices()
  if (inputDevices.value.length) selectedInput.value = inputDevices.value[0]!.deviceId
  if (outputDevices.value.length) selectedOutput.value = outputDevices.value[0]!.deviceId
})

async function toggleEngine(): Promise<void> {
  error.value = ''
  try {
    if (isRunning.value) {
      stop()
    } else {
      await start(selectedInput.value)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error'
  }
}
</script>

<template>
  <footer class="app-footer">
    <div class="footer-controls">
      <label class="footer-field">
        <span>🎤 Input</span>
        <select v-model="selectedInput" :disabled="isRunning">
          <option v-for="d in inputDevices" :key="d.deviceId" :value="d.deviceId">
            {{ d.label }}
          </option>
        </select>
      </label>

      <label class="footer-field">
        <span>🔊 Output</span>
        <select v-model="selectedOutput" :disabled="isRunning">
          <option v-for="d in outputDevices" :key="d.deviceId" :value="d.deviceId">
            {{ d.label }}
          </option>
        </select>
      </label>

      <button class="transport-btn" :class="{ active: isRunning }" @click="toggleEngine">
        {{ isRunning ? '⏹ Stop' : '▶ Start' }}
      </button>
    </div>

    <p v-if="error" class="footer-error">{{ error }}</p>
  </footer>
</template>

<style scoped>
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1a1a1a;
  border-top: 1px solid #333;
  padding: 12px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.footer-controls {
  display: flex;
  align-items: center;
  gap: 24px;
}

.footer-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ccc;
  font-size: 14px;
}

.footer-field select {
  background: #2a2a2a;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 14px;
}

.footer-field select:disabled {
  opacity: 0.5;
}

.transport-btn {
  margin-left: auto;
  padding: 8px 24px;
  border: none;
  border-radius: 4px;
  background: #3a3a3a;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.transport-btn.active {
  background: #c0392b;
}

.transport-btn:hover {
  filter: brightness(1.2);
}

.footer-error {
  color: #e74c3c;
  font-size: 12px;
  margin: 0;
}
</style>
