<script setup lang="ts">
defineEmits<{
  openSettings: []
}>()
</script>

<template>
  <header class="app-header">
    <div class="app-header__brand">
      <span class="app-header__logo">🎸</span>
      <span class="app-header__title">Web Pedalboard</span>
    </div>

    <div class="app-header__actions">
      <button class="btn btn--ghost" @click="$emit('openSettings')">⚙ Settings</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 100;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-header__logo {
  font-size: 22px;
}

.app-header__title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.3px;
}

.app-header__actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 7px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: filter 0.15s;
}

.btn:hover {
  filter: brightness(1.2);
}

.btn--ghost {
  background: transparent;
  color: #ccc;
  border: 1px solid #444;
}
</style>
