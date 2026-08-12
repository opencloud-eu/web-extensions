<template>
  <div
    ref="rail"
    class="ext:flex ext:h-full ext:w-12 ext:touch-none ext:flex-col ext:py-2 ext:select-none"
    :aria-label="$gettext('Jump to month')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="dragging = false"
    @pointercancel="dragging = false"
  >
    <button
      v-for="segment in segments"
      :key="segment.key"
      type="button"
      class="ext:relative ext:m-0 ext:min-h-0 ext:w-full ext:cursor-pointer ext:border-0 ext:bg-transparent ext:p-0"
      :style="{ flexGrow: segment.weight }"
      :title="monthYearLabel(segment.key, currentLanguage)"
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { TimelineSection } from '../composables/usePhotoTimeline'
import { monthYearLabel } from '../helpers'

const { sections, activeKey } = defineProps<{
  sections: TimelineSection[]
  activeKey: string | null
}>()

const emit = defineEmits<{ jump: [key: string, smooth: boolean] }>()

const { $gettext, current: currentLanguage } = useGettext()

const rail = ref<HTMLElement | null>(null)
const dragging = ref(false)

const segments = computed(() => {
  let previousYear = ''
  return sections.map((section) => {
    const year = section.key.slice(0, 4)
    const yearLabel = year !== previousYear ? year : undefined
    previousYear = year
    return {
      key: section.key,
      // sqrt softens the spread so small months stay hittable
      weight: Math.max(Math.sqrt(section.count), 1),
      yearLabel
    }
  })
})

/** maps a pointer y position onto the flex-grow weighted segment list */
function segmentAt(clientY: number): string | undefined {
  const el = rail.value
  if (!el || !segments.value.length) {
    return undefined
  }
  const rect = el.getBoundingClientRect()
  const fraction = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1)
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

function onPointerDown(event: PointerEvent) {
  dragging.value = true
  rail.value?.setPointerCapture(event.pointerId)
  const key = segmentAt(event.clientY)
  if (key) {
    emit('jump', key, true)
  }
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) {
    return
  }
  const key = segmentAt(event.clientY)
  if (key) {
    emit('jump', key, false)
  }
}
</script>
