<template>
  <router-link
    :to="albumRoute"
    class="ext:flex ext:flex-col ext:gap-2 ext:rounded-xl ext:border ext:border-role-outline-variant ext:bg-role-surface ext:p-3 ext:no-underline ext:transition-shadow hover:ext:shadow-md"
  >
    <div
      class="ext:aspect-[4/3] ext:rounded-lg ext:bg-cover ext:bg-center ext:bg-role-surface-container"
      :style="coverStyle"
    />
    <div class="ext:min-w-0">
      <div class="ext:truncate ext:text-sm ext:font-medium ext:text-role-on-surface">
        {{ album.title }}
      </div>
      <div class="ext:mt-0.5 ext:text-xs ext:text-role-on-surface-variant">
        <template v-if="errored">{{ $gettext('Album could not be loaded') }}</template>
        <template v-else-if="total === null">{{ $gettext('Loading…') }}</template>
        <template v-else>{{ countLabel }}</template>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { AlbumRef } from '../albums'
import { useAlbums } from '../composables/useAlbums'
import { useGraphSearch } from '../composables/useGraphSearch'
import { MemoryPhoto } from '../types'
import { formatCount, placeholderArtFor } from '../helpers'

const { album } = defineProps<{ album: AlbumRef }>()

const { $ngettext, current: currentLanguage } = useGettext()
const { readAlbum } = useAlbums()
const { search, hitToPhoto, attachThumbnail } = useGraphSearch()

const total = ref<number | null>(null)
const cover = ref<MemoryPhoto | null>(null)
const errored = ref(false)

const albumRoute = computed(() => ({
  name: 'photos-album',
  query: {
    driveId: album.driveId,
    path: album.parentPath,
    name: album.fileName
  }
}))

const coverStyle = computed(() => {
  if (cover.value?.thumbnailUrl) {
    return { backgroundImage: `url(${cover.value.thumbnailUrl})` }
  }
  if (cover.value) {
    return { background: placeholderArtFor(cover.value.id) }
  }
  return {}
})

const countLabel = computed(() =>
  $ngettext('%{ n } photo', '%{ n } photos', total.value ?? 0, {
    n: formatCount(total.value ?? 0, currentLanguage)
  })
)

onMounted(async () => {
  try {
    const file = await readAlbum(album)
    const container = await search({ queryString: file.query, size: 1 })
    total.value = container.total ?? 0
    const photo = (container.hits ?? []).map(hitToPhoto).find((p) => p !== null)
    if (photo) {
      cover.value = photo
      // mutate the reactive proxy, not the raw object, so the style updates
      await attachThumbnail(cover.value)
    }
  } catch (e) {
    console.error('[photos] album card failed', album.fileName, e)
    errored.value = true
  }
})
</script>
