<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePedalboardStore } from '@/stores/pedalboard'
import type { EffectDefinition } from '@/types/audio'

const store = usePedalboardStore()

const effects: EffectDefinition[] = [
  {
    type: 'nam',
    label: 'NAM Capture',
    category: 'Amp Sims',
    description: 'Neural amp model from a .nam file',
  },
  {
    type: 'ir',
    label: 'IR Loader',
    category: 'Cabinet',
    description: 'Cabinet simulation via impulse response',
  },
]

const categories = [...new Set(effects.map((e) => e.category))]
const activeTypes = computed(() => new Set(store.nodes.map((n) => n.type)))
const isDropTarget = ref(false)

function onDragStart(event: DragEvent, effect: EffectDefinition) {
  event.dataTransfer?.setData('text/plain', `sidebar:${effect.type}`)
}

function onDragOver(event: DragEvent) {
  // Only accept drags coming from the canvas
  event.preventDefault()
  isDropTarget.value = true
}

function onDragLeave() {
  isDropTarget.value = false
}

function onDrop(event: DragEvent) {
  isDropTarget.value = false
  const payload = event.dataTransfer?.getData('text/plain') ?? ''
  if (!payload.startsWith('canvas:')) return
  const nodeId = payload.slice('canvas:'.length)
  store.removeNode(nodeId)
}
</script>

<template>
  <aside
    class="add-effect-sidebar"
    :class="{ 'add-effect-sidebar--drop-target': isDropTarget }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="add-effect-sidebar__header">
      <span>Effects</span>
    </div>

    <div v-for="category in categories" :key="category" class="add-effect-sidebar__category">
      <p class="add-effect-sidebar__category-title">{{ category }}</p>

      <div
        v-for="effect in effects.filter((e) => e.category === category)"
        :key="effect.type"
        class="add-effect-sidebar__item"
        :class="{ 'add-effect-sidebar__item--added': activeTypes.has(effect.type) }"
        :draggable="!activeTypes.has(effect.type)"
        @dragstart="(e) => onDragStart(e, effect)"
      >
        <span class="add-effect-sidebar__item-label">{{ effect.label }}</span>
        <span class="add-effect-sidebar__item-desc">{{ effect.description }}</span>
      </div>
    </div>

    <div v-if="isDropTarget" class="add-effect-sidebar__drop-hint">Drop here to remove</div>
  </aside>
</template>

<style scoped>
.add-effect-sidebar {
  position: fixed;
  top: 56px;
  bottom: 64px;
  left: 0;
  width: 240px;
  background: #1e1e1e;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  z-index: 90;
  overflow-y: auto;
  transition: border-color 0.15s;
}

.add-effect-sidebar--drop-target {
  border-right-color: #c0392b;
  background: #1e1212;
}

.add-effect-sidebar__header {
  padding: 16px;
  border-bottom: 1px solid #333;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.add-effect-sidebar__category {
  padding: 12px 16px 4px;
}

.add-effect-sidebar__category-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #666;
  margin: 0 0 8px;
}

.add-effect-sidebar__item {
  width: 100%;
  background: #2a2a2a;
  border: 1px solid #383838;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 6px;
  cursor: grab;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  transition:
    border-color 0.15s,
    background 0.15s;
  user-select: none;
}

.add-effect-sidebar__item:hover:not(.add-effect-sidebar__item--added) {
  background: #333;
  border-color: #2e86de;
}

.add-effect-sidebar__item--added {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-effect-sidebar__item-label {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.add-effect-sidebar__item-desc {
  font-size: 11px;
  color: #777;
}

.add-effect-sidebar__drop-hint {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 12px;
  color: #c0392b;
}
</style>
