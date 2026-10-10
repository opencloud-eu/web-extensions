<template>
  <p
    v-if="!curves && !stroke"
    class="ext:pointer-events-none ext:absolute ext:inset-0 ext:m-0 ext:flex ext:items-center ext:justify-center ext:pb-6 ext:text-sm ext:text-gray-500"
    v-text="$gettext('Draw your signature here')"
  />
  <svg
    ref="drawArea"
    class="pdf-studio-signature-draw ext:absolute ext:inset-0 ext:size-full ext:cursor-crosshair ext:touch-none"
    :aria-label="$gettext('Draw your signature here')"
    role="img"
    @pointerdown="startStroke"
    @pointermove="continueStroke"
    @pointerup="endStroke"
    @pointercancel="endStroke"
  >
    <path
      :d="path"
      fill="none"
      stroke="black"
      stroke-width="2"
      stroke-linecap="round"
      pointer-events="none"
    />
  </svg>
  <oc-button
    v-oc-tooltip="$gettext('Clear')"
    class="pdf-studio-signature-clear ext:absolute ext:top-2 ext:right-2 ext:p-1.5"
    :aria-label="$gettext('Clear')"
    appearance="raw"
    :disabled="!curves"
    @click="curves = undefined"
  >
    <oc-icon name="eraser" fill-type="line" size-class="ext:size-4" color="#4b5563" />
  </oc-button>
</template>

<script setup lang="ts">
import { computed, ref, unref, useTemplateRef } from 'vue'
import type { DrawnCurves } from '../composables/usePdfSignature'

// The strokes, collected the way PDF.js' signature dialog does.
const curves = defineModel<DrawnCurves>()
// The stroke being drawn, added to the strokes once it ends.
const stroke = ref<number[]>()

const drawArea = useTemplateRef<SVGSVGElement>('drawArea')

function toPath(points: number[]) {
  let path = ''
  for (let i = 0; i < points.length; i += 2) {
    path += `${i ? ' L' : ' M'} ${points[i]} ${points[i + 1]}`
  }
  return path
}

const path = computed(() =>
  [...(unref(curves)?.curves ?? []), { points: unref(stroke) ?? [] }]
    .map(({ points }) => toPath(points))
    .join('')
)

function startStroke(event: PointerEvent) {
  // Keeps the stroke going when the pointer leaves the area.
  unref(drawArea).setPointerCapture(event.pointerId)
  stroke.value = [Math.round(event.offsetX), Math.round(event.offsetY)]
}

function continueStroke(event: PointerEvent) {
  unref(stroke)?.push(Math.round(event.offsetX), Math.round(event.offsetY))
}

function endStroke() {
  const points = unref(stroke)
  if (!points) {
    return
  }
  stroke.value = undefined
  const { width, height } = unref(drawArea).getBoundingClientRect()
  const drawn = unref(curves) ?? { width, height, thickness: 2, curves: [] }
  curves.value = { ...drawn, curves: [...drawn.curves, { points }] }
}
</script>
