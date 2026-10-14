<template>
  <div class="ext:flex ext:h-full ext:flex-col ext:bg-role-surface">
    <header
      class="ext:flex ext:flex-wrap ext:items-baseline ext:gap-x-3 ext:px-4 ext:pt-4 ext:pb-2"
    >
      <photos-breadcrumb :items="[{ text: $gettext('Timeline') }]" />
      <span v-if="total !== null" class="ext:text-sm ext:text-role-on-surface-variant">
        {{ countLabel }}
      </span>
      <button
        v-if="filter"
        type="button"
        class="ext:flex ext:cursor-pointer ext:items-center ext:gap-1.5 ext:rounded-full ext:border-0 ext:bg-role-secondary-container ext:px-3 ext:py-1 ext:text-xs ext:text-role-on-secondary-container ext:hover:opacity-80"
        :class="{ 'ext:font-mono': !filterLabel.known }"
        :aria-label="$gettext('Remove filter')"
        :title="$gettext('Remove filter')"
        @click="clearFilter"
      >
        {{ filterLabel.text }}
        <oc-icon name="close" size="small" fill-type="line" />
      </button>
    </header>
    <div class="ext:min-h-0 ext:flex-1 ext:px-4 ext:pb-2">
      <photo-timeline
        ref="timeline"
        :query="timelineQuery"
        :filtered="!!filter"
        class="ext:h-full"
        @loaded="total = $event"
      >
        <template #leading>
          <memory-strip
            v-if="memoryGroups.length && !filter"
            :groups="memoryGroups"
            :mode="memoryMode"
            class="ext:mb-6"
            @select="showInTimeline"
          />
        </template>
      </photo-timeline>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { queryItemAsString, useRouteQuery, useRouter } from '@opencloud-eu/web-pkg'
import { formatCount } from './helpers'
import { Photo } from './types'
import { useMemories } from './composables/useMemories'
import MemoryStrip from './components/MemoryStrip.vue'
import PhotosBreadcrumb from './components/PhotosBreadcrumb.vue'
import PhotoTimeline from './components/PhotoTimeline.vue'

const { $ngettext, $gettext, current: currentLanguage } = useGettext()
const router = useRouter()

// an extra KQL restriction from the statistics page, e.g. a camera model
const filterQuery = useRouteQuery('filter')
const filter = computed(() => queryItemAsString(filterQuery.value) ?? '')
const timelineQuery = computed(() =>
  filter.value ? `mediatype:image AND (${filter.value})` : 'mediatype:image'
)

// the statistics page links with two known KQL shapes; show those as plain
// text and fall back to the raw query (in mono) for anything else
const filterLabel = computed(() => {
  const camera = /^photo\.cameraModel:"(.+)"$/.exec(filter.value)
  if (camera) {
    return { known: true, text: $gettext('Camera: %{ name }', { name: camera[1] }) }
  }
  const tag = /^tag:"(.+)"$/.exec(filter.value)
  if (tag) {
    return { known: true, text: $gettext('Tag: %{ name }', { name: tag[1] }) }
  }
  return { known: false, text: filter.value }
})

function clearFilter() {
  const rest = { ...router.currentRoute.value.query }
  delete rest.filter
  router.replace({ query: rest })
}

const total = ref<number | null>(null)

const timeline = ref<InstanceType<typeof PhotoTimeline> | null>(null)

const { groups: memoryGroups, mode: memoryMode, load: loadMemories } = useMemories()

function showInTimeline(photo: Photo) {
  timeline.value?.scrollToPhoto(photo)
}
onMounted(() => {
  // fire and forget: the timeline must not wait for the anniversary lookups
  loadMemories().catch(() => {
    memoryGroups.value = []
  })
})

const countLabel = computed(() =>
  $ngettext('%{ n } photo', '%{ n } photos', total.value ?? 0, {
    n: formatCount(total.value ?? 0, currentLanguage)
  })
)
</script>
