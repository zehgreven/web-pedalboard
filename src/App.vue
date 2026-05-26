<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AddEffectSidebar from '@/components/AddEffectSidebar.vue'
import { usePedalboardStore } from '@/stores/pedalboard'

const store = usePedalboardStore()

onMounted(() => {
  void store.hydrate()
})
</script>

<template>
  <AppHeader @open-settings="() => {}" />
  <AddEffectSidebar />
  <RouterView />
  <AppFooter />
</template>
