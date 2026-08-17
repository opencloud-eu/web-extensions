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
    class="ext:absolute ext:top-1 ext:right-1 ext:z-10"
    size="small"
    interactive
    :loading="isLoading"
    :icon="isPlaying ? 'pause-circle' : 'play-circle'"
    :label="isPlaying ? $gettext('Pause motion photo') : $gettext('Play motion photo')"
    @click.stop.prevent="toggle"
  />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { MotionPhotoBadge, useMotionPhotoPlayback, useSpacesStore } from '@opencloud-eu/web-pkg'
import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { Photo } from '../types'

const { photo, hovering } = defineProps<{
  photo: Photo
  hovering: boolean
}>()

const { $gettext } = useGettext()
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

const { isPlaying, isLoading, videoUrl, hoverPlay, stop, toggle, seekToStill } =
  useMotionPhotoPlayback(motionResource, motionSpace)

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
