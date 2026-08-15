<template>
  <!-- placeholder art doubles as the loading indicator; the image fades in
       once decoded -->
  <div
    ref="el"
    class="ext:relative ext:cursor-pointer ext:overflow-hidden ext:rounded-sm"
    :class="revealed ? '' : 'ext:animate-pulse'"
    :style="tileStyle"
    role="button"
    tabindex="0"
    :aria-label="photo.name"
    :title="tileTitle"
    @click="emit('open')"
    @keydown.enter="emit('open')"
  >
    <div
      v-if="photo.thumbnailUrl"
      class="ext:absolute ext:inset-0 ext:bg-cover ext:bg-center ext:transition-opacity ext:duration-300"
      :class="revealed ? 'ext:opacity-100' : 'ext:opacity-0'"
      :style="{ backgroundImage: `url(${photo.thumbnailUrl})` }"
    />
    <motion-photo-badge
      v-if="photo.motionPhoto"
      class="ext:absolute ext:top-1 ext:right-1 ext:z-10 ext:size-4"
      :interactive="false"
      :show-tooltip="false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { MotionPhotoBadge } from '@opencloud-eu/web-pkg'
import { MemoryPhoto } from '../types'
import { formatTileTime, placeholderArtFor } from '../helpers'

const ROW_HEIGHT = 176

const { photo, attach } = defineProps<{
  photo: MemoryPhoto
  attach: (photo: MemoryPhoto) => Promise<void>
}>()

const emit = defineEmits<{ open: [] }>()

const { current: currentLanguage } = useGettext()

const el = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

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
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect()
        attach(photo)
      }
    },
    { root, rootMargin: '1500px 0px' }
  )
  observer.observe(el.value!)
})

onBeforeUnmount(() => observer?.disconnect())
</script>
