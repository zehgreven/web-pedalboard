<script setup lang="ts">
import { ref } from 'vue'
import { usePedalboardStore } from '@/stores/pedalboard'
import EffectCard from '@/components/EffectCard.vue'

const store = usePedalboardStore()

const draggedId = ref<string | null>(null)

function onDragStart(id: string) {
  draggedId.value = id
}

function onDragOver(event: DragEvent, targetId: string) {
  event.preventDefault()
  if (!draggedId.value || draggedId.value === targetId) return

  const fromIndex = store.nodes.findIndex((n) => n.id === draggedId.value)
  const toIndex = store.nodes.findIndex((n) => n.id === targetId)
  if (fromIndex !== -1 && toIndex !== -1) {
    store.moveNode(fromIndex, toIndex)
  }
}

function onDragEnd() {
  draggedId.value = null
}
</script>

<template>
  <div class="pedalboard-canvas">
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
            @dragstart="onDragStart"
            @dragover.prevent="(e: DragEvent) => onDragOver(e, node.id)"
            @dragend="onDragEnd"
          />
        </template>
      </template>

      <div v-else class="pedalboard-canvas__empty">Drop effects here or click "+ Add Effect"</div>

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
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  background: #111;
  padding: 0 24px;
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
  color: #888;
  letter-spacing: 1px;
  white-space: nowrap;
}

.pedalboard-canvas__arrow {
  color: #555;
  font-size: 14px;
  white-space: nowrap;
}

.pedalboard-canvas__empty {
  font-size: 14px;
  color: #555;
  padding: 0 32px;
  white-space: nowrap;
}

.is-dragging {
  opacity: 0.3;
}
</style>
