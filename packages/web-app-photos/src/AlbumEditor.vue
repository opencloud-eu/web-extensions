<template>
  <div class="ext:h-full ext:overflow-y-auto ext:bg-role-surface">
    <div class="ext:flex ext:max-w-3xl ext:flex-col ext:gap-6 ext:px-4 ext:py-4">
      <header>
        <photos-breadcrumb :items="breadcrumbItems" />
        <p class="ext:m-0 ext:mt-3 ext:text-sm ext:text-role-on-surface-variant">
          {{
            $gettext(
              'An album is a saved search: a small file holding a query. Whoever can read the file sees the photos they are allowed to see.'
            )
          }}
        </p>
      </header>

      <div v-if="loading" class="ext:flex ext:justify-center ext:py-24">
        <oc-spinner size="medium" :aria-label="$gettext('Loading album')" />
      </div>

      <template v-else>
        <oc-text-input
          v-model="title"
          :label="$gettext('Album name')"
          :disabled="isEditing"
          :fix-message-line="true"
        />

        <query-builder v-model="query" />

        <section
          class="ext:rounded-xl ext:border ext:border-role-outline-variant ext:bg-role-surface-container ext:p-4"
        >
          <div class="ext:flex ext:items-baseline ext:justify-between ext:gap-3">
            <span class="ext:text-sm ext:font-medium ext:text-role-on-surface">
              {{ $gettext('Preview') }}
            </span>
            <span class="ext:text-xs ext:text-role-on-surface-variant">
              <template v-if="previewLoading">{{ $gettext('Searching…') }}</template>
              <template v-else-if="previewTotal === null">{{
                $gettext('Type a query to preview')
              }}</template>
              <template v-else>{{ previewCountLabel }}</template>
            </span>
          </div>
          <div v-if="previewPhotos.length" class="ext:mt-3 ext:flex ext:gap-2 ext:overflow-hidden">
            <div
              v-for="photo in previewPhotos"
              :key="photo.id"
              class="ext:h-20 ext:w-20 ext:shrink-0 ext:rounded-md ext:bg-cover ext:bg-center"
              :style="
                photo.thumbnailUrl
                  ? { backgroundImage: `url(${photo.thumbnailUrl})` }
                  : { background: placeholderArtFor(photo.id) }
              "
            />
          </div>
        </section>

        <div v-if="saveError" class="ext:text-sm ext:text-role-error">
          {{ saveError }}
        </div>

        <div class="ext:flex ext:justify-end ext:gap-3">
          <oc-button
            type="router-link"
            :to="{ name: 'photos-albums' }"
            appearance="outline"
            size="medium"
          >
            {{ $gettext('Cancel') }}
          </oc-button>
          <oc-button appearance="filled" size="medium" :disabled="!canSave || saving" @click="save">
            {{ saving ? $gettext('Saving…') : $gettext('Save album') }}
          </oc-button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, unref, watch } from 'vue'
import { useRoute, useRouter } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { ALBUM_EXTENSION, AlbumFile, AlbumRef, albumTitle } from './albums'
import { useAlbums } from './composables/useAlbums'
import { useGraphSearch } from './composables/useGraphSearch'
import { MemoryPhoto } from './types'
import { formatCount, placeholderArtFor } from './helpers'
import PhotosBreadcrumb from './components/PhotosBreadcrumb.vue'
import QueryBuilder from './components/QueryBuilder.vue'

const PREVIEW_SIZE = 6

const route = useRoute()
const router = useRouter()
const { $gettext, $ngettext, current: currentLanguage } = useGettext()
const { readAlbum, saveAlbum } = useAlbums()
const { search, hitToPhoto, attachThumbnail } = useGraphSearch()

const isEditing = computed(() => unref(route).name === 'photos-album-edit')

const title = ref('')
const query = ref('')
const existingFile = ref<AlbumFile | undefined>(undefined)
const loading = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)

// visible text must come from loaded album files, never from route params
const breadcrumbItems = computed(() => {
  const items = [{ text: $gettext('Albums'), to: { name: 'photos-albums' } }]
  if (!isEditing.value) {
    items.push({ text: $gettext('New album'), to: undefined })
  } else if (existingFile.value) {
    items.push({ text: title.value, to: undefined })
  }
  return items
})

const previewTotal = ref<number | null>(null)
const previewPhotos = ref<MemoryPhoto[]>([])
const previewLoading = ref(false)

const canSave = computed(() => title.value.trim().length > 0 && query.value.trim().length > 0)

const previewCountLabel = computed(() =>
  $ngettext('%{ n } photo matches', '%{ n } photos match', previewTotal.value ?? 0, {
    n: formatCount(previewTotal.value ?? 0, currentLanguage)
  })
)

let previewTimer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(previewTimer)
  if (!query.value.trim()) {
    previewTotal.value = null
    previewPhotos.value = []
    return
  }
  previewLoading.value = true
  previewTimer = setTimeout(loadPreview, 450)
})

async function loadPreview() {
  try {
    const container = await search({ queryString: query.value, size: PREVIEW_SIZE })
    previewTotal.value = container.total ?? 0
    previewPhotos.value = (container.hits ?? [])
      .map(hitToPhoto)
      .filter((p): p is MemoryPhoto => p !== null)
    previewPhotos.value.forEach((p) => attachThumbnail(p))
  } catch {
    previewTotal.value = null
    previewPhotos.value = []
  } finally {
    previewLoading.value = false
  }
}

async function save() {
  saving.value = true
  saveError.value = null
  try {
    const ref = await saveAlbum(sanitizedTitle(), query.value.trim(), existingFile.value)
    await router.push({
      name: 'photos-album',
      query: { driveId: ref.driveId, path: ref.parentPath, name: ref.fileName }
    })
  } catch (e) {
    console.error('[photos] failed to save album', e)
    saveError.value = $gettext('The album could not be saved.')
  } finally {
    saving.value = false
  }
}

function sanitizedTitle(): string {
  return title.value.trim().replace(/[/\\]/g, '-')
}

onMounted(async () => {
  if (!isEditing.value) {
    return
  }
  loading.value = true
  try {
    const routeQuery = unref(route).query
    const albumRef: AlbumRef = {
      title: albumTitle(String(routeQuery.name ?? '')),
      fileName: String(routeQuery.name ?? ''),
      parentPath: String(routeQuery.path ?? ''),
      driveId: String(routeQuery.driveId ?? '')
    }
    if (!albumRef.fileName.endsWith(`.${ALBUM_EXTENSION}`)) {
      throw new Error('not an album file')
    }
    const file = await readAlbum(albumRef)
    // only adopt the route-provided title once the file was actually read
    existingFile.value = file
    title.value = albumRef.title
    query.value = file.query
  } catch (e) {
    console.error('[photos] failed to load album', e)
    saveError.value = $gettext('The album could not be loaded.')
  } finally {
    loading.value = false
  }
})
</script>
