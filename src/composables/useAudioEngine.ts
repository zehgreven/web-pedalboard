import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { AudioEngine } from '@/audio/engine/AudioEngine'
import { usePedalboardStore } from '@/stores/pedalboard'

const engine = new AudioEngine()
const isRunning = ref(false)
let operationId = 0

export function useAudioEngine() {
  const pedalboard = usePedalboardStore()
  const { nodes } = storeToRefs(pedalboard)

  watch(
    nodes,
    async () => {
      if (!isRunning.value) return

      const op = operationId
      try {
        await engine.syncChain(nodes.value)
      } catch (error) {
        if (op === operationId && isRunning.value) {
          console.error('Failed to sync signal chain:', error)
        }
      }
    },
    { deep: true },
  )

  async function start(inputDeviceId: string, outputDeviceId = ''): Promise<void> {
    await engine.start(inputDeviceId, outputDeviceId || undefined, nodes.value)
    isRunning.value = true
  }

  async function stop(): Promise<void> {
    operationId++
    isRunning.value = false
    await engine.stop()
  }

  return { start, stop, isRunning }
}
