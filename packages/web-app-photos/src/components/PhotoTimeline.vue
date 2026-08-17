<template>
  <div ref="rootEl" class="ext:relative ext:min-h-0 ext:flex-1">
    <div
      ref="scroller"
      class="photos-timeline-scroller ext:h-full ext:overflow-y-auto ext:pr-12"
      @scroll.passive="onScroll"
    >
      <div ref="leadingEl"><slot name="leading" /></div>

      <div v-if="loading" class="ext:flex ext:justify-center ext:py-24">
        <oc-spinner size="medium" :aria-label="$gettext('Loading timeline')" />
      </div>

      <div
        v-else-if="error"
        class="ext:flex ext:flex-col ext:items-center ext:gap-3 ext:py-16 ext:text-sm ext:text-role-on-surface-variant"
      >
        <span>{{ $gettext('The timeline could not be loaded.') }}</span>
        <oc-button @click="retry">{{ $gettext('Try again') }}</oc-button>
      </div>

      <no-content-message v-else-if="!sections.length" icon="image" class="ext:py-16">
        <template #message>
          <span>{{
            filtered
              ? $gettext('No photos match the current filter.')
              : $gettext('No photos with a taken date found.')
          }}</span>
        </template>
      </no-content-message>

      <template v-else>
        <section
          v-for="section in sections"
          :key="section.key"
          :ref="(el) => setSectionEl(section.key, el as HTMLElement | null)"
          class="ext:mb-6"
          :style="sectionStyle(section)"
        >
          <timeline-month
            :section="section"
            :attach="attachThumbnail"
            :estimated-height="estimateHeight(section)"
            @open="openPhoto"
          />
        </section>
      </template>
    </div>

    <!-- z above the sticky day headers, the bubble reaches into the content area -->
    <div
      v-if="sections.length > 1"
      class="ext:absolute ext:top-0 ext:right-0 ext:bottom-0 ext:z-20"
    >
      <timeline-scrubber
        :sections="sections"
        :active-key="activeKey"
        :position="scrollPosition"
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

    <transition name="photos-fade">
      <button
        v-if="showBackToTop"
        type="button"
        class="ext:absolute ext:bottom-4 ext:right-14 ext:z-20 ext:flex ext:size-10 ext:cursor-pointer ext:items-center ext:justify-center ext:rounded-full ext:border-0 ext:bg-role-inverse-surface ext:text-role-inverse-on-surface ext:shadow-md ext:hover:opacity-90"
        :aria-label="$gettext('Back to top')"
        :title="$gettext('Back to top')"
        @click="backToTop"
      >
        <oc-icon name="arrow-up" fill-type="line" />
      </button>
    </transition>

    <photo-lightbox
      v-if="lightboxPhoto"
      :photo="lightboxPhoto"
      :has-prev="lightboxHasPrev"
      :has-next="lightboxHasNext"
      :preload="lightboxPreload"
      @close="onLightboxClose"
      @prev="stepLightbox(-1)"
      @next="stepLightbox(1)"
      @rewind="rewindLightbox"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, unref, watch, type CSSProperties } from 'vue'
import { useGettext } from 'vue3-gettext'
import { NoContentMessage, queryItemAsString, useRouteQuery } from '@opencloud-eu/web-pkg'
import { Photo } from '../types'
import { TimelineSection, usePhotoTimeline } from '../composables/usePhotoTimeline'
import { useLightboxNavigation } from '../composables/useLightboxNavigation'
import { useScrollPursuit } from '../composables/useScrollPursuit'
import { monthYearLabel } from '../helpers'
import PhotoLightbox from './PhotoLightbox.vue'
import TimelineMonth from './TimelineMonth.vue'
import TimelineScrubber from './TimelineScrubber.vue'

const ROW_ESTIMATE_HEIGHT = 180
/** average justified tile incl. gap at ~4:3 and 176px row height */
const TILE_ESTIMATE_WIDTH = 240

const { query, filtered = false } = defineProps<{ query: string; filtered?: boolean }>()
const emit = defineEmits<{ loaded: [total: number] }>()

const { $gettext, current: currentLanguage } = useGettext()

const { sections, loading, error, total, load, fillSection, attachThumbnail } = usePhotoTimeline(
  () => query
)

const rootEl = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const activeKey = ref<string | null>(null)
const scrolling = ref(false)
const showBackToTop = ref(false)
const scrollPosition = ref<{ key: string; within: number } | null>(null)

