<template>
  <!-- pulsing placeholder art doubles as the loading indicator; the image is
       its own layer that fades in once fully decoded, so the swap never
       flickers -->
  <div
    ref="el"
    class="ext:relative ext:overflow-hidden ext:rounded-sm"
    :class="revealed ? '' : 'ext:animate-pulse'"
    :style="tileStyle"
    role="img"
    :aria-label="photo.name"
    :title="tileTitle"
  >
    <div
      v-if="photo.thumbnailUrl"
      class="ext:absolute ext:inset-0 ext:bg-cover ext:bg-center ext:transition-opacity ext:duration-300"
      :class="revealed ? 'ext:opacity-100' : 'ext:opacity-0'"
      :style="{ backgroundImage: `url(${photo.thumbnailUrl})` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { MemoryPhoto } from '../types'
import { formatTileTime, placeholderArtFor } from '../helpers'

const ROW_HEIGHT = 176

const { photo, attach } = defineProps<{
  photo: MemoryPhoto
  attach: (photo: MemoryPhoto) => Promise<void>
}>()

const { current: currentLanguage } = useGettext()

const el = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

const aspect = computed(() => {
  if (photo.width && photo.height) {
    return photo.width / photo.height
  }
  return 4 / 3
})

// classic flex justified gallery: grow by aspect ratio, height follows via
// aspect-ratio, so rows fill the container width with true proportions.
// NOTE background-image on purpose: the real-<img> variant was tried and
// produced unreliable painting inside content-visibility sections, while
// this variant is the one that renders reliably.
const tileStyle = computed(() => ({
  flexGrow: String(aspect.value),
  flexBasis: `${Math.round(aspect.value * ROW_HEIGHT)}px`,
  aspectRatio: String(aspect.value),
  maxHeight: `${ROW_HEIGHT * 2}px`,
  background: placeholderArtFor(photo.id)
}))

// bg layers have no load event: a detached Image on the same (blob) url
// signals when the bitmap is decoded, THEN the layer fades in
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
  // the timeline scrolls inside an inner container which clips its children:
  // with the implicit viewport root the margin would never take effect, so
  // the scroll container itself must be the observer root
  const root = el.value?.closest('.photos-timeline-scroller') ?? null
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect()
        attach(photo)
      }
    },
    // generous margin: previews should be ready before they scroll in
    { root, rootMargin: '1500px 0px' }
  )
  observer.observe(el.value!)
})

onBeforeUnmount(() => observer?.disconnect())
</script>
