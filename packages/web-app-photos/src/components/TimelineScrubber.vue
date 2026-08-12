<template>
  <div
    ref="rail"
    class="ext:relative ext:flex ext:h-full ext:w-12 ext:touch-none ext:flex-col ext:py-2 ext:select-none"
    :aria-label="$gettext('Jump to month')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointerleave="hovering = false"
  >
    <button
      v-for="segment in segments"
      :key="segment.key"
      type="button"
      class="ext:relative ext:m-0 ext:min-h-0 ext:w-full ext:cursor-pointer ext:border-0 ext:bg-transparent ext:p-0"
      :style="{ flexGrow: segment.weight }"
      tabindex="-1"
    >
      <span
        v-if="segment.yearLabel"
        class="ext:absolute ext:top-0 ext:right-4 ext:text-[10px] ext:leading-3 ext:font-medium ext:text-role-on-surface-variant"
      >
        {{ segment.yearLabel }}
      </span>
      <span
        class="ext:absolute ext:top-1/2 ext:right-1.5 ext:h-1 ext:w-1 ext:-translate-y-1/2 ext:rounded-full ext:transition-transform"
        :class="
          segment.key === activeKey
            ? 'ext:bg-role-primary ext:scale-150'
            : 'ext:bg-role-outline-variant'
        "
      />
    </button>

    <!-- current scroll position, draggable like a scrollbar thumb -->
    <span
      class="ext:pointer-events-none ext:absolute ext:right-0.5 ext:h-6 ext:w-1.5 ext:-translate-y-1/2 ext:rounded-full ext:bg-role-primary"
      :style="{ top: thumbTop }"
    />

    <!-- month under the pointer while hovering or dragging -->
    <span
      v-if="pointerLabel"
      class="ext:pointer-events-none ext:absolute ext:right-full ext:mr-2 ext:-translate-y-1/2 ext:rounded-full ext:bg-role-inverse-surface ext:px-3 ext:py-1 ext:text-xs ext:font-medium ext:whitespace-nowrap ext:text-role-inverse-on-surface"
      :style="{ top: `${pointerY}px` }"
    >
      {{ pointerLabel }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { SECTION_FILL_LIMIT, TimelineSection } from '../composables/usePhotoTimeline'
import { monthYearLabel } from '../helpers'

const { sections, activeKey, position } = defineProps<{
  sections: TimelineSection[]
  activeKey: string | null
  /** current scroll position as a 0..1 fraction */
  position: number
}>()

const emit = defineEmits<{
  scrub: [fraction: number]
  scrubStart: []
  scrubEnd: []
}>()

const { $gettext, current: currentLanguage } = useGettext()

const rail = ref<HTMLElement | null>(null)
const dragging = ref(false)
const hovering = ref(false)
const pointerY = ref(0)

const segments = computed(() => {
  let previousYear = ''
  return sections.map((section) => {
    const year = section.key.slice(0, 4)
    const yearLabel = year !== previousYear ? year : undefined
    previousYear = year
    return {
      key: section.key,
      // proportional to what actually renders (the fill is capped), so the
      // rail maps linearly onto the content and dragging moves it at a
      // constant pace; the floor keeps tiny months hittable
      weight: Math.max(Math.min(section.count, SECTION_FILL_LIMIT), 8),
      yearLabel
    }
  })
})

const thumbTop = computed(() => `${(Math.min(Math.max(position, 0), 1) * 100).toFixed(3)}%`)

const pointerLabel = computed(() => {
  if (!dragging.value && !hovering.value) {
    return undefined
  }
  const key = segmentAtFraction(fractionAtY(pointerY.value))
  return key ? monthYearLabel(key, currentLanguage) : undefined
})

/** rail-relative y in px to a 0..1 fraction */
function fractionAtY(y: number): number {
  const el = rail.value
  if (!el) {
    return 0
  }
  return Math.min(Math.max(y / el.getBoundingClientRect().height, 0), 1)
}

/** maps a fraction onto the flex-grow weighted segment list */
function segmentAtFraction(fraction: number): string | undefined {
  if (!segments.value.length) {
    return undefined
  }
  const totalWeight = segments.value.reduce((sum, s) => sum + s.weight, 0)
  let cumulated = 0
  for (const segment of segments.value) {
    cumulated += segment.weight
    if (fraction <= cumulated / totalWeight) {
      return segment.key
    }
  }
  return segments.value[segments.value.length - 1].key
}

function railY(event: PointerEvent): number {
  const rect = rail.value?.getBoundingClientRect()
  if (!rect) {
    return 0
  }
  return Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
}

function onPointerDown(event: PointerEvent) {
  dragging.value = true
  rail.value?.setPointerCapture(event.pointerId)
  pointerY.value = railY(event)
  emit('scrubStart')
  emit('scrub', fractionAtY(pointerY.value))
}

function onPointerMove(event: PointerEvent) {
  pointerY.value = railY(event)
  if (event.pointerType === 'mouse') {
    hovering.value = true
  }
  if (dragging.value) {
    emit('scrub', fractionAtY(pointerY.value))
  }
}

function onPointerUp() {
  if (!dragging.value) {
    return
  }
  dragging.value = false
  emit('scrubEnd')
}

function onPointerCancel() {
  if (!dragging.value) {
    return
  }
  dragging.value = false
  emit('scrubEnd')
}
</script>
