<template>
  <div
    ref="el"
    class="ext:relative ext:overflow-hidden ext:rounded-sm"
    :style="tileStyle"
    :title="tileTitle"
  >
    <img
      v-if="photo.thumbnailUrl"
      :src="photo.thumbnailUrl"
      :alt="photo.name"
      decoding="async"
      class="ext:absolute ext:inset-0 ext:size-full ext:object-cover ext:transition-opacity ext:duration-200"
      :class="loaded ? 'ext:opacity-100' : 'ext:opacity-0'"
      @load="loaded = true"
      @error="onImageError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { MemoryPhoto } from '../types'
import { placeholderArtFor } from '../helpers'
import { useGraphSearch } from '../composables/useGraphSearch'

const ROW_HEIGHT = 176
const RETRY_PAUSE_MS = 5000

const { photo, attach } = defineProps<{
  photo: MemoryPhoto
  attach: (photo: MemoryPhoto) => Promise<void>
}>()

const { current: currentLanguage } = useGettext()
const { discardThumbnail } = useGraphSearch()

const el = ref<HTMLElement | null>(null)
const loaded = ref(false)
let observer: IntersectionObserver | undefined
let mounted = true
let nearViewport = false
let retrying = false

/** keeps retrying with pauses while the tile is near the viewport: a visible
 * tile without its rendered image must never end up in a final state */
async function loadUntilDone() {
  if (retrying) {
    return
  }
  retrying = true
  try {
    while (mounted && nearViewport && !loaded.value) {
      await attach(photo)
      if (loaded.value) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS))
    }
  } finally {
    retrying = false
  }
}

function onImageError() {
  if (!photo.thumbnailUrl) {
    return
  }
  console.warn('[photos] preview blob failed to render, refetching', photo.name)
  discardThumbnail(photo)
  loadUntilDone()
}

const aspect = computed(() => {
  if (photo.width && photo.height) {
    return photo.width / photo.height
  }
  return 4 / 3
})

// classic flex justified gallery: grow by aspect ratio, height follows via
// aspect-ratio, so rows fill the container width with true proportions
const tileStyle = computed(() => ({
  flexGrow: String(aspect.value),
  flexBasis: `${Math.round(aspect.value * ROW_HEIGHT)}px`,
  aspectRatio: String(aspect.value),
  maxHeight: `${ROW_HEIGHT * 2}px`,
  background: placeholderArtFor(photo.id)
}))

const tileTitle = computed(() => {
  const taken = new Date(photo.takenDateTime).toLocaleTimeString(currentLanguage, {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${photo.name} · ${taken}`
})

onMounted(() => {
  // the timeline scrolls inside an inner container which clips its children:
  // with the implicit viewport root the margin would never take effect, so
  // the scroll container itself must be the observer root
  const root = el.value?.closest('.photos-timeline-scroller') ?? null
  observer = new IntersectionObserver(
    (entries) => {
      nearViewport = entries.some((e) => e.isIntersecting)
      if (nearViewport && !loaded.value) {
        loadUntilDone()
      } else if (loaded.value) {
        observer?.disconnect()
      }
    },
    // generous margin: previews should be ready before they scroll in
    { root, rootMargin: '1500px 0px' }
  )
  observer.observe(el.value!)
})

onBeforeUnmount(() => {
  mounted = false
  observer?.disconnect()
})
</script>
