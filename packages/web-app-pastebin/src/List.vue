<template>
  <div class="ext:flex ext:flex-col ext:h-full">
    <AppHeader>
      <template #title>{{ $gettext('Your Pastebins') }}</template>
      <template #actions>
        <oc-button
          type="router-link"
          :to="{ name: 'pastebin-create' }"
          appearance="filled"
          size="small"
        >
          <oc-icon name="add" size="small" class="ext:mr-1" />
          {{ $gettext('New') }}
        </oc-button>
      </template>
    </AppHeader>

    <div class="ext:flex-1 ext:overflow-y-auto ext:p-5">
      <div class="ext:max-w-4xl ext:mx-auto">
        <div v-if="loading" class="ext:flex ext:justify-center ext:py-12">
          <oc-spinner size="medium" :aria-label="$gettext('Loading pastebins')" />
        </div>

        <div
          v-else-if="pastebins.length === 0"
          class="ext:text-center ext:py-12 ext:text-[var(--oc-role-on-surface-variant)]"
        >
          <p class="ext:mb-4">{{ $gettext('No pastebins yet.') }}</p>
          <oc-button
            type="router-link"
            :to="{ name: 'pastebin-create' }"
            appearance="filled"
            size="medium"
          >
            {{ $gettext('Create your first pastebin') }}
          </oc-button>
        </div>

        <div v-else class="ext:flex ext:flex-col ext:gap-2">
          <router-link
            v-for="pb in pastebins"
            :key="pb.id"
            :to="getPastebinRoute(pb)"
            class="pastebin-item ext:flex ext:items-center ext:gap-3 ext:px-4 ext:py-3 ext:rounded-lg ext:border ext:border-[var(--oc-role-outline-variant)] ext:bg-[var(--oc-role-surface)] ext:no-underline ext:text-[var(--oc-role-on-surface)]"
          >
            <oc-icon
              name="file-text"
              size="small"
              class="ext:text-[var(--oc-role-on-surface-variant)]"
            />
            <div class="ext:flex-1 ext:min-w-0">
              <div class="ext:text-sm ext:font-medium ext:truncate">
                {{ getPastebinDisplayName(pb) }}
              </div>
            </div>
            <span
              class="ext:text-xs ext:text-[var(--oc-role-on-surface-variant)] ext:whitespace-nowrap"
              >{{ formatDate(pb.mdate, currentLanguage) }}</span
            >
            <oc-button
              appearance="raw"
              size="small"
              class="delete-btn"
              :title="$gettext('Delete')"
              @click.prevent.stop="deletePastebin(pb)"
            >
              <oc-icon name="delete-bin" size="small" />
            </oc-button>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import { useClientService, useSpacesStore, contextRouteNameKey } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import AppHeader from './components/AppHeader.vue'
import { displayName, formatDate, PASTEBIN_BASE_PATH } from './utils'
import { useDeletePastebin } from './composables/useDeletePastebin'

const { $gettext, current: currentLanguage } = useGettext()
const clientService = useClientService()
const spacesStore = useSpacesStore()
const { deletePastebin: dispatchDeletePastebin } = useDeletePastebin()

const pastebins = ref<Resource[]>([])
const loading = ref(true)

const getPastebinRoute = (pb: Resource) => {
  const driveAliasAndItem = spacesStore.personalSpace!.getDriveAliasAndItem(pb)
  return {
    name: 'pastebin-view',
    params: { driveAliasAndItem },
    query: { fileId: pb.fileId, [contextRouteNameKey]: 'pastebin-list' }
  }
}

const getPastebinDisplayName = (pb: Resource) => displayName(pb.name, currentLanguage)

const deletePastebin = (pb: Resource) => {
  dispatchDeletePastebin(spacesStore.personalSpace!, pb, getPastebinDisplayName(pb), () => {
    pastebins.value = pastebins.value.filter((p) => p.id !== pb.id)
  })
}

onMounted(async () => {
  if (!spacesStore.personalSpace) {
    loading.value = false
    return
  }

  try {
    const { children } = await clientService.webdav.listFiles(spacesStore.personalSpace, {
      path: PASTEBIN_BASE_PATH
    })
    pastebins.value = children
      .filter((r) => r.isFolder && r.name.endsWith('.ocpb'))
      .sort((a, b) => new Date(b.mdate).getTime() - new Date(a.mdate).getTime())
  } catch {
    // folder may not exist yet
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.pastebin-item {
  transition: background-color 0.15s;
}

.pastebin-item:hover {
  background-color: var(--oc-role-surface-container-high);
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.15s;
}

.pastebin-item:hover .delete-btn {
  opacity: 1;
}
</style>
