<template>
  <section :aria-label="$gettext('Memories')">
    <header class="ext:mb-4">
      <h2 class="ext:m-0 ext:text-lg ext:font-semibold ext:text-role-on-surface">
        {{ $gettext('Do you remember?') }}
      </h2>
      <p class="ext:m-0 ext:mt-1 ext:text-sm ext:text-role-on-surface-variant">
        {{ subtitle }}
      </p>
    </header>

    <div class="ext:rounded-xl ext:bg-role-surface-container">
      <div
        ref="scrollerEl"
        class="memory-scroller ext:flex ext:snap-x ext:gap-8 ext:overflow-x-auto ext:px-4 ext:pt-5 ext:pb-6"
      >
        <div
          v-for="group in visibleGroups"
          :key="group.year"
          class="ext:flex ext:shrink-0 ext:snap-start ext:gap-4"
        >
          <div
            class="ext:flex ext:w-14 ext:shrink-0 ext:flex-col ext:justify-center ext:gap-1 ext:border-l-2 ext:border-role-outline-variant ext:pl-3"
          >
            <span class="ext:font-mono ext:text-lg ext:font-semibold ext:text-role-on-surface">
              {{ group.year }}
            </span>
            <span class="ext:text-xs ext:leading-4 ext:text-role-on-surface-variant">
              {{ yearsAgoLabel(group.yearsAgo) }}
            </span>
          </div>
          <button
            v-for="photo in group.photos"
            :key="photo.id"
            type="button"
            class="ext:cursor-pointer ext:rounded-[3px] ext:border-0 ext:bg-transparent ext:p-0 ext:text-left ext:transition-transform ext:hover:-translate-y-0.5 ext:focus-visible:outline-2 ext:focus-visible:outline-role-primary"
            :aria-label="showInTimelineLabel(photo)"
            :title="$gettext('Show in timeline')"
            @click="emit('select', photo)"
          >
            <photo-print :photo="photo" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { MemoryGroup, Photo } from '../types'
import { MemoryMode } from '../composables/useMemories'
import PhotoPrint from './PhotoPrint.vue'

const { groups, mode } = defineProps<{
  groups: MemoryGroup[]
  mode: MemoryMode
}>()

const emit = defineEmits<{ select: [photo: Photo] }>()

// budget the polaroids so every year stays visible without scrolling:
// distribute the prints that fit round-robin across the groups
const PRINT_WIDTH = 192 // 160px photo + print padding + gap
const LABEL_WIDTH = 84 // year block incl. its gap
const GROUP_GAP = 32

const scrollerEl = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    containerWidth.value = entry.contentRect.width
  })
  if (scrollerEl.value) {
    resizeObserver.observe(scrollerEl.value)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())

const visibleGroups = computed(() => {
  const count = groups.length
  if (!count) {
    return []
  }
  const width = containerWidth.value || 1200
  const budget = Math.max(
    count,
    Math.floor((width - count * LABEL_WIDTH - (count - 1) * GROUP_GAP) / PRINT_WIDTH)
  )
  const perGroup = new Array<number>(count).fill(0)
  let remaining = budget
  let assignable = true
  while (remaining > 0 && assignable) {
    assignable = false
    for (let i = 0; i < count && remaining > 0; i++) {
      if (perGroup[i] < groups[i].photos.length) {
        perGroup[i]++
        remaining--
        assignable = true
      }
    }
  }
  return groups.map((group, i) => ({
    ...group,
    photos: group.photos.slice(0, Math.max(1, perGroup[i]))
  }))
})

const { $ngettext, $gettext, interpolate, current: currentLanguage } = useGettext()

const subtitle = computed(() => {
  if (mode === 'day') {
    return $gettext('On this day, over the years')
  }
  const month = new Date().toLocaleDateString(currentLanguage, { month: 'long' })
  return interpolate($gettext('In %{ month }, over the years'), { month })
})

function yearsAgoLabel(yearsAgo: number): string {
  return $ngettext('%{ n } year ago', '%{ n } years ago', yearsAgo, { n: String(yearsAgo) })
}

function showInTimelineLabel(photo: Photo): string {
  return interpolate($gettext('Show %{ name } in the timeline'), { name: photo.name })
}
</script>

<style scoped>
.memory-scroller {
  mask-image: linear-gradient(
    to right,
    transparent,
    black 8px,
    black calc(100% - 32px),
    transparent
  );
  scrollbar-width: thin;
}
</style>
