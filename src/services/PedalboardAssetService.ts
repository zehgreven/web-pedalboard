import {
  assetStorageKey,
  getPedalboardStateStore,
  getUserAssetStore,
} from '@/storage'
import type { PersistedEffectNode, PersistedPedalboardState } from '@/storage/types'
import type { AudioNode, EffectType, IrFileRef, NamModelRef } from '@/types/audio'

export class PedalboardAssetService {
  private readonly blobUrls = new Map<string, string>()

  async saveAsset(
    nodeId: string,
    type: EffectType,
    file: File,
  ): Promise<NamModelRef | IrFileRef> {
    const key = assetStorageKey(type, nodeId)
    await getUserAssetStore().save(key, file)
    this.revokeUrl(key)

    const url = URL.createObjectURL(file)
    this.blobUrls.set(key, url)
    return { name: file.name, url }
  }

  async clearAsset(nodeId: string, type: EffectType): Promise<void> {
    const key = assetStorageKey(type, nodeId)
    await getUserAssetStore().delete(key)
    this.revokeUrl(key)
  }

  async persist(nodes: AudioNode[]): Promise<void> {
    const snapshot: PersistedPedalboardState = {
      version: 1,
      nodes: nodes.map((node) => this.toPersistedNode(node)),
    }
    await getPedalboardStateStore().save(snapshot)
  }

  async hydrate(): Promise<AudioNode[]> {
    const snapshot = await getPedalboardStateStore().load()
    if (!snapshot) return []

    const nodes: AudioNode[] = []

    for (const persisted of snapshot.nodes) {
      const asset = persisted.fileName
        ? await this.loadAssetRef(persisted.id, persisted.type, persisted.fileName)
        : null

      if (persisted.type === 'nam') {
        nodes.push({
          id: persisted.id,
          type: 'nam',
          label: persisted.label,
          enabled: persisted.enabled,
          model: asset,
        })
      } else {
        nodes.push({
          id: persisted.id,
          type: 'ir',
          label: persisted.label,
          enabled: persisted.enabled,
          ir: asset,
        })
      }
    }

    return nodes
  }

  revokeAll(): void {
    for (const key of this.blobUrls.keys()) {
      this.revokeUrl(key)
    }
  }

  private async loadAssetRef(
    nodeId: string,
    type: EffectType,
    fileName: string,
  ): Promise<NamModelRef | IrFileRef | null> {
    const key = assetStorageKey(type, nodeId)
    const blob = await getUserAssetStore().read(key)
    if (!blob) return null

    this.revokeUrl(key)
    const url = URL.createObjectURL(blob)
    this.blobUrls.set(key, url)
    return { name: fileName, url }
  }

  private toPersistedNode(node: AudioNode): PersistedEffectNode {
    const fileName =
      node.type === 'nam' ? (node.model?.name ?? null) : (node.ir?.name ?? null)

    return {
      id: node.id,
      type: node.type,
      label: node.label,
      enabled: node.enabled,
      fileName,
    }
  }

  private revokeUrl(key: string): void {
    const url = this.blobUrls.get(key)
    if (url) URL.revokeObjectURL(url)
    this.blobUrls.delete(key)
  }
}

export const pedalboardAssetService = new PedalboardAssetService()
