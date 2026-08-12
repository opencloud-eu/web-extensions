<template>
  <div class="ext:relative ext:min-h-0 ext:flex-1">
    <div
      ref="scroller"
      class="photos-timeline-scroller ext:h-full ext:overflow-y-auto ext:pr-12"
      @scroll.passive="onScroll"
    >
      <div v-if="loading" class="ext:flex ext:justify-center ext:py-24">
        <oc-spinner size="medium" :aria-label="$gettext('Loading timeline')" />
      </div>

      <no-content-message v-else-if="!sections.length" icon="image" class="ext:py-16">
        <template #message>
          <span>{{ $gettext('No photos with a taken date found.') }}</span>
        </template>
      </no-content-message>

      <template v-else>
        <section
          v-for="section in sections"
          :key="section.key"
          :ref="(el) => setSectionEl(section.key, el as HTMLElement | null)"
          class="ext:mb-6"
        >
          <template v-if="section.photos !== null">
            <div v-for="group in dayGroups(section.photos)" :key="group.day">
              <h3
                class="ext:sticky ext:top-0 ext:z-10 ext:m-0 ext:bg-role-surface ext:py-2 ext:text-sm ext:font-semibold ext:text-role-on-surface"
              >
                {{ dayLabel(group.day, currentLanguage) }}
              </h3>
              <div class="ext:flex ext:flex-wrap ext:gap-0.5 ext:pb-2">
                <photo-tile
                  v-for="photo in group.photos"
                  :key="photo.id"
                  :photo="photo"
                  :attach="attachThumbnail"
                />
                <div class="ext:h-0 ext:grow-[999999]" />
              </div>
            </div>
            <p
              v-if="section.count > section.photos.length"
              class="ext:m-0 ext:pb-2 ext:text-xs ext:text-role-on-surface-variant"
            >
              {{ truncationLabel(section) }}
            </p>
          </template>
          <div v-else :style="{ minHeight: `${estimateHeight(section)}px` }">
            <div class="ext:flex ext:justify-center ext:py-10">
              <oc-spinner v-if="section.filling" size="small" :aria-label="$gettext('Loading')" />
            </div>
          </div>
        </section>
      </template>
    </div>

    <!-- z above the sticky day headers (z-10), the bubble reaches into the content area -->
    <div v-if="sections.length > 1" class="ext:absolute ext:top-0 ext:right-0 ext:bottom-0 ext:z-20">
      <timeline-scrubber
        :sections="sections"
        :active-key="activeKey"
        :position="scrollFraction"
        @scrub="onScrub"
        @scrub-start="scrubbing = true"
        @scrub-end="onScrubEnd"
      />
    </div>

    <div
      v-if="activeKey"
      class="ext:pointer-events-none ext:absolute ext:top-2 ext:right-14 ext:z-20 ext:rounded-full ext:bg-role-inverse-surface ext:px-3 ext:py-1 ext:text-xs ext:font-medium ext:text-role-inverse-on-surface ext:transition-opacity ext:duration-300"
      :class="scrolling && !scrubbing ? 'ext:opacity-100' : 'ext:opacity-0'"
    >
      {{ monthYearLabel(activeKey, currentLanguage) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import {
  SECTION_FILL_LIMIT,
  TimelineSection,
  usePhotoTimeline
} from '../composables/usePhotoTimeline'
import { MemoryPhoto } from '../types'
import { dayLabel, formatCount, groupPhotosByDay, monthYearLabel } from '../helpers'
import PhotoTile from './PhotoTile.vue'
import TimelineScrubber from './TimelineScrubber.vue'

const ROW_ESTIMATE_HEIGHT = 180
/** average justified tile incl. gap at ~4:3 and 176px row height */
const TILE_ESTIMATE_WIDTH = 240

const { query } = defineProps<{ query: string }>()
const emit = defineEmits<{ loaded: [total: number] }>()

const { $gettext, interpolate, current: currentLanguage } = useGettext()

const { sections, loading, total, load, fillSection, attachThumbnail } = usePhotoTimeline(
  () => query
)

const scroller = ref<HTMLElement | null>(null)
const activeKey = ref<string | null>(null)
const scrolling = ref(false)
const scrollFraction = ref(0)

const sectionEls = new Map<string, HTMLElement>()
let fillObserver: IntersectionObserver | undefined
// filling a section changes the content height without a scroll event; keep
// the scrubber thumb and the active month in sync anyway
let sectionResizeObserver: ResizeObserver | undefined

// while the scrubber is dragged, months fly past faster than anyone can look
// at them: hold the fills back and only load what is near the viewport once
// the drag settles
const scrubbing = ref(false)
const pendingFills = new Set<string>()
const FILL_MARGIN_PX = 2000

function setSectionEl(key: string, el: HTMLElement | null) {
  if (el) {
    sectionEls.set(key, el)
    el.dataset.sectionKey = key
    fillObserver?.observe(el)
    sectionResizeObserver?.observe(el)
  } else {
    const existing = sectionEls.get(key)
    if (existing) {
      fillObserver?.unobserve(existing)
      sectionResizeObserver?.unobserve(existing)
    }
    sectionEls.delete(key)
  }
}

function dayGroups(photos: MemoryPhoto[]) {
  return groupPhotosByDay(photos)
}

function estimateHeight(section: TimelineSection): number {
  // estimate with what will actually render: the fill is capped, and the
  // row count depends on the real container width. A big mismatch makes the
  // layout jump when the section fills.
  const rendered = Math.min(section.count, SECTION_FILL_LIMIT)
  const width = scroller.value?.clientWidth ?? 1200
  const perRow = Math.max(2, Math.floor(width / TILE_ESTIMATE_WIDTH))
  return Math.max(1, Math.ceil(rendered / perRow)) * ROW_ESTIMATE_HEIGHT
}

function truncationLabel(section: TimelineSection): string {
  return interpolate($gettext('Showing %{ shown } of %{ total } photos in this month'), {
    shown: formatCount(section.photos?.length ?? 0, currentLanguage),
    total: formatCount(section.count, currentLanguage)
  })
}

function onScrub(fraction: number) {
  const container = scroller.value
  if (!container) {
    return
  }
  container.scrollTop = fraction * (container.scrollHeight - container.clientHeight)
}

function onScrubEnd() {
  scrubbing.value = false
  const container = scroller.value
  for (const key of pendingFills) {
    const el = sectionEls.get(key)
    if (!el || !container) {
      continue
    }
    const nearViewport =
      el.offsetTop < container.scrollTop + container.clientHeight + FILL_MARGIN_PX &&
      el.offsetTop + el.offsetHeight > container.scrollTop - FILL_MARGIN_PX
    if (!nearViewport) {
      continue
    }
    const section = sections.value.find((s) => s.key === key)
    if (section) {
      fillSection(section)
    }
  }
  pendingFills.clear()
}

let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined
let scrollRaf: number | undefined

function onScroll() {
  scrolling.value = true
  clearTimeout(scrollIdleTimer)
  scrollIdleTimer = setTimeout(() => {
    scrolling.value = false
  }, 800)

  scheduleActiveSectionUpdate()
}

function scheduleActiveSectionUpdate() {
  if (scrollRaf) {
    return
  }
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = undefined
    updateActiveSection()
  })
}

