<template>
  <main class="flex app-content size-full rounded-l-xl gap-4">
    <TocWrapper
      class="w-sm min-w-[12rem] max-w-[20rem] px-4"
      :space="space"
      :notebook-resource="resource"
      :page-resource="pageResource"
      :page-content-dirty="isPageContentDirty"
      @save-page="savePage"
    />
    <div class="w-full">
      <NoPageSelected v-if="!pageResource" />
      <TextEditor
        v-else
        :resource="pageResource"
        :current-content="pageContent"
        :is-read-only="isReadOnly"
        :application-config="{}"
        @update:current-content="updatePageContent"
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { computed, ref, unref, watch } from 'vue'
import { useTask } from 'vue-concurrency'
import {
  TextEditor,
  useRouteQuery,
  queryItemAsString,
  useClientService
} from '@opencloud-eu/web-pkg'
import TocWrapper from '../components/TocWrapper.vue'
import NoPageSelected from '../components/NoPageSelected.vue'

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

const pageFileIdQuery = useRouteQuery('pageFileId', '')
const pageFileId = computed(() => {
  return queryItemAsString(unref(pageFileIdQuery))
})
const pageResource = ref<Resource>()
const pageContentInitial = ref<string>('')
const pageContent = ref<string>('')
const isPageContentDirty = computed(() => {
  return unref(pageContentInitial) !== unref(pageContent)
})
const updatePageContent = (content: string) => {
  pageContent.value = content
}

const savePageTask = useTask(function* (signal, newContent) {
  const resource = unref(pageResource)
  try {
    pageResource.value = yield webdav.putFileContents(space, {
      fileName: resource.name,
      parentFolderId: resource.parentFolderId,
      path: resource.path,
      previousEntityTag: resource.etag,
      content: newContent,
      signal
    })
    pageContentInitial.value = newContent
  } catch (e) {
    // TODO: extract the error handling from useAppDefaults.ts
    console.error('Failed to save the new page content', e)
  }
}).drop()
const savePage = async () => {
  await savePageTask.perform(unref(pageContent))
}

watch(
  pageFileId,
  async (fileId) => {
    if (!fileId) {
      return
    }
    const path = await webdav.getPathForFileId(fileId)
    const [resource, content] = await Promise.all([
      webdav.getFileInfo(space, { fileId, path }),
      webdav.getFileContents(space, { fileId, path })
    ])
    pageResource.value = resource
    pageContent.value = content.body
    pageContentInitial.value = content.body
  },
  { immediate: true }
)
</script>
