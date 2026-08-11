<template>
  <figure
    class="photo-print ext:m-0 ext:shrink-0 ext:rounded-[3px] ext:bg-white ext:p-2 ext:pb-1.5 ext:shadow-md ext:select-none"
    :style="{ '--print-rotation': `${rotation}deg` }"
  >
    <div
      class="ext:h-30 ext:w-40 ext:rounded-[2px] ext:bg-cover"
      :style="artStyle"
      role="img"
      :aria-label="photo.name"
    />
    <figcaption
      class="ext:mt-1.5 ext:flex ext:justify-between ext:gap-2 ext:font-mono ext:text-[9px] ext:leading-3 ext:text-neutral-500"
    >
      <span>{{ takenTime }}</span>
      <span v-if="exifCaption">{{ exifCaption }}</span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MemoryPhoto } from '../types'
import { hashString, placeholderArtFor } from '../helpers'

const { photo } = defineProps<{ photo: MemoryPhoto }>()

const artStyle = computed(() => {
  if (photo.thumbnailUrl) {
    return { backgroundImage: `url(${photo.thumbnailUrl})`, backgroundPosition: 'center' }
  }
  return { background: placeholderArtFor(photo.id) }
})

const rotation = computed(() => (hashString(photo.id) % 5) - 2)

const takenTime = computed(() =>
  new Date(photo.takenDateTime).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
)

const exifCaption = computed(() => {
  const parts: string[] = []
  if (photo.fNumber) {
    parts.push(`f/${photo.fNumber.toFixed(1)}`)
  }
  if (photo.iso) {
    parts.push(`ISO ${photo.iso}`)
  }
  return parts.join(' · ')
})
</script>

<style scoped>
.photo-print {
  transform: rotate(var(--print-rotation));
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.photo-print:hover {
  transform: rotate(0deg) translateY(-4px);
  box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.35);
  z-index: 1;
  position: relative;
}

@media (prefers-reduced-motion: reduce) {
  .photo-print,
  .photo-print:hover {
    transform: none;
    transition: none;
  }
}
</style>
