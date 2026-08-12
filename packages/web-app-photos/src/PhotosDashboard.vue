<template>
  <div class="ext:h-full ext:overflow-y-auto ext:bg-role-surface">
    <div class="ext:flex ext:flex-col ext:gap-8 ext:px-4 ext:py-4">
      <header>
        <photos-breadcrumb :items="[{ text: $gettext('Overview') }]" />
        <h1 class="ext:m-0 ext:mt-4 ext:text-2xl ext:font-semibold ext:text-role-on-surface">
          {{ greeting }}
        </h1>
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
        <memory-strip v-if="memoryGroups.length" :groups="memoryGroups" :mode="memoryMode" />

        <latest-strip v-if="latestPhotos.length" :photos="latestPhotos" />

        <section v-if="albums.length" :aria-label="$gettext('Albums')">
          <header class="ext:mb-4 ext:flex ext:items-baseline ext:justify-between ext:gap-3">
            <div>
              <h2 class="ext:m-0 ext:text-lg ext:font-semibold ext:text-role-on-surface">
                {{ $gettext('Your albums') }}
              </h2>
              <p class="ext:m-0 ext:mt-1 ext:text-sm ext:text-role-on-surface-variant">
                {{ $gettext('Recently changed first') }}
              </p>
            </div>
            <router-link
              :to="{ name: 'photos-albums' }"
              class="ext:text-sm ext:text-role-on-surface-variant ext:no-underline hover:ext:text-role-on-surface"
            >
              {{ $gettext('All albums') }} →
            </router-link>
          </header>
          <div class="ext:grid ext:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] ext:gap-4">
            <album-card v-for="album in albums" :key="album.id ?? album.fileName" :album="album" />
          </div>
        </section>

        <div class="ext:grid ext:grid-cols-1 ext:gap-5 ext:lg:grid-cols-3">
          <section-card :title="$gettext('Photos over time')" class="ext:lg:col-span-2">
            <activity-chart v-if="monthly" :aggregation="monthly" />
          </section-card>

          <section-card :title="$gettext('Your cameras')">
            <bar-list v-if="cameras" :aggregation="cameras" />
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
            <tag-chips v-if="tags?.buckets?.length" :aggregation="tags" />
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

      <footer class="ext:pb-2 ext:text-center ext:text-xs ext:text-role-on-surface-variant">
        {{ $gettext('Every card is a single Graph Search request with aggregations') }}
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useUserStore } from '@opencloud-eu/web-pkg'
import { usePhotoLibrary } from './composables/usePhotoLibrary'
import { useAlbums } from './composables/useAlbums'
import { AlbumRef } from './albums'
import { formatBytes, formatCount, formatCoordinates, geohashDecode } from './helpers'
import { placeName } from './places'
import ActivityChart from './components/ActivityChart.vue'
import AlbumCard from './components/AlbumCard.vue'
import BarList from './components/BarList.vue'
import ExifFacts from './components/ExifFacts.vue'
import LatestStrip from './components/LatestStrip.vue'
import MemoryStrip from './components/MemoryStrip.vue'
import PhotosBreadcrumb from './components/PhotosBreadcrumb.vue'
import SectionCard from './components/SectionCard.vue'
import TagChips from './components/TagChips.vue'

const { $gettext, current: currentLanguage, interpolate } = useGettext()
const userStore = useUserStore()

const {
  load,
  loading,
  error,
  stats,
  memoryGroups,
  memoryMode,
  latestPhotos,
  cameras,
  monthly,
  places,
  tags,
  exifFacts
} = usePhotoLibrary()

const { listAlbums } = useAlbums()
const albums = ref<AlbumRef[]>([])

onMounted(() => {
  load()
  listAlbums()
    .then((all) => {
      albums.value = all.slice(0, 5)
    })
    .catch(() => {
      albums.value = []
    })
})

const greeting = computed(() => {
  const firstName = userStore.user?.displayName?.split(' ')[0]
  const hour = new Date().getHours()
  const template =
    hour < 5 || hour >= 18
      ? $gettext('Good evening, %{ name }')
      : hour < 12
        ? $gettext('Good morning, %{ name }')
        : $gettext('Good afternoon, %{ name }')
  return firstName ? interpolate(template, { name: firstName }) : $gettext('Welcome back')
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
