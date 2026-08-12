<template>
  <div class="ext:flex ext:h-full ext:flex-col ext:bg-role-surface">
    <header class="ext:px-4 ext:pt-4 ext:pb-2">
      <div class="ext:flex ext:flex-wrap ext:items-center ext:justify-between ext:gap-4">
        <div class="ext:flex ext:min-w-0 ext:flex-wrap ext:items-baseline ext:gap-x-3">
          <photos-breadcrumb :items="breadcrumbItems" class="ext:min-w-0" />
          <span v-if="total !== null" class="ext:text-sm ext:text-role-on-surface-variant">
            {{ countLabel }}
          </span>
        </div>
        <oc-button
          v-if="editable"
          type="router-link"
          :to="{ name: 'photos-album-edit', query: route.query }"
          appearance="outline"
          size="small"
        >
          <oc-icon name="edit" size="small" class="ext:mr-1" />
          {{ $gettext('Edit') }}
        </oc-button>
      </div>
      <p
        v-if="album"
        class="ext:m-0 ext:mt-1.5 ext:font-mono ext:text-xs ext:break-all ext:text-role-on-surface-variant"
      >
        {{ album.query }}
      </p>
    </header>

    <div v-if="loading" class="ext:flex ext:justify-center ext:py-24">
      <oc-spinner size="medium" :aria-label="$gettext('Loading album')" />
    </div>

    <no-content-message v-else-if="error" icon="alert" class="ext:py-16">
      <template #message>
        <span>{{ $gettext('The album could not be loaded.') }}</span>
      </template>
    </no-content-message>

    <div v-else-if="album" class="ext:min-h-0 ext:flex-1 ext:px-4 ext:pb-2">
      <photo-timeline :query="album.query" class="ext:h-full" @loaded="total = $event" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { NoContentMessage, useRoute, useSpacesStore } from '@opencloud-eu/web-pkg'
import { ALBUM_EXTENSION, AlbumFile, AlbumRef, albumTitle } from './albums'
import { useAlbums } from './composables/useAlbums'
import { formatCount } from './helpers'
import PhotosBreadcrumb from './components/PhotosBreadcrumb.vue'
import PhotoTimeline from './components/PhotoTimeline.vue'

const route = useRoute()
const { $gettext, $ngettext, current: currentLanguage } = useGettext()
const { readAlbum } = useAlbums()
const spacesStore = useSpacesStore()

const albumRef = computed<AlbumRef>(() => {
  const query = unref(route).query
  const fileName = String(query.name ?? '')
  return {
    title: albumTitle(fileName),
    fileName,
    parentPath: String(query.path ?? ''),
    driveId: String(query.driveId ?? '')
  }
})

const album = ref<AlbumFile | null>(null)
const total = ref<number | null>(null)
const loading = ref(true)
const error = ref(false)

const editable = computed(
  () => album.value !== null && albumRef.value.driveId === spacesStore.personalSpace?.id
)

// route params are attacker-controlled: only surface the title once the
// album file was actually read, so every visible string is backed by a
// readable file
const breadcrumbItems = computed(() => {
  const items = [{ text: $gettext('Albums'), to: { name: 'photos-albums' } }]
  if (album.value) {
    items.push({ text: albumRef.value.title, to: undefined })
  }
  return items
})

const countLabel = computed(() =>
  $ngettext('%{ n } photo', '%{ n } photos', total.value ?? 0, {
    n: formatCount(total.value ?? 0, currentLanguage)
  })
)

onMounted(async () => {
  try {
    if (!albumRef.value.fileName.endsWith(`.${ALBUM_EXTENSION}`)) {
      throw new Error('not an album file')
    }
    album.value = await readAlbum(albumRef.value)
  } catch (e) {
    console.error('[photos] failed to load album', e)
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>
