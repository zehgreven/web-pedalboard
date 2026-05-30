/**
 * Persists FileSystemDirectoryHandle objects in IndexedDB.
 * Handles survive page reloads but require the user to re-grant permission
 * on the next visit (browser security model).
 */

const DB_NAME = 'pedalboard-folders'
const STORE_NAME = 'folders'
const DB_VERSION = 1

export interface PersistedFolder {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const folderHandleStore = {
  async getAll(): Promise<PersistedFolder[]> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result as PersistedFolder[])
      req.onerror = () => reject(req.error)
    })
  },

  async save(folder: PersistedFolder): Promise<void> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(folder)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  async remove(id: string): Promise<void> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },
}
