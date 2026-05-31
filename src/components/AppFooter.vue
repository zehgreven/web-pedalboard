<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAudioDevices } from '@/composables/useAudioDevices'
import { useAudioEngine } from '@/composables/useAudioEngine'
import { useCarlaEngine } from '@/composables/useCarlaEngine'
import { usePedalboardStore } from '@/stores/pedalboard'

const { inputDevices, outputDevices, selectedInput, selectedOutput, loadDevices } =
  useAudioDevices()

const { start: startWebAudio, stop: stopWebAudio, isRunning: webAudioRunning } =
  useAudioEngine()

const { carlaAvailable, carlaStatus, carlaError, startCarla, stopCarla } =
  useCarlaEngine()

const store = usePedalboardStore()
const { nodes } = storeToRefs(store)

// ── Mode detection ────────────────────────────────────────────────────────────

/** True when there is at least one enabled native plugin in the chain. */
const hasNativePlugins = computed(() =>
  nodes.value.some((n) => n.type === 'plugin' && n.enabled),
)

/**
 * In Electron with native plugins: use Carla.
 * Otherwise: use Web Audio.
 */
const carlaMode = computed(
  () => hasNativePlugins.value && carlaAvailable.value,
)

const isRunning = computed(() =>
  carlaMode.value
    ? carlaStatus.value === 'running' || carlaStatus.value === 'starting'
    : webAudioRunning.value,
)

// ── Status label ──────────────────────────────────────────────────────────────

const engineLabel = computed(() => {
  if (!carlaMode.value) return null
  switch (carlaStatus.value) {
    case 'starting':   return '⏳ Starting Carla…'
    case 'running':    return '🎛 Carla (JACK)'
    case 'error':      return `⚠ Carla error`
    case 'stopped':    return null
    case 'unavailable': return null
  }
})

// ── Transport ─────────────────────────────────────────────────────────────────

const error = ref('')

onMounted(async () => {
  await loadDevices()
})

async function toggleEngine(): Promise<void> {
  error.value = ''
  try {
    if (isRunning.value) {
      // Stop both engines regardless of current mode
      if (carlaMode.value) await stopCarla()
      if (webAudioRunning.value) await stopWebAudio()
    } else {
      if (carlaMode.value) {
        // Stop Web Audio first (can't share mic with two consumers easily)
        if (webAudioRunning.value) await stopWebAudio()
        const result = await startCarla(nodes.value)
        if (!result.ok) {
          error.value = result.error ?? 'Carla failed to start'
        }
      } else {
        await startWebAudio(selectedInput.value, selectedOutput.value)
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
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

      <!-- Carla mode indicator -->
      <span v-if="engineLabel" class="footer-engine-badge" :class="{ 'footer-engine-badge--error': carlaStatus === 'error' }">
        {{ engineLabel }}
      </span>
      <span v-else-if="carlaMode" class="footer-engine-badge footer-engine-badge--idle">
        🎛 Carla mode
      </span>

      <button
        class="transport-btn"
        :class="{
          active: isRunning,
          'transport-btn--starting': carlaStatus === 'starting',
        }"
        :disabled="carlaStatus === 'starting'"
        @click="toggleEngine"
      >
        <span v-if="carlaStatus === 'starting'" class="transport-spinner" />
        {{ isRunning ? '⏹ Stop' : '▶ Start' }}
      </button>
    </div>

    <p v-if="error || (carlaStatus === 'error' && carlaError)" class="footer-error">
      {{ error || carlaError }}
    </p>

    <p v-if="carlaMode && !isRunning" class="footer-hint">
      Native plugins detected — audio will be routed through Carla (JACK/PipeWire)
    </p>
  </footer>
</template>

<style scoped>
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  padding: 12px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: background 0.2s, border-color 0.2s;
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
  color: var(--text-2);
  font-size: 14px;
}

.footer-field select {
  background: var(--bg-card);
  color: var(--text-1);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 14px;
}

.footer-field select:disabled { opacity: 0.5; }

.footer-engine-badge {
  font-size: 12px;
  color: var(--text-3);
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border-faint);
}
.footer-engine-badge--error {
  color: var(--danger);
  border-color: var(--danger);
}
.footer-engine-badge--idle {
  color: var(--text-4);
}

.transport-btn {
  margin-left: auto;
  padding: 8px 24px;
  border: none;
  border-radius: 4px;
  background: var(--border);
  color: var(--text-1);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.transport-btn.active  { background: var(--danger); }
.transport-btn:hover:not(:disabled) { filter: brightness(1.15); }
.transport-btn:disabled { opacity: 0.6; cursor: wait; }

.transport-spinner {
  display: inline-block;
  width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg) } }

.footer-error {
  color: var(--danger);
  font-size: 12px;
  margin: 0;
}

.footer-hint {
  font-size: 11px;
  color: var(--text-4);
  margin: 0;
  font-style: italic;
}
</style>
