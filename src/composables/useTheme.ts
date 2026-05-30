import { ref, watch } from 'vue'
import { prefsStore } from '@/storage/electron/ElectronPreferencesStore'

const STORAGE_KEY = 'theme'
type Theme = 'dark' | 'light'

// Read initial theme synchronously from localStorage (works in both browser and
// Electron before preferences are loaded async). Electron will sync on first write.
const theme = ref<Theme>((localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark')

function applyTheme(t: Theme) {
  if (t === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

// Apply immediately (before first render).
applyTheme(theme.value)

// Load from native prefs on first use (async — Electron only).
prefsStore.getItem(STORAGE_KEY).then((saved) => {
  if (saved && saved !== theme.value) {
    theme.value = saved as Theme
  }
})

watch(theme, (t) => {
  applyTheme(t)
  // Persist to both localStorage (instant, browser) and native prefs (Electron).
  localStorage.setItem(STORAGE_KEY, t)
  prefsStore.setItem(STORAGE_KEY, t)
})

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggleTheme }
}
