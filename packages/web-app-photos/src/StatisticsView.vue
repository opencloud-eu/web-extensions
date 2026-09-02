<template>
  <div class="ext:h-full ext:overflow-y-auto ext:bg-role-surface">
    <div class="ext:flex ext:flex-col ext:gap-8 ext:px-4 ext:py-4">
      <header>
        <photos-breadcrumb :items="[{ text: $gettext('Statistics') }]" />
        <p
          v-if="libraryFacts.length"
          class="ext:m-0 ext:mt-3 ext:flex ext:flex-wrap ext:items-baseline ext:gap-x-2 ext:gap-y-1 ext:text-sm ext:text-role-on-surface-variant"
        >
          <template v-for="(item, index) in libraryFacts" :key="item.label">
            <span class="ext:whitespace-nowrap">
              <span class="ext:font-semibold ext:tabular-nums ext:text-role-on-surface">{{
                item.value
              }}</span>
              {{ item.label }}
            </span>
            <span v-if="index < libraryFacts.length - 1" aria-hidden="true">·</span>
          </template>
        </p>
      </header>

      <div v-if="loading" class="ext:flex ext:justify-center ext:py-24">
        <oc-spinner size="large" :aria-label="$gettext('Loading your photo library')" />
      </div>

      <div
        v-else-if="error"
        class="ext:rounded-xl ext:border ext:border-role-outline-variant ext:p-6 ext:text-sm ext:text-role-on-surface-variant"
      >
        {{ $gettext('The photo library could not be loaded.') }}
        <span class="ext:font-mono ext:text-xs">{{ error }}</span>
      </div>

      <template v-else>
        <div class="ext:grid ext:grid-cols-1 ext:gap-5 ext:lg:grid-cols-3">
          <section-card :title="$gettext('Photos over time')" class="ext:lg:col-span-2">
            <activity-chart v-if="monthly" :aggregation="monthly" @select="openMonth" />
          </section-card>

          <section-card :title="$gettext('Your cameras')">
            <bar-list v-if="cameras" :aggregation="cameras" selectable @select="openCamera" />
            <p v-else class="ext:m-0 ext:text-sm ext:text-role-on-surface-variant">
              {{ $gettext('No camera information yet.') }}
            </p>
          </section-card>

          <section-card :title="$gettext('Places')">
            <bar-list
              v-if="places?.buckets?.length"
              :aggregation="places"
              :format-key="placeLabel"
            />
            <p v-else class="ext:m-0 ext:text-sm ext:text-role-on-surface-variant">
              {{ $gettext('No photos with location data yet.') }}
            </p>
          </section-card>

          <section-card :title="$gettext('Tags')">
            <tag-chips v-if="tags?.buckets?.length" :aggregation="tags" @select="openTag" />
            <p v-else class="ext:m-0 ext:text-sm ext:text-role-on-surface-variant">
              {{ $gettext('No tagged photos yet.') }}
            </p>
          </section-card>

          <section-card :title="$gettext('How you shoot')">
            <ExifFacts v-if="exifFacts.length" :facts="exifFacts" />
            <p v-else class="ext:m-0 ext:text-sm ext:text-role-on-surface-variant">
              {{ $gettext('No camera metadata yet.') }}
            </p>
          </section-card>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useRouter } from '@opencloud-eu/web-pkg'
import { usePhotoLibrary } from './composables/usePhotoLibrary'
import { formatBytes, formatCount, formatCoordinates, geohashDecode } from './helpers'
import { placeName } from './places'
import ActivityChart from './components/ActivityChart.vue'
import BarList from './components/BarList.vue'
import ExifFacts from './components/ExifFacts.vue'
import PhotosBreadcrumb from './components/PhotosBreadcrumb.vue'
import SectionCard from './components/SectionCard.vue'
import TagChips from './components/TagChips.vue'

const { $gettext, current: currentLanguage } = useGettext()
const router = useRouter()

function openMonth(monthKey: string) {
  router.push({ name: 'photos-timeline', query: { date: monthKey } })
}

/** KQL quoted strings know no escaping: a literal quote (or backslash) can
 * not be expressed at all, so strip it instead of producing broken KQL */
function kqlValue(value: string): string {
  return value.replace(/["\\]/g, '')
}

function openCamera(model: string) {
  router.push({
    name: 'photos-timeline',
    query: { filter: `photo.cameraModel:"${kqlValue(model)}"` }
  })
}

function openTag(tag: string) {
  router.push({ name: 'photos-timeline', query: { filter: `tag:"${kqlValue(tag)}"` } })
}

const { load, loading, error, stats, cameras, monthly, places, tags, exifFacts } = usePhotoLibrary()

onMounted(() => {
  load()
})

const libraryFacts = computed(() => {
  const s = stats.value
  if (!s) {
    return []
  }
  const language = currentLanguage
  const items: { value: string; label: string }[] = [
    { value: formatCount(s.totalPhotos, language), label: $gettext('photos') }
  ]
  if (s.totalBytes) {
    items.push({ value: formatBytes(s.totalBytes, language), label: '' })
  }
  if (s.cameraCount) {
    items.push({ value: formatCount(s.cameraCount, language), label: $gettext('cameras') })
  }
  if (s.placeCount) {
    items.push({ value: formatCount(s.placeCount, language), label: $gettext('places') })
  }
  if (s.videoCount) {
    items.push({ value: formatCount(s.videoCount, language), label: $gettext('videos') })
  }
  return items
})

function placeLabel(key: string): string {
  const known = placeName(key)
  if (known) {
    return known
  }
  const { latitude, longitude } = geohashDecode(key)
  return `${key} · ${formatCoordinates(latitude, longitude)}`
}
</script>
