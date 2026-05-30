import { ref, watch } from 'vue'
import { usePluginFolders } from '@/composables/usePluginFolders'
import type { PluginFormat } from '@/types/audio'

export type { PluginFormat }

export interface FoundPlugin {
  id: string
  name: string
  format: PluginFormat
  /** Relative path from the root folder, e.g. "Instruments/MyAmp.vst3" */
  path: string
}

const MAX_DEPTH = 5
const EXTENSION_MAP: Record<string, PluginFormat> = {
  '.vst3': 'vst3',
  '.vst': 'vst',
  '.lv2': 'lv2',
}

/** Returns the format for a given entry name, or null if not a plugin. */
function detectFormat(name: string, kind: 'file' | 'directory'): PluginFormat | null {
  const lower = name.toLowerCase()

  // Directory-based bundles: .vst3, .lv2, .vst (on macOS)
  if (kind === 'directory') {
    for (const [ext, fmt] of Object.entries(EXTENSION_MAP)) {
      if (lower.endsWith(ext)) return fmt
    }
    return null
  }

  // File-based
  if (lower.endsWith('.vst3')) return 'vst3'
  if (lower.endsWith('.vst')) return 'vst'
  if (lower.endsWith('.so')) return 'ladspa' // LADSPA on Linux
  if (lower.endsWith('.dll')) return 'vst'   // VST on Windows

  return null
}

async function scanDir(
  handle: FileSystemDirectoryHandle,
  relativePath: string,
  depth: number,
  results: FoundPlugin[],
): Promise<void> {
  if (depth > MAX_DEPTH) return

  for await (const [name, entry] of (handle as AsyncIterable<[string, FileSystemHandle]>)) {
    const entryPath = relativePath ? `${relativePath}/${name}` : name
    const format = detectFormat(name, entry.kind)

    if (format) {
      results.push({
        id: `${handle.name}::${entryPath}`,
        name: name.replace(/\.(vst3?|lv2|so|dll)$/i, ''),
        format,
        path: entryPath,
      })
      // Don't recurse into plugin bundles themselves.
      continue
    }

    if (entry.kind === 'directory') {
      await scanDir(entry as FileSystemDirectoryHandle, entryPath, depth + 1, results)
    }
  }
}

// ─── Singleton state ─────────────────────────────────────────────────────────

const plugins = ref<FoundPlugin[]>([])
const scanning = ref(false)
const scanError = ref('')

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

export function usePluginScanner() {
  const { folders } = usePluginFolders()

  async function scan(): Promise<void> {
    const grantedFolders = folders.value.filter((f) => f.permission === 'granted')
    if (grantedFolders.length === 0) {
      plugins.value = []
      return
    }

    scanning.value = true
    scanError.value = ''

    try {
      if (isElectron) {
        // Use Node.js fs via IPC — no permission dialogs needed.
        const paths = grantedFolders.map((f) => f.path!).filter(Boolean)
        plugins.value = await window.electronAPI.folders.scan(paths)
      } else {
        // Browser path: iterate FileSystemDirectoryHandle entries.
        const results: FoundPlugin[] = []
        for (const folder of grantedFolders) {
          await scanDir(folder.handle!, '', 0, results)
        }
        plugins.value = results
      }
    } catch (e) {
      scanError.value = e instanceof Error ? e.message : 'Scan failed'
    } finally {
      scanning.value = false
    }
  }

  // Re-scan whenever folder list or permissions change.
  watch(folders, scan, { deep: true })

  return { plugins, scanning, scanError, scan }
}
