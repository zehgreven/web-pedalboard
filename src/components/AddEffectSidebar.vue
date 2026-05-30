<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePedalboardStore } from '@/stores/pedalboard'
import { usePluginFolders } from '@/composables/usePluginFolders'
import { usePluginScanner, type FoundPlugin, type PluginFormat } from '@/composables/usePluginScanner'
import type { EffectDefinition } from '@/types/audio'

const store = usePedalboardStore()
const { folders, load: loadFolders } = usePluginFolders()
const { plugins, scanning, scan } = usePluginScanner()

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

// Plugin listing grouped by format
const FORMAT_LABEL: Record<PluginFormat, string> = {
  vst3: 'VST3',
  vst: 'VST',
  lv2: 'LV2',
  ladspa: 'LADSPA',
}
const FORMAT_ORDER: PluginFormat[] = ['vst3', 'vst', 'lv2', 'ladspa']

const pluginsByFormat = computed(() => {
  const map = new Map<PluginFormat, FoundPlugin[]>()
  for (const p of plugins.value) {
    if (!map.has(p.format)) map.set(p.format, [])
    map.get(p.format)!.push(p)
  }
  return FORMAT_ORDER.filter((f) => map.has(f)).map((f) => ({
    format: f,
    label: FORMAT_LABEL[f],
    items: map.get(f)!,
  }))
})

const hasFoldersWithAccess = computed(() => folders.value.some((f) => f.permission === 'granted'))

onMounted(async () => {
  await loadFolders()
  await scan()
})

function onDragStart(event: DragEvent, effect: EffectDefinition) {
  event.dataTransfer?.setData('text/plain', `sidebar:${effect.type}`)
}

function onDragOver(event: DragEvent) {
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
  store.removeNode(payload.slice('canvas:'.length))
}
</script>

<template>
  <aside
    class="sidebar"
    :class="{ 'sidebar--drop-target': isDropTarget }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- ── Built-in effects ── -->
    <div class="sidebar__section-title">Effects</div>

    <div v-for="category in categories" :key="category" class="sidebar__group">
      <p class="sidebar__group-label">{{ category }}</p>
      <div
        v-for="effect in effects.filter((e) => e.category === category)"
        :key="effect.type"
        class="sidebar__effect"
        :class="{ 'sidebar__effect--added': activeTypes.has(effect.type) }"
        :draggable="!activeTypes.has(effect.type)"
        @dragstart="(e) => onDragStart(e, effect)"
      >
        <span class="sidebar__effect-label">{{ effect.label }}</span>
        <span class="sidebar__effect-desc">{{ effect.description }}</span>
      </div>
    </div>

    <!-- ── Installed plugins ── -->
    <div class="sidebar__divider" />
    <div class="sidebar__section-title">
      Installed Plugins
      <span v-if="scanning" class="sidebar__spinner" aria-label="Scanning…" />
    </div>

    <!-- No folders configured -->
    <p v-if="folders.length === 0" class="sidebar__hint">
      Add plugin folders in Settings.
    </p>

    <!-- Folders configured but none with access -->
    <p v-else-if="!hasFoldersWithAccess" class="sidebar__hint">
      Grant folder access in Settings to scan plugins.
    </p>

    <!-- Scanning done, nothing found -->
    <p v-else-if="!scanning && plugins.length === 0" class="sidebar__hint">
      No plugins found in the configured folders.
    </p>

    <!-- Plugin list grouped by format -->
    <template v-else>
      <div
        v-for="group in pluginsByFormat"
        :key="group.format"
        class="sidebar__group"
      >
        <p class="sidebar__group-label">{{ group.label }}</p>
        <div
          v-for="plugin in group.items"
          :key="plugin.id"
          class="sidebar__plugin"
          :title="plugin.path"
        >
          {{ plugin.name }}
        </div>
      </div>
    </template>

    <div v-if="isDropTarget" class="sidebar__drop-hint">Drop here to remove</div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 56px;
  bottom: 64px;
  left: 0;
  width: 240px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 90;
  overflow-y: auto;
  transition: background 0.2s, border-color 0.15s;
}

.sidebar--drop-target {
  border-right-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, var(--bg-surface));
}

/* ── Section titles ── */
.sidebar__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--text-1);
  border-bottom: 1px solid var(--border-faint);
}

.sidebar__divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

/* ── Groups ── */
.sidebar__group {
  padding: 10px 16px 4px;
}

.sidebar__group-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-3);
  margin: 0 0 6px;
}

/* ── Built-in effect items (draggable) ── */
.sidebar__effect {
  background: var(--bg-card);
  border: 1px solid var(--border-sub);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 5px;
  cursor: grab;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: border-color 0.15s;
  user-select: none;
}

.sidebar__effect:hover:not(.sidebar__effect--added) {
  border-color: #2e86de;
}

.sidebar__effect--added {
  opacity: 0.4;
  cursor: not-allowed;
}

.sidebar__effect-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.sidebar__effect-desc {
  font-size: 11px;
  color: var(--text-3);
}

/* ── Plugin entries (text-only) ── */
.sidebar__plugin {
  padding: 4px 0;
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
  border-bottom: 1px solid var(--border-faint);
}

.sidebar__plugin:last-child {
  border-bottom: none;
}

/* ── Hints & states ── */
.sidebar__hint {
  padding: 8px 16px;
  font-size: 11px;
  color: var(--text-4);
  margin: 0;
  line-height: 1.5;
}

.sidebar__spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg) }
}

.sidebar__drop-hint {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 12px;
  color: var(--danger);
}
</style>