const sectionEls = new Map<string, HTMLElement>()
let fillObserver: IntersectionObserver | undefined
// fills change the content height without a scroll event
let sectionResizeObserver: ResizeObserver | undefined
const leadingEl = ref<HTMLElement | null>(null)
let leadingResizeObserver: ResizeObserver | undefined
let leadingHeight = 0

// while scrubbing, fills are held back until the drag settles
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

function sectionStyle(section: TimelineSection): CSSProperties {
  // native virtualization; HEIGHT only, the shorthand would also set an
  // intrinsic WIDTH and push the scrubber rail off the screen
  return {
    contentVisibility: 'auto',
    containIntrinsicHeight: `auto ${estimateHeight(section)}px`
  }
}

function estimateHeight(section: TimelineSection): number {
  // full month: a capped estimate would make big months jump when they fill
  const width = scroller.value?.clientWidth ?? 1200
  const perRow = Math.max(2, Math.floor(width / TILE_ESTIMATE_WIDTH))
  return Math.max(1, Math.ceil(section.count / perRow)) * ROW_ESTIMATE_HEIGHT
}

function onLightboxClose() {
  const photo = lightboxPhoto.value
  closeLightbox()
  if (photo) {
    // reveal where the lightbox journey ended, glow included
    scrollToPhoto(photo)
  }
}

function backToTop() {
  cancelPursuit()
  // a still-armed ?date anchor would re-scroll to its month on the next fill
  releaseAnchor()
  const container = scroller.value
  if (container) {
    container.scrollTop = 0
    showBackToTop.value = false
  }
}

const { scrollToPhoto: pursuePhoto, cancelPursuit } = useScrollPursuit({
  scroller,
  host: rootEl,
  sectionEls,
  sections,
  fillSection,
  onScrolled: updateBackToTop
})

function scrollToPhoto(photo: Photo) {
  // the pursuit and a still-armed ?date anchor would fight over scrollTop
  releaseAnchor()
  return pursuePhoto(photo)
}

defineExpose({ scrollToPhoto })

