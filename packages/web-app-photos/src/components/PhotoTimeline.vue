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
          :style="sectionStyle(section)"
        >
          <timeline-month
            :section="section"
            :attach="attachThumbnail"
            :estimated-height="estimateHeight(section)"
          />
        </section>
      </template>
    </div>

    <!-- z above the sticky day headers (z-10), the bubble reaches into the content area -->
    <div v-if="sections.length > 1" class="ext:absolute ext:top-0 ext:right-0 ext:bottom-0 ext:z-20">
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
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, unref, watch, type CSSProperties } from 'vue'
import { useGettext } from 'vue3-gettext'
import { NoContentMessage, queryItemAsString, useRouteQuery } from '@opencloud-eu/web-pkg'
import { TimelineSection, usePhotoTimeline } from '../composables/usePhotoTimeline'
import { monthYearLabel } from '../helpers'
import TimelineMonth from './TimelineMonth.vue'
import TimelineScrubber from './TimelineScrubber.vue'

const ROW_ESTIMATE_HEIGHT = 180
/** average justified tile incl. gap at ~4:3 and 176px row height */
const TILE_ESTIMATE_WIDTH = 240

const { query } = defineProps<{ query: string }>()
const emit = defineEmits<{ loaded: [total: number] }>()

const { $gettext, current: currentLanguage } = useGettext()

const { sections, loading, total, load, fillSection, attachThumbnail } = usePhotoTimeline(
  () => query
)

const scroller = ref<HTMLElement | null>(null)
const activeKey = ref<string | null>(null)
const scrolling = ref(false)
const scrollPosition = ref<{ key: string; within: number } | null>(null)

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

function sectionStyle(section: TimelineSection): CSSProperties {
  // native virtualization: the browser skips layout and paint for off-screen
  // months but keeps all elements alive. 'auto' locks in the real size once
  // a month was rendered. HEIGHT only: the shorthand would also set an
  // intrinsic WIDTH, which widens the whole layout and pushes the scrubber
  // rail off the screen.
  return {
    contentVisibility: 'auto',
    containIntrinsicHeight: `auto ${estimateHeight(section)}px`
  }
}

function estimateHeight(section: TimelineSection): number {
  // estimate the FULL month: the fill pages through all photos, and a capped
  // estimate would make big months jump in height when they fill
  const width = scroller.value?.clientWidth ?? 1200
  const perRow = Math.max(2, Math.floor(width / TILE_ESTIMATE_WIDTH))
  return Math.max(1, Math.ceil(section.count / perRow)) * ROW_ESTIMATE_HEIGHT
}

function onScrub(key: string, within: number) {
  const container = scroller.value
  const el = sectionEls.get(key)
  if (!container || !el) {
    return
  }
  container.scrollTop = el.offsetTop + within * el.offsetHeight
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
    updateDayAnchor()
  }, 800)

  scheduleActiveSectionUpdate()
}

// ?date=YYYY-MM-DD keeps the url in sync with the topmost visible day
// (pastebin url mechanics: read via useRouteQuery, write via replaceState
// with a fully built url; the shell's router swallows hash fragments, so a
// query param it is)
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
  if (!day) {
    return
  }
  const url = new URL(window.location.href)
  if (url.searchParams.get('date') !== day) {
    url.searchParams.set('date', day)
    window.history.replaceState({}, '', url.toString())
  }
}

// the anchor stays active for a settling window after the initial jump:
// months ABOVE the target keep filling and swap their estimated heights for
// real ones, which would silently push the viewport off the day otherwise.
// Real user input releases the anchor immediately.
let anchorDay: string | null = null
let anchorTimer: ReturnType<typeof setTimeout> | undefined

function scrollToAnchorDay() {
  if (!anchorDay) {
    return
  }
  const el = document.getElementById(`day-${anchorDay}`)
  const container = scroller.value
  if (!el || !container) {
    return
  }
  container.scrollTop += el.getBoundingClientRect().top - container.getBoundingClientRect().top
}

function releaseAnchor() {
  anchorDay = null
  clearTimeout(anchorTimer)
}

/** initial deep link: ?date=YYYY-MM-DD fills that month, scrolls to the day */
async function restoreDayAnchor() {
  const day = queryItemAsString(unref(dayQuery)) ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return
  }
  const section = sections.value.find((s) => s.key === day.slice(0, 7))
  if (!section) {
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

// cached section geometry: reading offsetTop per scroll frame forces layout;
// positions only change when sizes change, so measure on resize events only
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
    // layout above the anchored day changed: pull the viewport back onto it
    scrollToAnchorDay()
    scheduleActiveSectionUpdate()
  })
  // real user input takes over: stop correcting the scroll position
  scroller.value?.addEventListener('wheel', releaseAnchor, { passive: true })
  scroller.value?.addEventListener('touchstart', releaseAnchor, { passive: true })
  await load()
  emit('loaded', total.value)
  await nextTick()
  await restoreDayAnchor()
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
  clearTimeout(anchorTimer)
  clearTimeout(scrollIdleTimer)
  if (scrollRaf) {
    cancelAnimationFrame(scrollRaf)
  }
})
</script>
