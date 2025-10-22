<template>
  <div class="oc-pastebin oc-width-1-1 oc-height-1-1">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading pastebin folder...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <h2>Failed to load folder</h2>
      <p>{{ error }}</p>
    </div>

    <div v-else class="folder-container">
      <div v-if="publicPath" class="public-link-banner">
        <div class="public-link-content">
          <span class="public-link-label">🔗 Public Link:</span>
          <router-link :to="publicPath" class="public-link-url" target="_blank">
            {{ publicPath }}
          </router-link>
          <span class="public-link-password">Password: Foobar!64</span>
        </div>
      </div>

      <header class="folder-header">
        <h1>{{ folderName }}</h1>
        <div class="folder-stats">
          <span>{{ folderResources.length }} files</span>
        </div>
      </header>

      <div class="files-list">
        <div v-if="folderResources.length === 0" class="no-files">
          <p>No files found in this pastebin folder.</p>
        </div>
        <div v-else>
          <div
            class="debug-info"
            style="padding: 1rem; background: #f0f0f0; margin-bottom: 1rem; font-family: monospace"
          >
            <strong>Debug Info:</strong><br />
            Total resources: {{ folderResources.length }}<br />
            Resources:
            {{
              folderResources.map((r) => ({
                name: r.name,
                id: r.id,
                type: r.type,
                isFolder: r.isFolder
              }))
            }}
          </div>
          <PastebinFile
            v-for="file in folderResources.filter((r) => !r.isFolder)"
            :key="file.id"
            :resource="file"
            :space="space"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, unref } from 'vue'
import {
  FolderResource,
  Resource,
  isLinkShare,
  isPublicSpaceResource
} from '@opencloud-eu/web-client'
import {
  useClientService,
  useRouteParam,
  useResourcesStore,
  useDriveResolver,
  useSharesStore
} from '@opencloud-eu/web-pkg'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import PastebinFile from './components/PastebinFile.vue'

// FIXME: AppWrapperRoute is unhappy without defining props - maybe we should not be using it, but AppWrapperRoute should give a proper error message and not crash
interface Props {
  noop?: string // this must not be empty, see FIXME above
}
defineProps<Props>()

const driveAliasAndItem = useRouteParam('driveAliasAndItem')
const { space, item } = useDriveResolver({ driveAliasAndItem })
const resourcesStore = useResourcesStore()
const sharesStore = useSharesStore()
const clientService = useClientService()

const loading = ref(true)
const error = ref<string | null>(null)

const folderResources = ref<Resource[]>([])
const currentFolder = ref<FolderResource | null>(null)

const folderName = computed(() => {
  return currentFolder.value?.name || 'Pastebin Folder'
})

// Get public link for this folder
const publicLink = computed(() => {
  // const currentFolderValue = currentFolder.value
  // if (!currentFolderValue) return null

  console.log('item', currentFolder.value)

  // Find the link share for this folder resource
  return sharesStore.linkShares.find(
    (link) => link.resourceId === unref(currentFolder).id && !link.indirect
  )
})

const publicPath = computed(() => {
  const link = publicLink.value
  if (!link) return null

  const id = link.webUrl.split('/').pop()

  console.log('Public link found:', link.id, id)

  // Convert the normal link to pastebin show URL
  // Transform /files/link/public/hPPFDoRFoZXJEXD to /pastebin/show/public/hPPFDoRFoZXJEXD
  return `/pastebin/show/public/${id}`
})

// Load shares for the current folder
const loadShares = async (resource: Resource) => {
  if (!resource) return

  try {
    const client = clientService.graphAuthenticated.permissions
    const resolvedSpace = unref(space)

    if (!resolvedSpace) return

    console.log('Loading shares for resource:', {
      name: resource.name,
      fileId: resource.fileId
    })

    // Load permissions/shares for this resource
    const { shares } = await client.listPermissions(
      resolvedSpace.id,
      resource.fileId,
      sharesStore.graphRoles,
      {}
    )

    // Filter link shares from the permissions using the same logic as FileSideBar
    const loadedLinkShares = shares.filter(isLinkShare)

    console.log('Loaded link shares:', loadedLinkShares)
    sharesStore.setLinkShares(loadedLinkShares)
  } catch (err) {
    console.error('Failed to load shares:', err)
  }
}

