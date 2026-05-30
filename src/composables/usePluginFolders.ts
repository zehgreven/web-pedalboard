import { ref } from 'vue'
import { folderHandleStore } from '@/storage/local/FolderHandleStore'

export type FolderPermission = 'granted' | 'prompt' | 'denied' | 'unknown'

// ─── Shared state ─────────────────────────────────────────────────────────────

/** Represents a folder configured by the user. */
export interface PluginFolder {
  id: string
  /** Display name (folder basename or full path in Electron). */
  name: string
  /** Full path — only available in Electron. Undefined in browser mode. */
  path?: string
  /** Browser FileSystemDirectoryHandle — undefined in Electron. */
  handle?: FileSystemDirectoryHandle
  /** Always 'granted' in Electron (no permissions needed). */
  permission: FolderPermission
}

const folders = ref<PluginFolder[]>([])
const loaded  = ref(false)

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

// ─── Composable ───────────────────────────────────────────────────────────────
export function usePluginFolders() {

  // ── Electron path ──────────────────────────────────────────────────────────
  // Convenience alias — safe because this branch is only reached when isElectron is true.
  const api = () => window.electronAPI!

  async function loadElectron(): Promise<void> {
    if (loaded.value) return
    const paths = await api().folders.load()
    folders.value = toPaths(paths)
    loaded.value = true
  }

  async function addFolderElectron(): Promise<void> {
    const updated = await api().folders.add()
    if (!updated) return
    folders.value = toPaths(updated)
  }

  async function removeFolderElectron(id: string): Promise<void> {
    const updated = await api().folders.remove(id)
    folders.value = toPaths(updated)
  }

  // ── Browser path (FileSystemDirectoryHandle + IndexedDB) ───────────────────
  async function loadBrowser(): Promise<void> {
    if (loaded.value) return
    const persisted = await folderHandleStore.getAll()
    const resolved = await Promise.all(
      persisted.map(async (p) => {
        const permission = await queryPermission(p.handle)
        return { id: p.id, name: p.name, handle: p.handle, permission }
      }),
    )
    folders.value = resolved
    loaded.value = true
  }

  async function addFolderBrowser(): Promise<void> {
    if (!('showDirectoryPicker' in window)) {
      alert('Your browser does not support the File System Access API.\nTry Chrome or Edge.')
      return
    }

    let handle: FileSystemDirectoryHandle
    try {
      handle = await (window as typeof window & {
        showDirectoryPicker(opts?: { mode?: string }): Promise<FileSystemDirectoryHandle>
      }).showDirectoryPicker({ mode: 'read' })
    } catch {
      return // user cancelled
    }

    const id = crypto.randomUUID()
    const folder: PluginFolder = { id, name: handle.name, handle, permission: 'granted' }
    folders.value = [...folders.value, folder]
    await folderHandleStore.save({ id, name: handle.name, handle })
  }

  async function removeFolderBrowser(id: string): Promise<void> {
    folders.value = folders.value.filter((f) => f.id !== id)
    await folderHandleStore.remove(id)
  }

  async function requestPermission(folder: PluginFolder): Promise<void> {
    if (!folder.handle) return
    try {
      const state = await (folder.handle as FileSystemDirectoryHandle & {
        requestPermission(opts: { mode: string }): Promise<PermissionState>
      }).requestPermission({ mode: 'read' })

      folders.value = folders.value.map((f) =>
        f.id === folder.id ? { ...f, permission: state as FolderPermission } : f,
      )
    } catch {
      // not supported or denied
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  const load         = isElectron ? loadElectron         : loadBrowser
  const addFolder    = isElectron ? addFolderElectron    : addFolderBrowser
  const removeFolder = isElectron
    ? (id: string) => removeFolderElectron(id)
    : (id: string) => removeFolderBrowser(id)

  return { folders, loaded, load, addFolder, removeFolder, requestPermission }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toPaths(paths: string[]): PluginFolder[] {
  return paths.map((p) => ({
    id: p,
    name: p.split('/').pop() ?? p,
    path: p,
    permission: 'granted' as const,
  }))
}

async function queryPermission(handle: FileSystemDirectoryHandle): Promise<FolderPermission> {
  try {
    const state = await (handle as FileSystemDirectoryHandle & {
      queryPermission(opts: { mode: string }): Promise<PermissionState>
    }).queryPermission({ mode: 'read' })
    return state as FolderPermission
  } catch {
    return 'unknown'
  }
}
