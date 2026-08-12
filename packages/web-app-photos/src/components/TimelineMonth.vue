<template>
  <template v-if="section.photos !== null">
    <div v-for="group in groups" :key="group.day">
      <h3
        class="ext:sticky ext:top-0 ext:z-10 ext:m-0 ext:bg-role-surface ext:py-2 ext:text-sm ext:font-semibold ext:text-role-on-surface"
      >
        {{ dayLabel(group.day, currentLanguage) }}
      </h3>
      <div class="ext:flex ext:flex-wrap ext:gap-0.5 ext:pb-2">
        <photo-tile v-for="photo in group.photos" :key="photo.id" :photo="photo" :attach="attach" />
        <div class="ext:h-0 ext:grow-[999999]" />
      </div>
    </div>
    <p
      v-if="section.count > section.photos.length"
      class="ext:m-0 ext:pb-2 ext:text-xs ext:text-role-on-surface-variant"
    >
      {{ truncationLabel }}
    </p>
  </template>
  <div v-else :style="{ minHeight: `${estimatedHeight}px` }">
    <div class="ext:flex ext:justify-center ext:py-10">
      <oc-spinner v-if="section.filling" size="small" :aria-label="$gettext('Loading')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { TimelineSection } from '../composables/usePhotoTimeline'
import { MemoryPhoto } from '../types'
import { dayLabel, formatCount, groupPhotosByDay } from '../helpers'
import PhotoTile from './PhotoTile.vue'

// One component per month, same markup as before: the timeline re-renders on
// every scroll frame (the scrubber position lives there), and with the tiles
// inlined that meant re-rendering thousands of vnodes per frame. As a child
// with stable props this month only re-renders when its own photos change.
const { section, attach, estimatedHeight } = defineProps<{
  section: TimelineSection
  attach: (photo: MemoryPhoto) => Promise<void>
  estimatedHeight: number
}>()

const { $gettext, interpolate, current: currentLanguage } = useGettext()

const groups = computed(() => groupPhotosByDay(section.photos ?? []))

const truncationLabel = computed(() =>
  interpolate($gettext('Showing %{ shown } of %{ total } photos in this month'), {
    shown: formatCount(section.photos?.length ?? 0, currentLanguage),
    total: formatCount(section.count, currentLanguage)
  })
)
</script>
