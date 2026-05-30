<script setup lang="ts">
import type { AudioNode } from '@/types/audio'
import NamCaptureEffect from '@/components/effects/NamCaptureEffect.vue'
import IrLoaderEffect from '@/components/effects/IrLoaderEffect.vue'
import PluginEffect from '@/components/effects/PluginEffect.vue'

const props = defineProps<{ node: AudioNode }>()

defineEmits<{
  toggle: [id: string]
  remove: [id: string]
}>()

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/plain', `canvas:${props.node.id}`)
}
</script>

<template>
  <div
    class="effect-card"
    :class="{
      'effect-card--bypassed': !node.enabled,
      'effect-card--nam': node.type === 'nam',
      'effect-card--ir': node.type === 'ir',
      'effect-card--plugin': node.type === 'plugin',
    }"
    draggable="true"
    @dragstart="onDragStart"
  >
    <div class="effect-card__header">
      <span class="effect-card__label">{{ node.label }}</span>
      <button
        class="effect-card__bypass"
        :class="{ 'effect-card__bypass--on': node.enabled }"
        :aria-label="node.enabled ? 'Bypass effect' : 'Enable effect'"
        @click="$emit('toggle', node.id)"
      >
        {{ node.enabled ? 'ON' : 'OFF' }}
      </button>
    </div>

    <div class="effect-card__body">
      <NamCaptureEffect v-if="node.type === 'nam'" :node="node" />
      <IrLoaderEffect v-else-if="node.type === 'ir'" :node="node" />
      <PluginEffect v-else-if="node.type === 'plugin'" :node="node" />
    </div>

    <div class="effect-card__footer">
      <span class="effect-card__drag-handle" aria-hidden="true">⠿</span>
      <button
        class="effect-card__remove"
        aria-label="Remove effect"
        @click="$emit('remove', node.id)"
      >
        🗑
      </button>
    </div>
  </div>
</template>

<style scoped>
.effect-card--nam {
  width: 260px;
  min-width: 260px;
}

.effect-card--ir {
  width: 200px;
  min-width: 200px;
}

.effect-card--plugin {
  width: 180px;
  min-width: 180px;
}

.effect-card {
  width: 160px;
  min-width: 160px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  cursor: grab;
  transition: opacity 0.2s, border-color 0.2s, background 0.2s;
  user-select: none;
}

.effect-card--bypassed {
  opacity: 0.45;
}

.effect-card:active {
  cursor: grabbing;
}

.effect-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.effect-card__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.effect-card__bypass {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  background: var(--border);
  color: var(--text-3);
  transition: background 0.15s, color 0.15s;
}

.effect-card__bypass--on {
  background: var(--success);
  color: #fff;
}

.effect-card__body {
  font-size: 12px;
  color: var(--text-3);
}

.effect-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.effect-card__drag-handle {
  font-size: 12px;
  color: var(--text-4);
}

.effect-card__remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.effect-card__remove:hover {
  opacity: 1;
}
</style>