function onScrub(key: string, within: number) {
  cancelPursuit()
  releaseAnchor()
  const container = scroller.value
  const el = sectionEls.get(key)
  if (!container || !el) {
    return
  }
  container.scrollTop = el.offsetTop + within * el.offsetHeight
  updateBackToTop()
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

const {
  lightboxPhoto,
  hasPrev: lightboxHasPrev,
  hasNext: lightboxHasNext,
  preload: lightboxPreload,
  open: openPhoto,
  step: stepLightbox,
  close: closeLightbox,
  restore: restoreLightbox,
  rewind: rewindLightbox
} = useLightboxNavigation(sections, fillSection)

let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined
let scrollRaf: number | undefined

async function retry() {
  await load()
  emit('loaded', total.value)
}

function updateBackToTop() {
  const container = scroller.value
  showBackToTop.value = !!container && container.scrollTop > container.clientHeight * 1.5
}

function onScroll() {
  scrolling.value = true
  updateBackToTop()
  clearTimeout(scrollIdleTimer)
  scrollIdleTimer = setTimeout(() => {
    scrolling.value = false
    updateDayAnchor()
  }, 800)

  scheduleActiveSectionUpdate()
}

// ?date=YYYY-MM-DD follows the topmost visible day; written via
// replaceState because the shell's router swallows hash fragments
const dayQuery = useRouteQuery('date')

function updateDayAnchor() {
  const container = scroller.value
  const key = activeKey.value
  if (!container || !key) {
    return
  }
  const sectionEl = sectionEls.get(key)
  if (!sectionEl) {
    return
  }
  const containerTop = container.getBoundingClientRect().top
  let day: string | null = null
  for (const el of sectionEl.querySelectorAll<HTMLElement>('[id^="day-"]')) {
    if (el.getBoundingClientRect().top - containerTop <= 100) {
      day = el.id.slice('day-'.length)
    } else {
      break
    }
  }
  const url = new URL(window.location.href)
  if (!day) {
    // above the first day (memories strip / very top): the canonical URL
    // carries no date
    if (url.searchParams.has('date')) {
      url.searchParams.delete('date')
      window.history.replaceState(window.history.state, '', url.toString())
    }
    return
  }
  if (url.searchParams.get('date') !== day) {
    url.searchParams.set('date', day)
    window.history.replaceState(window.history.state, '', url.toString())
  }
}

// after the initial jump the anchor keeps correcting while months above
// fill and change height; real user input releases it
let anchorDay: string | null = null
let anchorTimer: ReturnType<typeof setTimeout> | undefined

function scrollToAnchorDay() {
  if (!anchorDay) {
    return
  }
  const container = scroller.value
  if (!container) {
    return
  }
  // month-level anchor: hold the section start (its latest day) at the top
  if (anchorDay.length === 7) {
    const sectionEl = sectionEls.get(anchorDay)
    if (sectionEl) {
      container.scrollTop = sectionEl.offsetTop
    }
    updateBackToTop()
    return
  }
  const el = document.getElementById(`day-${anchorDay}`)
  if (!el) {
    return
  }
  container.scrollTop += el.getBoundingClientRect().top - container.getBoundingClientRect().top
  updateBackToTop()
}

function releaseAnchor() {
  anchorDay = null
  clearTimeout(anchorTimer)
}

/** initial deep link: ?date=YYYY-MM-DD fills that month and scrolls to the
 * day; a bare ?date=YYYY-MM (e.g. from the statistics chart) scrolls to the
 * month section */
async function restoreDayAnchor() {
  const day = queryItemAsString(unref(dayQuery)) ?? ''
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(day)) {
    return
  }
  const section = sections.value.find((s) => s.key === day.slice(0, 7))
  if (!section) {
    return
  }
  if (day.length === 7) {
    await nextTick()
    anchorDay = day
    scrollToAnchorDay()
    anchorTimer = setTimeout(releaseAnchor, 5000)
    return
  }
  await fillSection(section)
  await nextTick()
  anchorDay = day
  scrollToAnchorDay()
  anchorTimer = setTimeout(releaseAnchor, 5000)
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

// reading offsetTop per scroll frame forces layout, so measure on resize only
const sectionGeometry = new Map<string, { top: number; height: number }>()

function measureSections() {
  for (const [key, el] of sectionEls) {
    sectionGeometry.set(key, { top: el.offsetTop, height: el.offsetHeight })
  }
}

function updateActiveSection() {
  const container = scroller.value
  if (!container) {
    return
  }
  const threshold = container.scrollTop + 80
  let current: string | null = null
  let currentGeometry: { top: number; height: number } | null = null
  for (const section of sections.value) {
    const geometry = sectionGeometry.get(section.key)
    if (!geometry) {
      continue
    }
    if (geometry.top <= threshold) {
      current = section.key
      currentGeometry = geometry
    } else {
      break
    }
  }
  activeKey.value = current ?? sections.value[0]?.key ?? null
  scrollPosition.value =
    current && currentGeometry
      ? {
          key: current,
          within: Math.min(
            Math.max((threshold - currentGeometry.top) / Math.max(currentGeometry.height, 1), 0),
            1
          )
        }
      : activeKey.value
        ? { key: activeKey.value, within: 0 }
        : null
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
  sectionResizeObserver = new ResizeObserver(() => {
    measureSections()
    scrollToAnchorDay()
    scheduleActiveSectionUpdate()
  })
  scroller.value?.addEventListener('wheel', releaseAnchor, { passive: true })
  scroller.value?.addEventListener('touchstart', releaseAnchor, { passive: true })
  // the memory strip loads async and inserts above the months: when the user
  // already scrolled (or an anchor jump landed), growing the leading area
  // must not shift what is on screen
  leadingResizeObserver = new ResizeObserver(() => {
    const height = leadingEl.value?.offsetHeight ?? 0
    const delta = height - leadingHeight
    leadingHeight = height
    const container = scroller.value
    if (container && delta !== 0 && container.scrollTop > 0) {
      container.scrollTop += delta
    }
  })
  if (leadingEl.value) {
    leadingHeight = leadingEl.value.offsetHeight
    leadingResizeObserver.observe(leadingEl.value)
  }
  await load()
  emit('loaded', total.value)
  await nextTick()
  await restoreDayAnchor()
  restoreLightbox()
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
  cancelPursuit()
  fillObserver?.disconnect()
  sectionResizeObserver?.disconnect()
  leadingResizeObserver?.disconnect()
  clearTimeout(anchorTimer)
  clearTimeout(scrollIdleTimer)
  if (scrollRaf) {
    cancelAnimationFrame(scrollRaf)
  }
})
</script>

<style scoped>
.photos-fade-enter-active,
.photos-fade-leave-active {
  transition: opacity 0.2s ease;
}
.photos-fade-enter-from,
.photos-fade-leave-to {
  opacity: 0;
}
</style>

<style>
/* jump target: align below the sticky day header and flash to be findable */
.photos-timeline-scroller [data-photo-id] {
  scroll-margin-top: 3rem;
}
</style>
