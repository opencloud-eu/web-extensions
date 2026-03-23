<template>
  <div class="ext:flex ext:flex-col ext:size-full">
    <div v-if="loading" class="ext:flex ext:items-center ext:justify-center ext:h-full">
      <oc-spinner size="medium" />
    </div>

    <div
      v-else-if="error"
      class="ext:flex ext:flex-col ext:items-center ext:justify-center ext:h-full ext:text-center"
    >
      <h2 class="ext:text-[var(--oc-role-error)] ext:mb-4">{{ $gettext('Failed to load') }}</h2>
      <p class="ext:text-[var(--oc-role-on-surface-variant)]">{{ error }}</p>
    </div>

    <template v-else>
      <AppHeader>
        <template #title>
          <template v-if="isAuthenticated">
            <router-link
              :to="{ name: 'pastebin-list' }"
              class="ext:no-underline ext:opacity-60 hover:ext:opacity-100"
              >{{ $gettext('Your Pastebins') }}</router-link
            >
            <span class="ext:mx-2 ext:opacity-40">/</span>
          </template>
          {{ folderName }}
          <!-- Using <a> intentionally: the href enables standard browser link interactions
               (open in new tab, copy link address) while @click.prevent adds clipboard copy -->
          <a
            v-if="shareUrl"
            :href="shareUrl"
            target="_blank"
            class="ext:inline-flex ext:items-center ext:ml-2 ext:opacity-40 hover:ext:opacity-100 ext:align-middle"
            :title="$gettext('Copy public link')"
            @click.prevent="copyShareUrl"
          >
            <oc-icon :name="shareCopied ? 'checkbox-circle' : 'link'" size="small" />
          </a>
        </template>
        <template #actions>
          <template v-if="isAuthenticated">
            <oc-button appearance="outline" size="small" @click="deletePastebin">
              <oc-icon name="delete-bin" size="small" class="ext:mr-1" />
              {{ $gettext('Delete') }}
            </oc-button>
            <oc-button
              v-if="!isReadOnly"
              type="router-link"
              :to="editRoute"
              appearance="outline"
              size="small"
            >
              <oc-icon name="edit" size="small" class="ext:mr-1" />
              {{ $gettext('Edit') }}
            </oc-button>
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
        </template>
      </AppHeader>

      <div class="ext:flex-1 ext:overflow-y-auto ext:px-5 ext:py-6 ext:scroll-smooth">
        <div class="ext:max-w-4xl ext:mx-auto">
          <div
            v-if="folderResources.length === 0"
            class="ext:text-center ext:py-12 ext:text-[var(--oc-role-on-surface-variant)]"
          >
            {{ $gettext('No files in this pastebin.') }}
          </div>
          <PastebinFile
            v-for="file in folderResources.filter((r) => !r.isFolder)"
            :key="file.id"
            :resource="file"
            :space="space"
            :share-url="shareUrl"
            :folder-file-id="currentFolder?.fileId"
            @loaded="onFileLoaded"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, unref, watch } from 'vue'
import {
  FolderResource,
  LinkShare,
  Resource,
  SpaceResource,
  isLinkShare,
  isPublicSpaceResource,
  urlJoin
} from '@opencloud-eu/web-client'
import {
  queryItemAsString,
  useClientService,
  useConfigStore,
  useResourcesStore,
  useRouteQuery,
  useRouter,
  useSharesStore,
  contextRouteNameKey
} from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useClipboard } from '@vueuse/core'
import AppHeader from './components/AppHeader.vue'
import PastebinFile from './components/PastebinFile.vue'
import {
  parsePastebinName,
  loadManifest,
  loadRevisionFiles,
  scrollToFile,
  type PastebinManifest
} from './utils'
import { useDeletePastebin } from './composables/useDeletePastebin'

const {
  space,
  resource,
  isReadOnly = false
} = defineProps<{
  space: SpaceResource
  resource: Resource
  isReadOnly?: boolean
}>()

