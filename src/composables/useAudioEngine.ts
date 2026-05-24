import { ref } from 'vue'
import { AudioEngine } from '@/audio/engine/AudioEngine'

const engine = new AudioEngine()
const isRunning = ref(false)

export function useAudioEngine() {
  async function start(inputDeviceId: string): Promise<void> {
    await engine.start(inputDeviceId)
    isRunning.value = true
  }

  function stop(): void {
    engine.stop()
    isRunning.value = false
  }

  return { start, stop, isRunning }
}
