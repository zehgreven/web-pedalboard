<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    default?: number
    label: string
    /** Pixels of vertical drag needed to sweep the full range. */
    sensitivity?: number
    /** Custom value formatter. When provided, replaces the default ±% display. */
    formatValue?: (v: number) => string
    /** When true, the knob is visually dimmed and non-interactive. */
    disabled?: boolean
  }>(),
  { min: 0, max: 100, default: 50, sensitivity: 160, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

// ─── Geometry ───────────────────────────────────────────────────────────────

const SIZE = 44
const CX = SIZE / 2
const CY = SIZE / 2
const R = 17
const STROKE = 3
/** Knob sweeps 270°: from 225° to 135° (clockwise). In SVG, 0° = right. */
const START_ANGLE_DEG = 225
const SWEEP_DEG = 270

function polarPoint(angleDeg: number, r = R) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function arcPath(fromDeg: number, toDeg: number, r = R): string {
  const sweep = ((toDeg - fromDeg + 360) % 360)
  const from = polarPoint(fromDeg, r)
  const to = polarPoint(toDeg, r)
  const large = sweep > 180 ? 1 : 0
  return `M ${from.x} ${from.y} A ${r} ${r} 0 ${large} 1 ${to.x} ${to.y}`
}

const trackPath = computed(() =>
  arcPath(START_ANGLE_DEG, (START_ANGLE_DEG + SWEEP_DEG) % 360),
)

const valueDeg = computed(() => {
  const t = (props.modelValue - props.min) / (props.max - props.min)
  return (START_ANGLE_DEG + t * SWEEP_DEG) % 360
})

const valuePath = computed(() => {
  if (props.modelValue <= props.min) return ''
  return arcPath(START_ANGLE_DEG, valueDeg.value)
})

const indicatorEnd = computed(() => polarPoint(valueDeg.value, R - 4))

// ─── Drag ────────────────────────────────────────────────────────────────────

const isDragging = ref(false)
let dragStartY = 0
let dragStartValue = 0

function onPointerDown(e: PointerEvent) {
  if (props.disabled) return
  isDragging.value = true
  dragStartY = e.clientY
  dragStartValue = props.modelValue
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  const deltaY = dragStartY - e.clientY
  const range = props.max - props.min
  const delta = (deltaY / props.sensitivity) * range
  const next = Math.min(props.max, Math.max(props.min, dragStartValue + delta))
  emit('update:modelValue', Math.round(next))
}

function onPointerUp() {
  isDragging.value = false
}

function onDoubleClick() {
  if (props.disabled) return
  emit('update:modelValue', props.default ?? props.min)
}

// ─── Display value ───────────────────────────────────────────────────────────

const displayValue = computed(() => {
  if (props.formatValue) return props.formatValue(props.modelValue)
  const v = props.modelValue
  if (v === 50) return '—'
  const pct = Math.round((v / 50 - 1) * 100)
  return pct > 0 ? `+${pct}%` : `${pct}%`
})
</script>

<template>
  <div class="knob" :class="{ 'knob--dragging': isDragging, 'knob--disabled': disabled }">
    <svg
      class="knob__svg"
      :width="SIZE"
      :height="SIZE"
      :viewBox="`0 0 ${SIZE} ${SIZE}`"
      role="slider"
      :aria-label="label"
      :aria-valuenow="modelValue"
      :aria-valuemin="min"
      :aria-valuemax="max"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="onDoubleClick"
    >
      <!-- Outer ring -->
      <circle :cx="CX" :cy="CY" :r="R + STROKE / 2 + 1" fill="#1a1a1a" />

      <!-- Full-range track -->
      <path
        :d="trackPath"
        fill="none"
        stroke="#2e2e2e"
        :stroke-width="STROKE"
        stroke-linecap="round"
      />

      <!-- Value arc -->
      <path
        v-if="valuePath"
        :d="valuePath"
        fill="none"
        stroke="#e67e22"
        :stroke-width="STROKE"
        stroke-linecap="round"
      />

      <!-- Knob body -->
      <circle :cx="CX" :cy="CY" :r="R - STROKE - 1" fill="#2a2a2a" />

      <!-- Indicator dot -->
      <circle :cx="indicatorEnd.x" :cy="indicatorEnd.y" r="2" fill="#e67e22" />
    </svg>

    <span class="knob__label">{{ label }}</span>
    <span class="knob__value">{{ displayValue }}</span>
  </div>
</template>

<style scoped>
.knob {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  user-select: none;
}

.knob__svg {
  cursor: ns-resize;
  touch-action: none;
  transition: filter 0.15s;
}

.knob--dragging .knob__svg,
.knob__svg:hover {
  filter: brightness(1.25);
}

.knob--disabled {
  opacity: 0.35;
  pointer-events: none;
}

.knob__label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  text-align: center;
}

.knob__value {
  font-size: 10px;
  color: #bbb;
  text-align: center;
  min-width: 32px;
}
</style>
