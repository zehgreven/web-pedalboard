<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AddEffectSidebar from '@/components/AddEffectSidebar.vue'
</script>

<template>
  <AppHeader @open-settings="() => {}" />
  <AddEffectSidebar />
  <RouterView />
  <AppFooter />
</template>
