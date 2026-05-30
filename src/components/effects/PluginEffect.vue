<script setup lang="ts">
import { ref } from 'vue'
import type { PluginAudioNode } from '@/types/audio'
import PluginUIModal from '@/components/PluginUIModal.vue'

defineProps<{ node: PluginAudioNode }>()

const FORMAT_COLOR: Record<string, string> = {
  vst3:   '#2e86de',
  vst:    '#8e44ad',
  lv2:    '#27ae60',
  ladspa: '#e67e22',
}

const modalOpen = ref(false)
</script>

<template>
  <div class="plugin-effect">
    <span
      class="plugin-effect__badge"
      :style="{ background: FORMAT_COLOR[node.format] ?? '#555' }"
    >
      {{ node.format.toUpperCase() }}
    </span>

    <p class="plugin-effect__name" :title="node.pluginPath">{{ node.pluginName }}</p>

    <button class="plugin-effect__open-btn" @click.stop="modalOpen = true">
      Open UI
    </button>

    <PluginUIModal
      v-if="modalOpen"
      :node="node"
      :format-color="FORMAT_COLOR[node.format] ?? '#555'"
      @close="modalOpen = false"
    />
  </div>
</template>

<style scoped>
.plugin-effect {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  text-align: center;
}

.plugin-effect__badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #fff;
}

.plugin-effect__name {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  word-break: break-word;
  max-width: 150px;
}

.plugin-effect__open-btn {
  padding: 4px 14px;
  border-radius: 6px;
  border: 1px solid var(--border-sub);
  background: var(--bg-card);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.plugin-effect__open-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
