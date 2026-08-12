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
    />
  </div>
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
const loaded = ref(false)
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
  observer = new IntersectionObserver(
    async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) {
        return
      }
      // only stop observing once the thumbnail actually arrived, so a failed
      // load gets retried the next time the tile scrolls into reach
      await attach(photo)
      if (photo.thumbnailUrl) {
        observer?.disconnect()
      }
    },
    // generous margin: previews should be ready before they scroll in
    { rootMargin: '1500px 0px' }
  )
  observer.observe(el.value!)
})

onBeforeUnmount(() => observer?.disconnect())
</script>
