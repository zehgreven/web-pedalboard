/**
 * Thin wrapper around the IPC preferences storage.
 * Provides a key-value API matching localStorage's interface so composables
 * can stay mostly unchanged.
 */

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

/** In-memory cache so that multiple reads in the same session are fast. */
let cache: Record<string, unknown> | null = null

async function loadCache(): Promise<Record<string, unknown>> {
  if (cache) return cache
  cache = isElectron
    ? await window.electronAPI!.storage.prefs.load()
    : {}
  return cache
}

async function flush(): Promise<void> {
  if (!isElectron || !cache) return
  await window.electronAPI!.storage.prefs.save(cache)
}

export const prefsStore = {
  async getItem(key: string): Promise<string | null> {
    if (!isElectron) return localStorage.getItem(key)
    const c = await loadCache()
    const v = c[key]
    return typeof v === 'string' ? v : null
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!isElectron) { localStorage.setItem(key, value); return }
    const c = await loadCache()
    c[key] = value
    await flush()
  },

  async removeItem(key: string): Promise<void> {
    if (!isElectron) { localStorage.removeItem(key); return }
    const c = await loadCache()
    delete c[key]
    await flush()
  },
}
