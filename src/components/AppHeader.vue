<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

defineEmits<{ openSettings: [] }>()

const { theme, toggleTheme } = useTheme()
</script>

<template>
  <header class="app-header">
    <div class="app-header__brand">
      <span class="app-header__logo">🎸</span>
      <span class="app-header__title">Web Pedalboard</span>
    </div>

    <div class="app-header__actions">
      <button class="btn btn--ghost btn--icon" :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'" @click="toggleTheme">
        {{ theme === 'dark' ? '☀️' : '🌙' }}
      </button>
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
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 100;
  transition: background 0.2s, border-color 0.2s;
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
  color: var(--text-1);
  letter-spacing: 0.3px;
}

.app-header__actions {
  display: flex;
  gap: 8px;
  align-items: center;
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
  filter: brightness(1.15);
}

.btn--ghost {
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--border);
}

.btn--icon {
  padding: 6px 10px;
  font-size: 16px;
  line-height: 1;
}
</style>