function updateActiveSection() {
  const container = scroller.value
  if (!container) {
    return
  }
  const scrollable = container.scrollHeight - container.clientHeight
  scrollFraction.value = scrollable > 0 ? container.scrollTop / scrollable : 0
  const threshold = container.scrollTop + 80
  let current: string | null = null
  for (const section of sections.value) {
    const el = sectionEls.get(section.key)
    if (!el) {
      continue
    }
    if (el.offsetTop <= threshold) {
      current = section.key
    } else {
      break
    }
  }
  activeKey.value = current ?? sections.value[0]?.key ?? null
}

onMounted(async () => {
  fillObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue
        }
        const key = (entry.target as HTMLElement).dataset.sectionKey
        if (!key) {
          continue
        }
        if (scrubbing.value) {
          pendingFills.add(key)
          continue
        }
        const section = sections.value.find((s) => s.key === key)
        if (section) {
          fillSection(section)
        }
      }
    },
    { root: scroller.value, rootMargin: '2000px 0px' }
  )
  sectionResizeObserver = new ResizeObserver(scheduleActiveSectionUpdate)
  await load()
  emit('loaded', total.value)
  updateActiveSection()
})

watch(
  () => query,
  async () => {
    await load()
    emit('loaded', total.value)
  }
)

onBeforeUnmount(() => {
  fillObserver?.disconnect()
  sectionResizeObserver?.disconnect()
  clearTimeout(scrollIdleTimer)
  if (scrollRaf) {
    cancelAnimationFrame(scrollRaf)
  }
})
</script>
