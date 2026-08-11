<template>
  <section :aria-label="$gettext('Latest photos')">
    <header class="ext:mb-4">
      <h2 class="ext:m-0 ext:text-2xl ext:font-light ext:text-role-on-surface">
        {{ $gettext('Latest photos') }}
      </h2>
      <p class="ext:m-0 ext:mt-1 ext:text-sm ext:text-role-on-surface-variant">
        {{ $gettext('Fresh from your camera roll') }}
      </p>
    </header>

    <div class="ext:flex ext:snap-x ext:gap-3 ext:overflow-x-auto ext:pb-2">
      <figure
        v-for="photo in photos"
        :key="photo.id"
        class="ext:relative ext:m-0 ext:shrink-0 ext:snap-start"
      >
        <div
          class="ext:h-27 ext:w-36 ext:rounded-lg ext:bg-cover ext:bg-center"
          :style="artStyle(photo)"
          role="img"
          :aria-label="photo.name"
        />
        <figcaption
          class="ext:mt-1 ext:font-mono ext:text-[9px] ext:leading-3 ext:text-role-on-surface-variant"
        >
          {{ takenLabel(photo) }}
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'
import { MemoryPhoto } from '../types'
import { placeholderArtFor } from '../helpers'

const { photos } = defineProps<{ photos: MemoryPhoto[] }>()

const { $gettext, interpolate, current: currentLanguage } = useGettext()

function artStyle(photo: MemoryPhoto) {
  if (photo.thumbnailUrl) {
    return { backgroundImage: `url(${photo.thumbnailUrl})` }
  }
  return { background: placeholderArtFor(photo.id) }
}

function takenLabel(photo: MemoryPhoto): string {
  const taken = new Date(photo.takenDateTime)
  const now = new Date()
  const time = taken.toLocaleTimeString(currentLanguage, { hour: '2-digit', minute: '2-digit' })
  const isToday = taken.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isToday) {
    return interpolate($gettext('Today, %{ time }'), { time })
  }
  if (taken.toDateString() === yesterday.toDateString()) {
    return interpolate($gettext('Yesterday, %{ time }'), { time })
  }
  return taken.toLocaleDateString(currentLanguage, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
