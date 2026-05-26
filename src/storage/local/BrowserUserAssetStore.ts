import type { UserAssetStore } from '@/storage/types'

const DB_NAME = 'web-pedalboard-assets'
const DB_VERSION = 1
const STORE_NAME = 'files'

/**
 * Browser-local binary storage via IndexedDB.
 * IndexedDB fits audio/NAM files better than localStorage quotas; the interface
 * stays swappable for a remote backend later.
 */
export class BrowserUserAssetStore implements UserAssetStore {
  private dbPromise: Promise<IDBDatabase> | null = null

  async save(key: string, file: File | Blob): Promise<void> {
    const db = await this.openDb()
    await this.runTransaction(db, 'readwrite', (store) => store.put(file, key))
  }

  async read(key: string): Promise<Blob | null> {
    const db = await this.openDb()
    const result = await this.runTransaction<Blob | undefined>(db, 'readonly', (store) =>
      store.get(key),
    )
    return result ?? null
  }

  async delete(key: string): Promise<void> {
    const db = await this.openDb()
    await this.runTransaction(db, 'readwrite', (store) => store.delete(key))
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    })

    return this.dbPromise
  }

  private runTransaction<T>(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      const store = tx.objectStore(STORE_NAME)
      const request = fn(store)

      request.onsuccess = () => resolve(request.result as T)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    })
  }
}
