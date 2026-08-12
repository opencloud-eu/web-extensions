<template>
  <div class="ext:h-full ext:overflow-y-auto ext:bg-role-surface">
    <div class="ext:flex ext:flex-col ext:gap-6 ext:px-4 ext:py-4">
      <header>
        <div class="ext:flex ext:flex-wrap ext:items-center ext:justify-between ext:gap-4">
          <photos-breadcrumb :items="[{ text: $gettext('Albums') }]" class="ext:min-w-0" />
          <oc-button
            type="router-link"
            :to="{ name: 'photos-album-new' }"
            appearance="filled"
            size="small"
          >
            <oc-icon name="add" size="small" class="ext:mr-1" />
            {{ $gettext('New album') }}
          </oc-button>
        </div>
        <p class="ext:m-0 ext:mt-3 ext:text-sm ext:text-role-on-surface-variant">
          {{ $gettext('An album is a saved search across your photo library.') }}
        </p>
      </header>

      <div v-if="loading" class="ext:flex ext:justify-center ext:py-24">
        <oc-spinner size="medium" :aria-label="$gettext('Loading albums')" />
      </div>

      <no-content-message v-else-if="!albums.length" icon="gallery" class="ext:py-16">
        <template #message>
          <span>{{
            $gettext('No albums yet. An album is just a query, create your first one.')
          }}</span>
        </template>
        <template #callToAction>
          <oc-button
            type="router-link"
            :to="{ name: 'photos-album-new' }"
            appearance="filled"
            size="medium"
          >
            {{ $gettext('Create your first album') }}
          </oc-button>
        </template>
      </no-content-message>

      <div v-else class="ext:grid ext:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] ext:gap-4">
        <album-card v-for="album in albums" :key="album.id ?? album.fileName" :album="album" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import { AlbumRef } from './albums'
import { useAlbums } from './composables/useAlbums'
import AlbumCard from './components/AlbumCard.vue'
import PhotosBreadcrumb from './components/PhotosBreadcrumb.vue'

const { listAlbums } = useAlbums()

const albums = ref<AlbumRef[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    albums.value = await listAlbums()
  } finally {
    loading.value = false
  }
})
</script>
