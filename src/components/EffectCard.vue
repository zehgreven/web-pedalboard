<script setup lang="ts">
import type { AudioNode } from '@/types/audio'

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
    :class="{ 'effect-card--bypassed': !node.enabled }"
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
      <span class="effect-card__type">{{ node.type }}</span>
    </div>

    <div class="effect-card__footer">
      <span class="effect-card__drag-handle" aria-hidden="true">⠿ drag</span>
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
.effect-card {
  width: 160px;
  min-width: 160px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  cursor: grab;
  transition:
    opacity 0.2s,
    border-color 0.2s;
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
  color: #fff;
}

.effect-card__bypass {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  background: #555;
  color: #aaa;
  transition:
    background 0.15s,
    color 0.15s;
}

.effect-card__bypass--on {
  background: #27ae60;
  color: #fff;
}

.effect-card__body {
  font-size: 12px;
  color: #888;
}

.effect-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.effect-card__drag-handle {
  font-size: 12px;
  color: #666;
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