const loadFolderContents = async () => {
  try {
    loading.value = true
    error.value = null

    const resolvedSpace = unref(space)
    const resolvedPath = unref(item)

    console.log('Loading folder for space:', resolvedSpace?.name, 'path:', resolvedPath)

    if (!resolvedSpace || !resolvedPath) {
      throw new Error('Space or path not resolved yet')
    }

    // Load folder contents directly using WebDAV like loadFolderForFileContext does
    const webdav = clientService.webdav as WebDAV
    const { resource: folder, children } = await webdav.listFiles(resolvedSpace, {
      path: resolvedPath
    })

    console.log('Loaded folder:', folder.name, 'with', children.length, 'children')
    console.log(
      'Children:',
      children.map((c) => ({ name: c.name, type: c.type, isFolder: c.isFolder }))
    )

    // Initialize the resource store with the children (files)
    resourcesStore.initResourceList({
      currentFolder: folder,
      resources: children
    })
    folderResources.value = children
    currentFolder.value = folder
    console.log('Resources store initialized with folder contents:', resourcesStore.resources)

    // Load shares for this folder to get the public link (only if not in a public space)
    if (!isPublicSpaceResource(resolvedSpace)) {
      loadShares(folder)
    }
  } catch (err: any) {
    console.error('Failed to load folder contents:', err)
    error.value = err.message || 'Failed to load folder contents'
  } finally {
    loading.value = false
  }
}

// Load folder contents when space and item are resolved
watch(
  [space, item],
  ([newSpace, newItem]) => {
    console.log('Space/Item resolved, loading folder contents...', newSpace?.name, newItem)
    if (newSpace && newItem) {
      loadFolderContents()
    } else {
      console.warn('Space or item not resolved yet, skipping load', newSpace, newItem)
    }
  },
  { immediate: true }
)
</script>
<style lang="scss">
.oc-pastebin {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;

  .loading-spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  h2 {
    color: var(--oc-color-swatch-danger-default);
    margin-bottom: 1rem;
  }

  p {
    color: var(--oc-color-text-muted);
  }
}

.folder-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.public-link-banner {
  background: var(--oc-color-background-highlight);
  border: 1px solid var(--oc-color-swatch-primary-muted);
  border-radius: 6px;
  margin: 1rem;
  padding: 1rem;
  flex-shrink: 0;

  .public-link-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;

    .public-link-label {
      font-weight: 600;
      color: var(--oc-color-swatch-primary-default);
      font-size: 0.9rem;
    }

    .public-link-url {
      flex: 1;
      min-width: 200px;
      font-family: monospace;
      color: var(--oc-color-swatch-primary-default);
      text-decoration: none;
      padding: 0.25rem 0.5rem;
      background: var(--oc-color-background-default);
      border: 1px solid var(--oc-border-color);
      border-radius: 4px;
      font-size: 0.875rem;

      &:hover {
        text-decoration: underline;
        background: var(--oc-color-background-hover);
      }
    }

    .public-link-password {
      color: var(--oc-color-text-muted);
      font-size: 0.875rem;
      font-weight: 500;
    }
  }
}

.folder-header {
  padding: 1rem;
  border-bottom: 1px solid var(--oc-border-color);
  background: var(--oc-color-background-highlight);
  flex-shrink: 0;

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: var(--oc-color-text-default);
  }

  .folder-stats {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--oc-color-text-muted);

    span {
      padding: 0.25rem 0.5rem;
      background: var(--oc-color-background-default);
      border-radius: 4px;
    }
  }
}

.files-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;

  .no-files {
    text-align: center;
    padding: 2rem;
    color: var(--oc-color-text-muted);
  }
}
</style>
