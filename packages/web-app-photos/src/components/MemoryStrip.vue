<template>
  <section :aria-label="$gettext('Memories')">
    <header class="ext:mb-4">
      <h2 class="ext:m-0 ext:text-2xl ext:font-light ext:text-role-on-surface">
        {{ $gettext('Do you remember?') }}
      </h2>
      <p class="ext:m-0 ext:mt-1 ext:text-sm ext:text-role-on-surface-variant">
        {{ subtitle }}
      </p>
    </header>

    <div class="ext:rounded-xl ext:bg-role-surface-container">
      <div
        class="memory-scroller ext:flex ext:snap-x ext:gap-8 ext:overflow-x-auto ext:px-4 ext:pt-5 ext:pb-6"
      >
        <div
          v-for="group in groups"
          :key="group.year"
          class="ext:flex ext:shrink-0 ext:snap-start ext:gap-4"
        >
          <div
            class="ext:flex ext:w-14 ext:shrink-0 ext:flex-col ext:justify-center ext:gap-1 ext:border-l-2 ext:border-role-outline-variant ext:pl-3"
          >
            <span class="ext:font-mono ext:text-lg ext:font-semibold ext:text-role-on-surface">
              {{ group.year }}
            </span>
            <span class="ext:text-xs ext:leading-4 ext:text-role-on-surface-variant">
              {{ yearsAgoLabel(group.yearsAgo) }}
            </span>
          </div>
          <photo-print v-for="photo in group.photos" :key="photo.id" :photo="photo" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { MemoryGroup } from '../types'
import { MemoryMode } from '../composables/usePhotoLibrary'
import PhotoPrint from './PhotoPrint.vue'

const { groups, mode } = defineProps<{
  groups: MemoryGroup[]
  mode: MemoryMode
}>()

const { $ngettext, $gettext, interpolate, current: currentLanguage } = useGettext()

const subtitle = computed(() => {
  if (mode === 'day') {
    return $gettext('On this day, over the years')
  }
  const month = new Date().toLocaleDateString(currentLanguage, { month: 'long' })
  return interpolate($gettext('In %{ month }, over the years'), { month })
})

function yearsAgoLabel(yearsAgo: number): string {
  return $ngettext('%{ n } year ago', '%{ n } years ago', yearsAgo, { n: String(yearsAgo) })
}
</script>

<style scoped>
.memory-scroller {
  mask-image: linear-gradient(
    to right,
    transparent,
    black 8px,
    black calc(100% - 32px),
    transparent
  );
  scrollbar-width: thin;
}
</style>
