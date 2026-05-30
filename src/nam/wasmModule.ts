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

/**
 * Load the WASM script into the page.
 * Called once per page load — safe to call multiple times (no-op after first).
 * The module stays resident across Start/Stop cycles; only the AudioContext
 * is torn down on Stop and re-created by the next setDsp call.
 */
export async function loadWasmScript(): Promise<void> {
  if (wasmScriptLoaded) return

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
