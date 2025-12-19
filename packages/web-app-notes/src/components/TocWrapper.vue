<template>
  <div class="overflow-auto">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h2>{{ $gettext('Notes') }}</h2>
    </div>
    <TocList
      class="toc-tree text-sm"
      :nodes="tocNodes"
      :active-file-id="pageResource?.id"
      :active-file-dirty="pageContentDirty"
      @open="openPage"
      @save="$emit('savePage')"
    />
  </div>
</template>

<script setup lang="ts">
import TocList from './TocList.vue'
import { useGettext } from 'vue3-gettext'
import { ref, unref, watch } from 'vue'
import { TocNode } from '../types'
import { appId } from '../util'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { createFileRouteOptions, useClientService, useRouter } from '@opencloud-eu/web-pkg'

const { $gettext } = useGettext()
const router = useRouter()
const { webdav } = useClientService()

const {
  space,
  notebookResource,
  pageResource = undefined,
  pageContentDirty = false
} = defineProps<{
  space: SpaceResource
  notebookResource: Resource
  pageResource?: Resource
  pageContentDirty?: boolean
}>()
defineEmits<{
  (e: 'savePage'): void
}>()

const tocNodes = ref<TocNode[]>([])

const sortTocNodes = (a: TocNode, b: TocNode) => {
  if (a.resource.isFolder === b.resource.isFolder) {
    return a.resource.name.toLowerCase().localeCompare(b.resource.name.toLowerCase())
  }
  return a.resource.isFolder ? 1 : -1
}

const listFolderRecursive = async (
  space: SpaceResource,
  resource: Resource
): Promise<TocNode[]> => {
  const { children } = await webdav.listFiles(space, resource)
  const folders: TocNode[] = []
  const pages: TocNode[] = []
  for (const entry of children) {
    if (entry.isFolder) {
      folders.push({
        resource: entry,
        children: await listFolderRecursive(space, entry)
      })
    } else if (entry.mimeType === 'text/markdown') {
      pages.push({
        resource: entry,
        children: []
      })
    }
  }
  return [...folders.sort(sortTocNodes), ...pages.sort(sortTocNodes)]
}

const buildToc = async () => {
  try {
    tocNodes.value = await listFolderRecursive(space, unref(notebookResource))
  } catch (e) {
    console.error('Failed to build table of contents', e)
  }
}

const openPage = (node: TocNode) => {
  if (node.resource.isFolder) {
    return
  }
  const routeOptions = createFileRouteOptions(space, unref(notebookResource))
  router.push({
    name: `${appId}-view`,
    params: routeOptions.params,
    query: {
      ...routeOptions.query,
      pageFileId: node.resource.fileId
    }
  })
}

watch(
  () => notebookResource.id,
  async () => {
    await buildToc()
  },
  { immediate: true }
)
</script>
