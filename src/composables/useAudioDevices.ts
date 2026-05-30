import { ref, watch } from 'vue'

export interface AudioDevice {
  deviceId: string
  label: string
}

const STORAGE_KEY_INPUT = 'audio:input:deviceId'
const STORAGE_KEY_OUTPUT = 'audio:output:deviceId'

const inputDevices = ref<AudioDevice[]>([])
const outputDevices = ref<AudioDevice[]>([])
const selectedInput = ref('')
const selectedOutput = ref('')

/** Persist selections whenever they change. */
watch(selectedInput, (id) => {
  if (id) localStorage.setItem(STORAGE_KEY_INPUT, id)
})
watch(selectedOutput, (id) => {
  if (id) localStorage.setItem(STORAGE_KEY_OUTPUT, id)
})

export function useAudioDevices() {
  async function loadDevices(): Promise<void> {
    // Permission must be granted before labels are available.
    await navigator.mediaDevices.getUserMedia({ audio: true })

    const devices = await navigator.mediaDevices.enumerateDevices()

    inputDevices.value = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }))

    outputDevices.value = devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }))

    selectedInput.value = resolveDevice(
      inputDevices.value,
      localStorage.getItem(STORAGE_KEY_INPUT),
    )
    selectedOutput.value = resolveDevice(
      outputDevices.value,
      localStorage.getItem(STORAGE_KEY_OUTPUT),
    )
  }

  return { inputDevices, outputDevices, selectedInput, selectedOutput, loadDevices }
}

/**
 * Returns the saved deviceId if it still exists in the list,
 * otherwise falls back to the first available device.
 */
function resolveDevice(devices: AudioDevice[], savedId: string | null): string {
  if (savedId && devices.some((d) => d.deviceId === savedId)) return savedId
  return devices[0]?.deviceId ?? ''
}
