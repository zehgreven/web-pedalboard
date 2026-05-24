import { ref } from 'vue'

export interface AudioDevice {
  deviceId: string
  label: string
}

const inputDevices = ref<AudioDevice[]>([])
const outputDevices = ref<AudioDevice[]>([])

export function useAudioDevices() {
  async function loadDevices(): Promise<void> {
    // Permission must be granted before labels are available
    await navigator.mediaDevices.getUserMedia({ audio: true })

    const devices = await navigator.mediaDevices.enumerateDevices()

    inputDevices.value = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }))

    outputDevices.value = devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }))
  }

  return { inputDevices, outputDevices, loadDevices }
}
