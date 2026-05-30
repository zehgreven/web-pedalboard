<script setup lang="ts">
import { ref } from 'vue'
import { usePedalboardStore } from '@/stores/pedalboard'
import EffectCard from '@/components/EffectCard.vue'

const store = usePedalboardStore()
const draggedId = ref<string | null>(null)
const isDropTarget = ref(false)

// Drag from canvas card (reorder)
function onCardDragStart(event: DragEvent, id: string) {
  draggedId.value = id
  event.dataTransfer?.setData('text/plain', `canvas:${id}`)
}

function onCardDragOver(event: DragEvent, targetId: string) {
  event.preventDefault()
  const fromId = draggedId.value
  if (!fromId || fromId === targetId) return

  const fromIndex = store.nodes.findIndex((n) => n.id === fromId)
  const toIndex = store.nodes.findIndex((n) => n.id === targetId)
  if (fromIndex !== -1 && toIndex !== -1) store.moveNode(fromIndex, toIndex)
}

function onCardDragEnd() {
  draggedId.value = null
}

// Drop from sidebar onto canvas
function onCanvasDragOver(event: DragEvent) {
  event.preventDefault()
  // Only show drop target highlight when dragging from sidebar (no draggedId means it's from sidebar)
  if (!draggedId.value) isDropTarget.value = true
}

function onCanvasDragLeave() {
  isDropTarget.value = false
}

function onCanvasDrop(event: DragEvent) {
  isDropTarget.value = false
  const payload = event.dataTransfer?.getData('text/plain') ?? ''
  if (!payload.startsWith('sidebar:')) return

  const effectType = payload.slice('sidebar:'.length) as 'nam' | 'ir'

  if (effectType === 'nam') {
    store.addNode({
      id: crypto.randomUUID(),
      type: 'nam',
      label: 'NAM Capture',
      enabled: true,
      model: null,
      inputGain: 50,
      outputLevel: 50,
      noiseGateThreshold: 0,
      noiseGateActive: true,
      bass: 50,
      mid: 50,
      treble: 50,
      eqActive: true,
    })
    return
  }

  store.addNode({
    id: crypto.randomUUID(),
    type: 'ir',
    label: 'IR Loader',
    enabled: true,
    ir: null,
    level: 50,
    lowCut: 0,
    highCut: 0,
  })
}
</script>

<template>
  <div
    class="pedalboard-canvas"
    :class="{ 'pedalboard-canvas--drop-target': isDropTarget }"
    @dragover="onCanvasDragOver"
    @dragleave="onCanvasDragLeave"
    @drop="onCanvasDrop"
  >
    <div class="pedalboard-canvas__chain">
      <div class="pedalboard-canvas__anchor">INPUT</div>

      <template v-if="store.nodes.length">
        <template v-for="node in store.nodes" :key="node.id">
          <div class="pedalboard-canvas__arrow" aria-hidden="true">──►</div>
          <EffectCard
            :node="node"
            :class="{ 'is-dragging': draggedId === node.id }"
            @toggle="store.toggleNode"
            @remove="store.removeNode"
            @dragstart="(e: DragEvent) => onCardDragStart(e, node.id)"
            @dragover.prevent="(e: DragEvent) => onCardDragOver(e, node.id)"
            @dragend="onCardDragEnd"
          />
        </template>
      </template>

      <div v-else class="pedalboard-canvas__empty">
        Drag an effect from the sidebar to get started
      </div>

      <div class="pedalboard-canvas__arrow" aria-hidden="true">──►</div>
      <div class="pedalboard-canvas__anchor">OUTPUT</div>
    </div>
  </div>
</template>

<style scoped>
.pedalboard-canvas {
  position: fixed;
  top: 56px;
  bottom: 64px;
  left: 240px;
  right: 0;
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--bg-app);
  padding: 0 24px;
  transition: background 0.2s;
}

.pedalboard-canvas--drop-target {
  background: color-mix(in srgb, var(--success) 8%, var(--bg-app));
  outline: 2px dashed var(--success);
  outline-offset: -8px;
}

.pedalboard-canvas__chain {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: max-content;
}

.pedalboard-canvas__anchor {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 1px;
  white-space: nowrap;
}

.pedalboard-canvas__arrow {
  color: var(--text-4);
  font-size: 14px;
  white-space: nowrap;
}

.pedalboard-canvas__empty {
  font-size: 14px;
  color: var(--text-4);
  padding: 0 32px;
  white-space: nowrap;
}

.is-dragging {
  opacity: 0.3;
}
</style>
