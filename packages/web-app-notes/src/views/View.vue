<template>
  <main class="flex app-content size-full rounded-l-xl gap-4">
    <AppLoadingSpinner v-if="isLoading" />
    <template v-else>
      <TocWrapper class="w-sm min-w-[14rem] max-w-[20rem] px-4" />
      <div class="w-full">
        <NoPageSelected v-if="!documentResource" />
        <TextEditor
          v-else
          :resource="documentResource"
          :current-content="documentContent"
          :is-read-only="isReadOnly"
          :application-config="{}"
          @update:current-content="setDocumentContent"
        />
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import NoPageSelected from '../components/NoPageSelected.vue'
import TocWrapper from '../components/TocWrapper.vue'
import { AppLoadingSpinner } from '@opencloud-eu/web-pkg'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { computed, onBeforeUnmount, unref, watchEffect } from 'vue'
import {
  TextEditor,
  useRouteQuery,
  queryItemAsString,
  useClientService
} from '@opencloud-eu/web-pkg'
import { useDocumentStore, useLoadToc, useNotebookStore, useTocStore } from '../composables'
import { storeToRefs } from 'pinia'

const { webdav } = useClientService()

const {
  space,
  resource,
  isReadOnly = false
} = defineProps<{
  currentContent: string
  space: SpaceResource
  resource: Resource
  isReadOnly?: boolean
}>()

const notebookStore = useNotebookStore()
const tocStore = useTocStore()
const { loadToc } = useLoadToc()
watchEffect(async () => {
  notebookStore.setNotebook(space, resource)
  await loadToc()
})
const isLoading = computed(() => {
  return !notebookStore.isLoaded || !tocStore.isLoaded
})

const pageFileIdQuery = useRouteQuery('pageFileId', '')
const pageFileId = computed(() => {
  return queryItemAsString(unref(pageFileIdQuery))
})
const documentStore = useDocumentStore()
const { setDocumentContent } = documentStore
const { documentResource, documentContent } = storeToRefs(documentStore)
watchEffect(async () => {
  if (!unref(pageFileId)) {
    return
  }
  const path = await webdav.getPathForFileId(unref(pageFileId))
  const [resource, content] = await Promise.all([
    webdav.getFileInfo(space, { fileId: unref(pageFileId), path }),
    webdav.getFileContents(space, { fileId: unref(pageFileId), path })
  ])
  documentStore.setDocument(resource, content.body)
})

onBeforeUnmount(() => {
  notebookStore.clearNotebook()
  tocStore.clearTocNodes()
  documentStore.clearDocument()
})
</script>
