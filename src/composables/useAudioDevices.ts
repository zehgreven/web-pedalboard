import { ref, watch } from 'vue'
import { prefsStore } from '@/storage/electron/ElectronPreferencesStore'

export interface AudioDevice {
  deviceId: string
  label: string
}

const STORAGE_KEY_INPUT  = 'audio:input:deviceId'
const STORAGE_KEY_OUTPUT = 'audio:output:deviceId'

const inputDevices  = ref<AudioDevice[]>([])
const outputDevices = ref<AudioDevice[]>([])
const selectedInput  = ref('')
const selectedOutput = ref('')

/** Persist selections whenever they change. */
watch(selectedInput, (id) => {
  if (id) prefsStore.setItem(STORAGE_KEY_INPUT, id)
})
watch(selectedOutput, (id) => {
  if (id) prefsStore.setItem(STORAGE_KEY_OUTPUT, id)
})

export function useAudioDevices() {
  async function loadDevices(): Promise<void> {
    await navigator.mediaDevices.getUserMedia({ audio: true })

    const devices = await navigator.mediaDevices.enumerateDevices()

    inputDevices.value = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }))

    outputDevices.value = devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }))

    const [savedIn, savedOut] = await Promise.all([
      prefsStore.getItem(STORAGE_KEY_INPUT),
      prefsStore.getItem(STORAGE_KEY_OUTPUT),
    ])

    selectedInput.value  = resolveDevice(inputDevices.value, savedIn)
    selectedOutput.value = resolveDevice(outputDevices.value, savedOut)
  }

  return { inputDevices, outputDevices, selectedInput, selectedOutput, loadDevices }
}

function resolveDevice(devices: AudioDevice[], savedId: string | null): string {
  if (savedId && devices.some((d) => d.deviceId === savedId)) return savedId
  return devices[0]?.deviceId ?? ''
}
