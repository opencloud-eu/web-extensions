<template>
  <div class="ext:grid ext:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] ext:gap-1.5">
    <div
      v-for="photo in photos"
      :key="photo.id"
      class="ext:aspect-square ext:rounded-md ext:bg-cover ext:bg-center"
      :style="artStyle(photo)"
      role="img"
      :aria-label="photo.name"
      :title="photoTitle(photo)"
    />
  </div>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'
import { MemoryPhoto } from '../types'
import { placeholderArtFor } from '../helpers'

const { photos } = defineProps<{ photos: MemoryPhoto[] }>()

const { current: currentLanguage } = useGettext()

function artStyle(photo: MemoryPhoto) {
  if (photo.thumbnailUrl) {
    return { backgroundImage: `url(${photo.thumbnailUrl})` }
  }
  return { background: placeholderArtFor(photo.id) }
}

function photoTitle(photo: MemoryPhoto): string {
  if (!photo.takenDateTime) {
    return photo.name
  }
  const taken = new Date(photo.takenDateTime).toLocaleDateString(currentLanguage, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  return `${photo.name} · ${taken}`
}
</script>
