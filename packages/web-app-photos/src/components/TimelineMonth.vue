<template>
  <template v-if="section.photos !== null">
    <div
      v-for="group in groups"
      :id="`day-${group.day}`"
      :key="group.day"
      :style="groupStyle(group)"
    >
      <h3
        class="ext:sticky ext:top-0 ext:z-10 ext:m-0 ext:bg-role-surface ext:py-2 ext:text-sm ext:font-semibold ext:text-role-on-surface"
      >
        {{ dayLabel(group.day, currentLanguage) }}
      </h3>
      <div class="ext:flex ext:flex-wrap ext:gap-0.5 ext:pb-2">
        <photo-tile
          v-for="photo in group.photos"
          :key="photo.id"
          :data-photo-id="photo.id"
          :photo="photo"
          :attach="attach"
          @open="emit('open', photo)"
        />
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
  <!-- unfilled month: the estimated area reads as a loading skeleton -->
  <div
    v-else
    class="ext:animate-pulse ext:rounded-sm ext:bg-role-surface-container"
    :style="{ minHeight: `${estimatedHeight}px` }"
  >
    <div class="ext:flex ext:justify-center ext:py-10">
      <oc-spinner v-if="section.filling" size="small" :aria-label="$gettext('Loading')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { useGettext } from 'vue3-gettext'
import { TimelineSection } from '../composables/usePhotoTimeline'
import { Photo } from '../types'
import { dayLabel, formatCount, groupPhotosByDay } from '../helpers'
import PhotoTile from './PhotoTile.vue'

// the timeline re-renders per scroll frame; as a child with stable props a
// month only re-renders when its own photos change
const { section, attach, estimatedHeight } = defineProps<{
  section: TimelineSection
  attach: (photo: Photo) => Promise<void>
  estimatedHeight: number
}>()

const emit = defineEmits<{ open: [photo: Photo] }>()

const { $gettext, interpolate, current: currentLanguage } = useGettext()

const groups = computed(() => groupPhotosByDay(section.photos ?? []))

// day-level content-visibility, or a huge month is one giant layout unit;
// height only, an intrinsic width would widen the whole layout
function groupStyle(group: { photos: Photo[] }): CSSProperties {
  return {
    contentVisibility: 'auto',
    containIntrinsicHeight: `auto ${40 + Math.ceil(group.photos.length / 8) * 184}px`,
    scrollMarginTop: '80px'
  }
}

const truncationLabel = computed(() =>
  interpolate($gettext('Showing %{ shown } of %{ total } photos in this month'), {
    shown: formatCount(section.photos?.length ?? 0, currentLanguage),
    total: formatCount(section.count, currentLanguage)
  })
)
</script>
