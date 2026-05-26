import type { NamWasmModule } from '@/nam/types'

const WASM_SCRIPT_SRC = '/t3k-wasm-module.js'

let cachedModulePromise: Promise<NamWasmModule> | null = null
let wasmScriptLoaded = false

export function loadWasmModule(): Promise<NamWasmModule> {
  if (cachedModulePromise) return cachedModulePromise

  cachedModulePromise = new Promise((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 100

    const interval = setInterval(() => {
      attempts++
      const module = window.Module

      if (module) {
        const hasRequiredFunctions =
          typeof module._malloc === 'function' &&
          typeof module.stringToUTF8 === 'function' &&
          typeof module.ccall === 'function'
        const runtimeReady =
          module.runtimeInitialized === true || Boolean(module.wasmMemory)

        if (hasRequiredFunctions && runtimeReady) {
          try {
            const ptr = module._malloc(1)
            if (ptr !== 0) module._free(ptr)
            resolve(module)
            clearInterval(interval)
            return
          } catch {
            // runtime not fully ready yet
          }
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval)
        cachedModulePromise = null
        reject(new Error('Failed to load WASM module — timeout'))
      }
    }, 100)
  })

  return cachedModulePromise
}

export function resetWasmModuleCache(): void {
  cachedModulePromise = null
}

/** Full teardown so a subsequent Start can reload the WASM runtime cleanly. */
export function resetWasmRuntime(): void {
  resetWasmModuleCache()
  wasmScriptLoaded = false
  window.wasmAudioWorkletCreated = undefined
  delete window.Module
  document.querySelectorAll(`script[src="${WASM_SCRIPT_SRC}"]`).forEach((el) => el.remove())
}

export async function loadWasmScript(): Promise<void> {
  if (wasmScriptLoaded && window.Module) return

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = WASM_SCRIPT_SRC
    script.async = true
    script.onload = () => {
      wasmScriptLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load t3k-wasm-module.js'))
    document.body.appendChild(script)
  })
}