const { $gettext } = useGettext()
const resourcesStore = useResourcesStore()
const sharesStore = useSharesStore()
const clientService = useClientService()
const configStore = useConfigStore()
const router = useRouter()
const { deletePastebin: dispatchDeletePastebin } = useDeletePastebin()
const isAuthenticated = computed(() => !isPublicSpaceResource(space))

const loading = ref(true)
const error = ref<string | null>(null)
const folderResources = ref<Resource[]>([])
const currentFolder = ref<FolderResource | null>(null)
const manifest = ref<PastebinManifest | null>(null)

const folderName = computed(() => {
  // Manifest title (works for both authenticated and public)
  if (manifest.value?.title) return manifest.value.title

  // Authenticated: use the link's displayName
  const link = publicLink.value
  if (link?.displayName) return link.displayName

  // Parse title from folder name (.ocpb)
  const name = currentFolder.value?.name || resource.name || ''
  const { title } = parsePastebinName(name)
  if (title) return title

  return name.replace(/\.ocpb$/, '') || $gettext('Pastebin')
})

const editRoute = computed(() => {
  const driveAliasAndItem = space.getDriveAliasAndItem(resource)
  return {
    name: 'pastebin-edit',
    params: { driveAliasAndItem },
    query: { fileId: resource.fileId, [contextRouteNameKey]: 'pastebin-list' }
  }
})

const shareUrl = ref('')

const publicLink = computed(() => {
  const folder = currentFolder.value
  if (!folder) return null
  return sharesStore.linkShares.find(
    (link: LinkShare) => link.resourceId === folder.id && !link.indirect
  )
})

// Resolve share URL once and keep it stable even if the store resets
watch(publicLink, (link) => {
  if (shareUrl.value || !link) return
  const token = link.webUrl.split('/').pop()
  shareUrl.value = urlJoin(configStore.serverUrl, 'pastebin', 'view', 'public', token)
})

const { copy: copyToClipboard, copied: shareCopied } = useClipboard({
  legacy: true,
  copiedDuring: 1500
})
const copyShareUrl = () => copyToClipboard(shareUrl.value)

const deletePastebin = () => {
  dispatchDeletePastebin(space, resource, folderName.value, async () => {
    await router.push({ name: 'pastebin-list' })
  })
}

const scrollToQuery = useRouteQuery('scrollTo')
const scrollTarget = computed(() => queryItemAsString(unref(scrollToQuery)))
const filesLoadedCount = ref(0)
const totalFiles = computed(() => folderResources.value.filter((r) => !r.isFolder).length)

const onFileLoaded = async () => {
  filesLoadedCount.value++
  if (filesLoadedCount.value < totalFiles.value) return
  const target = scrollTarget.value
  if (!target) return

  await nextTick()
  scrollToFile(target)
}

const loadShares = async (folderResource: Resource) => {
  try {
    const client = clientService.graphAuthenticated.permissions
    const { shares } = await client.listPermissions(
      space.id,
      folderResource.fileId,
      sharesStore.graphRoles,
      {}
    )
    sharesStore.setLinkShares(shares.filter(isLinkShare))
  } catch (err) {
    console.error('Failed to load shares:', err)
  }
}

onMounted(async () => {
  try {
    loading.value = true
    const { webdav } = clientService

    // Load root of .ocpb folder
    const { resource: folder, children } = await webdav.listFiles(space, {
      path: resource.path
    })
    currentFolder.value = folder

    // Load manifest
    manifest.value = await loadManifest(webdav, space, resource.path)

    // Load files from revision 0 (or flat fallback)
    const result = await loadRevisionFiles(webdav, space, resource.path, children)
    folderResources.value = result.files.sort((a, b) => a.name.localeCompare(b.name))
    resourcesStore.initResourceList({ currentFolder: folder, resources: folderResources.value })

    if (!isPublicSpaceResource(space)) {
      loadShares(folder)
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : $gettext('Failed to load pastebin')
  } finally {
    loading.value = false
  }
})
</script>
