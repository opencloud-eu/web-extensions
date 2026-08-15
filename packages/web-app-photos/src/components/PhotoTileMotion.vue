<template>
  <video
    v-if="isPlaying && videoUrl"
    :src="videoUrl"
    class="ext:pointer-events-none ext:absolute ext:inset-0 ext:z-[5] ext:h-full ext:w-full ext:rounded-sm ext:object-cover"
    muted
    loop
    autoplay
    playsinline
    @loadedmetadata="seekToStill"
  />
  <motion-photo-badge
    class="ext:absolute ext:top-1 ext:right-1 ext:z-10 ext:size-4"
    :playing="isPlaying"
    :loading="isLoading"
    :interactive="true"
    :show-tooltip="false"
    @click.stop.prevent="toggle"
  />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { MotionPhotoBadge, useMotionPhotoPlayback, useSpacesStore } from '@opencloud-eu/web-pkg'
import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { MemoryPhoto } from '../types'

const { photo, hovering } = defineProps<{
  photo: MemoryPhoto
  hovering: boolean
}>()

const spacesStore = useSpacesStore()

const motionResource = computed(
  () =>
    ({
      id: photo.id,
      fileId: photo.id,
      path: `/${photo.parentPath ? `${photo.parentPath}/${photo.name}` : photo.name}`,
      size: photo.size,
      motionPhoto: photo.motionPhoto
    }) as unknown as Resource
)
const motionSpace = computed(
  () => spacesStore.spaces.find((s) => s.id === photo.driveId) as SpaceResource
)

const { isPlaying, isLoading, videoUrl, hoverPlay, stop, toggle, seekToStill } = useMotionPhotoPlayback(
  motionResource,
  motionSpace
)

watch(
  () => hovering,
  (value) => {
    if (value) {
      hoverPlay()
    } else {
      stop()
    }
  }
)
</script>
