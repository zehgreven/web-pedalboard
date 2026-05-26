import { ref } from 'vue'
import { pedalboardAssetService } from '@/services/PedalboardAssetService'
import { usePedalboardStore } from '@/stores/pedalboard'
import type { EffectType } from '@/types/audio'

export function useEffectAsset(nodeId: string, type: EffectType) {
  const store = usePedalboardStore()
  const error = ref('')
  const loading = ref(false)

  async function saveFile(file: File, validate: (name: string) => string | null): Promise<void> {
    error.value = ''
    const validationError = validate(file.name)
    if (validationError) {
      error.value = validationError
      return
    }

    loading.value = true
    try {
      const assetRef = await pedalboardAssetService.saveAsset(nodeId, type, file)
      if (type === 'nam') {
        await store.setNamModel(nodeId, assetRef)
      } else {
        await store.setIrFile(nodeId, assetRef)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save file'
    } finally {
      loading.value = false
    }
  }

  async function clearAsset(): Promise<void> {
    error.value = ''
    loading.value = true
    try {
      await pedalboardAssetService.clearAsset(nodeId, type)
      if (type === 'nam') {
        await store.setNamModel(nodeId, null)
      } else {
        await store.setIrFile(nodeId, null)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to clear file'
    } finally {
      loading.value = false
    }
  }

  return { error, loading, saveFile, clearAsset }
}
