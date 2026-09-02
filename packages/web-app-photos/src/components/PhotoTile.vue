<template>
  <!-- placeholder art doubles as the loading indicator; the image fades in
       once decoded -->
  <div
    ref="el"
    class="ext:relative ext:cursor-pointer ext:overflow-hidden ext:rounded-sm"
    :class="revealed || unavailable ? '' : 'ext:animate-pulse'"
    :style="tileStyle"
    role="button"
    tabindex="0"
    :aria-label="photo.name"
    :title="tileTitle"
    @click="emit('open')"
    @keydown.enter="emit('open')"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <div
      v-if="photo.thumbnailUrl"
      class="ext:absolute ext:inset-0 ext:bg-cover ext:bg-center ext:transition-opacity ext:duration-300"
      :class="revealed ? 'ext:opacity-100' : 'ext:opacity-0'"
      :style="{ backgroundImage: `url(${photo.thumbnailUrl})` }"
    />
    <div
      v-else-if="unavailable"
      class="ext:absolute ext:inset-0 ext:flex ext:items-center ext:justify-center ext:opacity-40"
    >
      <oc-icon name="image" fill-type="line" />
    </div>
    <photo-tile-motion v-if="photo.motionPhoto" :photo="photo" :hovering="hovering" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { Photo } from '../types'
import { formatTileTime, placeholderArtFor } from '../helpers'
import PhotoTileMotion from './PhotoTileMotion.vue'

const ROW_HEIGHT = 176

const { photo, attach } = defineProps<{
  photo: Photo
  attach: (photo: Photo) => Promise<void>
}>()

const emit = defineEmits<{ open: [] }>()

const { current: currentLanguage } = useGettext()

const el = ref<HTMLElement | null>(null)
const hovering = ref(false)
// attach resolved but produced no url: the preview failed or does not exist;
// stop the pulse and show a static fallback instead
const attachSettled = ref(false)
const unavailable = computed(() => attachSettled.value && !photo.thumbnailUrl)
let observer: IntersectionObserver | undefined
let dwellTimer: ReturnType<typeof setTimeout> | undefined

const aspect = computed(() => {
  if (photo.width && photo.height) {
    return photo.width / photo.height
  }
  return 4 / 3
})

// flex justified gallery: grow by aspect ratio, height follows.
// background-image on purpose: a real <img> paints unreliably inside
// content-visibility sections.
const tileStyle = computed(() => ({
  flexGrow: String(aspect.value),
  flexBasis: `${Math.round(aspect.value * ROW_HEIGHT)}px`,
  aspectRatio: String(aspect.value),
  maxHeight: `${ROW_HEIGHT * 2}px`,
  background: placeholderArtFor(photo.id)
}))

// bg layers have no load event: a detached Image signals decoding
const revealed = ref(false)
watch(
  () => photo.thumbnailUrl,
  (url) => {
    if (!url) {
      revealed.value = false
      return
    }
    const probe = new Image()
    probe.onload = () => requestAnimationFrame(() => (revealed.value = true))
    probe.onerror = () => (revealed.value = true)
    probe.src = url
  },
  { immediate: true }
)

const tileTitle = computed(
  () => `${photo.name} · ${formatTileTime(photo.takenDateTime, currentLanguage)}`
)

onMounted(() => {
  // the observer root must be the inner scroll container, with the implicit
  // viewport root the margin never takes effect
  const root = el.value?.closest('.photos-timeline-scroller') ?? null
  // require a short dwell inside the corridor: during fills and anchored
  // jumps the content slides past the viewport, and a tile that only grazes
  // the margin for a frame must not commit to a fetch
  observer = new IntersectionObserver(
    (entries) => {
      const intersecting = entries.some((e) => e.isIntersecting)
      if (intersecting && dwellTimer === undefined) {
        dwellTimer = setTimeout(() => {
          dwellTimer = undefined
          // tiles inside a skipped content-visibility subtree have no layout
          // box and report a zero rect AT the section start: hundreds of them
          // would count as visible. A real box is the proof of rendering.
          const rect = el.value?.getBoundingClientRect()
          if (!rect || rect.width === 0 || rect.height === 0) {
            return
          }
          observer?.disconnect()
          attach(photo).finally(() => (attachSettled.value = true))
        }, 200)
      } else if (!intersecting && dwellTimer !== undefined) {
        clearTimeout(dwellTimer)
        dwellTimer = undefined
      }
    },
    { root, rootMargin: '600px 0px' }
  )
  observer.observe(el.value!)
})

onBeforeUnmount(() => {
  clearTimeout(dwellTimer)
  observer?.disconnect()
})
</script>
