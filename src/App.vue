<script setup lang="ts">
import { usePedalboardStore } from '@/stores/pedalboard'
import type { EffectDefinition } from '@/types/audio'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AddEffectSidebar from '@/components/AddEffectSidebar.vue'

const store = usePedalboardStore()

function onEffectSelected(effect: EffectDefinition) {
  store.addNode({
    id: crypto.randomUUID(),
    type: effect.type,
    label: effect.label,
    enabled: true,
  })
}
</script>

<template>
  <AppHeader @open-settings="() => {}" />
  <AddEffectSidebar @add="onEffectSelected" />
  <RouterView />
  <AppFooter />
</template>
