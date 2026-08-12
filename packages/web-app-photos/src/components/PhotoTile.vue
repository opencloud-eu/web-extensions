<template>
  <div
    ref="el"
    class="ext:relative ext:overflow-hidden ext:rounded-sm ext:bg-cover ext:bg-center"
    :style="tileStyle"
    role="img"
    :aria-label="photo.name"
    :title="tileTitle"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { MemoryPhoto } from '../types'
import { placeholderArtFor } from '../helpers'

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
// aspect-ratio, so rows fill the container width with true proportions
const tileStyle = computed(() => ({
  flexGrow: String(aspect.value),
  flexBasis: `${Math.round(aspect.value * ROW_HEIGHT)}px`,
  aspectRatio: String(aspect.value),
  maxHeight: `${ROW_HEIGHT * 2}px`,
  ...(photo.thumbnailUrl
    ? { backgroundImage: `url(${photo.thumbnailUrl})` }
    : { background: placeholderArtFor(photo.id) })
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
