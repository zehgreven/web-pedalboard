# UI Sketch — Web Pedalboard

## Layout Overview

The app is a single-page layout divided into three vertical zones:

- Top: toolbar / header
- Middle: pedalboard canvas (main area)
- Bottom: signal chain controls and transport

---

## Main Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│  🎸 Web Pedalboard                          [+ Add Effect]  [⚙ Settings]  │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  INPUT ──►  [NAM Capture] ──► [IR Loader] ──► [EQ] ──►  OUTPUT            │
│             │                 │               │                           │
│             └── drag to       └── drag to     └── drag to                 │
│                 reorder           reorder         reorder                 │
│                                                                           │
│  [ Drop effects here or click "+ Add Effect" ]                            │
│                                                                           │
├───────────────────────────────────────────────────────────────────────────┤
│  🎤 INPUT: [Browser Mic ▼]    🔊 OUTPUT: [Default ▼]   [▶ Start]          │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Effect Card (each pedal in the chain)

Each effect is represented as a card on the pedalboard canvas:

```
┌──────────────────────┐
│  NAM Capture    [ON] │  ← toggle bypass
│ ──────────────────── │
│  Model: [my-amp.nam] │  ← file picker
│                      │
│  Gain   ──●──────    │  ← knob / slider
│  Level  ────●────    │
│                      │
│  [⠿ drag]  [🗑 remove]│
└──────────────────────┘
```

---

## Add Effect Panel (modal or sidebar)

Triggered by "+ Add Effect" button:

```
┌─────────────────────────────┐
│  Add Effect                 │
│ ─────────────────────────── │
│  🔍 Search...               │
│                             │
│  ▸ Amp Sims                 │
│      NAM Capture            │
│                             │
│  ▸ Cabinet                  │
│      IR Loader              │
│                             │
│  ▸ Dynamics                 │
│      Compressor             │
│                             │
│  ▸ EQ                       │
│      Graphic EQ             │
│      Parametric EQ          │
│                             │
│  ▸ Plugins (CLAP/VST)       │
│      [Load plugin file...]  │
│                             │
└─────────────────────────────┘
```

---

## Settings Panel

```
┌─────────────────────────────┐
│  Settings                   │
│ ─────────────────────────── │
│  Audio Input                │
│    Device:  [Browser Mic ▼] │
│    Latency: [Low ▼]         │
│                             │
│  Audio Output               │
│    Device:  [Default ▼]     │
│                             │
│  Buffer Size: [256 ▼]       │
│  Sample Rate: [48000 ▼]     │
└─────────────────────────────┘
```

---

## UX Notes

- The pedalboard canvas scrolls horizontally when there are many effects
- Effects are reordered via drag-and-drop (left ↔ right = signal order)
- Each card has a visible bypass toggle (green = active, grey = bypassed)
- INPUT and OUTPUT anchors are always visible and fixed at both ends of the chain
- The transport bar (bottom) is always visible regardless of scroll position
- "+ Add Effect" opens a categorized panel, not a full-page navigation
