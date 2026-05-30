import { ref } from 'vue'
import { folderHandleStore } from '@/storage/local/FolderHandleStore'

export type FolderPermission = 'granted' | 'prompt' | 'denied' | 'unknown'

export interface PluginFolder {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  permission: FolderPermission
}

const folders = ref<PluginFolder[]>([])
const loaded = ref(false)

export function usePluginFolders() {
  async function load(): Promise<void> {
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

  async function addFolder(): Promise<void> {
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
      // User cancelled
      return
    }

    const id = crypto.randomUUID()
    const folder: PluginFolder = {
      id,
      name: handle.name,
      handle,
      permission: 'granted',
    }

    folders.value = [...folders.value, folder]
    await folderHandleStore.save({ id, name: handle.name, handle })
  }

  async function removeFolder(id: string): Promise<void> {
    folders.value = folders.value.filter((f) => f.id !== id)
    await folderHandleStore.remove(id)
  }

  async function requestPermission(folder: PluginFolder): Promise<void> {
    try {
      const state = await (folder.handle as FileSystemDirectoryHandle & {
        requestPermission(opts: { mode: string }): Promise<PermissionState>
      }).requestPermission({ mode: 'read' })

      folders.value = folders.value.map((f) =>
        f.id === folder.id ? { ...f, permission: state as FolderPermission } : f,
      )
    } catch {
      // not supported or denied — leave as-is
    }
  }

  return { folders, loaded, load, addFolder, removeFolder, requestPermission }
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
