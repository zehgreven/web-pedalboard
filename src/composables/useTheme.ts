import { ref, watch } from 'vue'

const STORAGE_KEY = 'theme'
type Theme = 'dark' | 'light'

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

watch(theme, (t) => {
  applyTheme(t)
  localStorage.setItem(STORAGE_KEY, t)
})

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggleTheme }
}
