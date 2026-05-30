<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AddEffectSidebar from '@/components/AddEffectSidebar.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import { usePedalboardStore } from '@/stores/pedalboard'

const store = usePedalboardStore()
const settingsOpen = ref(false)

onMounted(() => {
  void store.hydrate()
})
</script>

<template>
  <AppHeader @open-settings="settingsOpen = true" />
  <AddEffectSidebar />
  <RouterView />
  <AppFooter />
  <SettingsModal v-if="settingsOpen" @close="settingsOpen = false" />
</template>
