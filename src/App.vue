<script setup lang="ts">
import { usePedalboardStore } from '@/stores/pedalboard'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'

const store = usePedalboardStore()

// Temporary: adds a placeholder node until the Add Effect panel is implemented
function onAddEffect() {
  store.addNode({
    id: crypto.randomUUID(),
    type: 'placeholder',
    label: 'New Effect',
    enabled: true,
  })
}
</script>

<template>
  <AppHeader @add-effect="onAddEffect" @open-settings="() => {}" />
  <RouterView />
  <AppFooter />
</template>
