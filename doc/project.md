# Web Pedalboard

A browser-based guitar and bass effects pedalboard that runs entirely in the web browser, with no installation required.

## Target Audience

Guitarists and bassists of all levels who want a flexible, accessible effects solution — whether for home practice, home studio recording, or live performance.

## Goals

- Deliver a low-latency, real-time audio processing experience in the browser
- Support industry-standard formats (NAM, IR, CLAP/VST via WASM) so users can bring their own captures and plugins
- Keep the codebase clean, modular, and easy to maintain — optimized for a small team or solo developer
- Design with future commercialization in mind: easy onboarding for new contributors, clear architecture, and good test coverage

## Core Features

### NAM Captures
- Load and run `.nam` neural amp model files directly in the browser
- Powered by a WebAssembly port of the NAM inference engine
- Users can upload their own captures or choose from a built-in library

### IR Loader
- Load impulse response files (`.wav`) for cabinet simulation
- Real-time convolution via the Web Audio API (`ConvolverNode`)
- Support for stereo and mono IRs

### Plugin Support
- Run CLAP and VST plugins compiled to WebAssembly
- Plugin host abstraction layer to normalize differences between formats
- Plugin discovery and management UI

### Signal Chain
- Drag-and-drop pedalboard interface to arrange effects in any order
- Each effect is an isolated, testable audio processing unit
- Bypass, gain staging, and wet/dry mix controls per unit

## Technical Constraints

- Must run entirely in the browser — no server-side audio processing
- Audio engine built on the Web Audio API and AudioWorklet
- WebAssembly used for CPU-intensive processing (NAM inference, plugin hosting)
- Low latency is a priority: target < 10ms round-trip on modern hardware

## Stack

- **Framework:** Vue 3
- **Build tool:** Vite
- **Language:** TypeScript
- **Testing:** Vitest + Vue Test Utils
- **Audio engine:** Web Audio API + AudioWorklet
- **WASM integration:** Emscripten-compiled modules loaded via Vite's WASM support

## Non-Goals (for now)

- Mobile / touch-first UI (may be added later)
- Server-side audio processing
- Internationalization (planned for a future phase)
- Cloud storage or user accounts (planned for a future phase)
