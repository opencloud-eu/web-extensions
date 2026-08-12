<template>
  <div class="ext:relative ext:min-h-0 ext:flex-1">
    <div ref="scroller" class="ext:h-full ext:overflow-y-auto ext:pr-12" @scroll.passive="onScroll">
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

    <div v-if="sections.length > 1" class="ext:absolute ext:top-0 ext:right-0 ext:bottom-0">
      <timeline-scrubber :sections="sections" :active-key="activeKey" @jump="jumpTo" />
    </div>

    <div
      v-if="activeKey"
      class="ext:pointer-events-none ext:absolute ext:top-2 ext:right-14 ext:rounded-full ext:bg-role-inverse-surface ext:px-3 ext:py-1 ext:text-xs ext:font-medium ext:text-role-inverse-on-surface ext:transition-opacity ext:duration-300"
      :class="scrolling ? 'ext:opacity-100' : 'ext:opacity-0'"
    >
      {{ monthYearLabel(activeKey, currentLanguage) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import { TimelineSection, usePhotoTimeline } from '../composables/usePhotoTimeline'
import { MemoryPhoto } from '../types'
import { dayLabel, formatCount, groupPhotosByDay, monthYearLabel } from '../helpers'
import PhotoTile from './PhotoTile.vue'
import TimelineScrubber from './TimelineScrubber.vue'

const ROW_ESTIMATE_HEIGHT = 180
const PHOTOS_PER_ROW_ESTIMATE = 5

const { query } = defineProps<{ query: string }>()
const emit = defineEmits<{ loaded: [total: number] }>()

const { $gettext, interpolate, current: currentLanguage } = useGettext()

const { sections, loading, total, load, fillSection, attachThumbnail } = usePhotoTimeline(
  () => query
)

const scroller = ref<HTMLElement | null>(null)
const activeKey = ref<string | null>(null)
const scrolling = ref(false)

const sectionEls = new Map<string, HTMLElement>()
let fillObserver: IntersectionObserver | undefined

function setSectionEl(key: string, el: HTMLElement | null) {
  if (el) {
    sectionEls.set(key, el)
    el.dataset.sectionKey = key
    fillObserver?.observe(el)
  } else {
    const existing = sectionEls.get(key)
    if (existing) {
      fillObserver?.unobserve(existing)
    }
    sectionEls.delete(key)
  }
}

function dayGroups(photos: MemoryPhoto[]) {
  return groupPhotosByDay(photos)
}

function estimateHeight(section: TimelineSection): number {
  return Math.max(1, Math.ceil(section.count / PHOTOS_PER_ROW_ESTIMATE)) * ROW_ESTIMATE_HEIGHT
}

function truncationLabel(section: TimelineSection): string {
  return interpolate($gettext('Showing %{ shown } of %{ total } photos in this month'), {
    shown: formatCount(section.photos?.length ?? 0, currentLanguage),
    total: formatCount(section.count, currentLanguage)
  })
}

function jumpTo(key: string, smooth: boolean) {
  sectionEls.get(key)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
}

let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined
let scrollRaf: number | undefined

function onScroll() {
  scrolling.value = true
  clearTimeout(scrollIdleTimer)
  scrollIdleTimer = setTimeout(() => {
    scrolling.value = false
  }, 800)

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
        const section = sections.value.find((s) => s.key === key)
        if (section) {
          fillSection(section)
        }
      }
    },
    { root: scroller.value, rootMargin: '800px 0px' }
  )
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
  clearTimeout(scrollIdleTimer)
  if (scrollRaf) {
    cancelAnimationFrame(scrollRaf)
  }
})
</script>
