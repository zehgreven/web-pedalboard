<script setup lang="ts">
import type { PluginAudioNode } from '@/types/audio'

defineProps<{ node: PluginAudioNode }>()

const FORMAT_COLOR: Record<string, string> = {
  vst3: '#2e86de',
  vst:  '#8e44ad',
  lv2:  '#27ae60',
  ladspa: '#e67e22',
}
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
    <p class="plugin-effect__note">Native plugin — audio pass-through only</p>
  </div>
</template>

<style scoped>
.plugin-effect {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  text-align: center;
}

.plugin-effect__badge {
  display: inline-block;
  padding: 2px 8px;
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
}

.plugin-effect__note {
  margin: 0;
  font-size: 10px;
  color: var(--text-4);
  font-style: italic;
}
</style>
