<template>
  <main class="ext:flex ext:size-full ext:rounded-l-xl">
    <AppLoadingSpinner v-if="isLoading" />
    <template v-else>
      <TocWrapper class="ext:w-sm ext:min-w-[14rem] ext:max-w-[20rem] ext:px-4" />
      <div class="ext:w-full">
        <NoPageSelected v-if="!documentResource" />
        <TextEditorProvider v-else :editor="textEditor">
          <TextEditorToolbar />
          <TextEditorContent />
        </TextEditorProvider>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import NoPageSelected from '../components/NoPageSelected.vue'
import TocWrapper from '../components/TocWrapper.vue'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { computed, onBeforeUnmount, onMounted, unref, watchEffect } from 'vue'
import {
  AppLoadingSpinner,
  UnsavedChangesModal,
  queryItemAsString,
  useClientService,
  useModals,
  useRouteQuery,
  useRouter
} from '@opencloud-eu/web-pkg'
import {
  useTextEditor,
  TextEditorProvider,
  TextEditorContent,
  TextEditorToolbar
} from '@opencloud-eu/web-pkg/editor'
import {
  useActionsSaveCurrentDocument,
  useDocumentStore,
  useLoadToc,
  useNotebookStore,
  useSSE,
  useTocStore
} from '../composables'
import { storeToRefs } from 'pinia'
import { useGettext } from 'vue3-gettext'

const { $gettext } = useGettext()
const { webdav } = useClientService()
const { dispatchModal } = useModals()
const { registerSSE, deregisterSSE } = useSSE()
const { savePage } = useActionsSaveCurrentDocument()
const router = useRouter()

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
const { documentResource, documentContent, isDocumentDirty } = storeToRefs(documentStore)
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

const textEditor = useTextEditor({
  contentType: 'markdown',
  modelValue: documentContent,
  readonly: isReadOnly,
  onUpdate: setDocumentContent
})

let unregisterRouterGuard: (() => void) | undefined
const preventBrowserClose = (e: Event) => {
  if (unref(isDocumentDirty)) {
    e.preventDefault()
  }
}

onMounted(() => {
  registerSSE()

  // register document-content safeguards
  window.addEventListener('beforeunload', preventBrowserClose)
  unregisterRouterGuard = router.beforeEach((_to, _from, next) => {
    if (unref(isDocumentDirty)) {
      dispatchModal({
        title: $gettext('Unsaved changes'),
        customComponent: UnsavedChangesModal,
        focusTrapInitial: '.oc-modal-body-actions-confirm',
        hideActions: true,
        customComponentAttrs: () => {
          return {
            closeCallback: () => {
              next()
            }
          }
        },
        async onConfirm() {
          await savePage(() => {
            next()
          })
        }
      })
      return
    }
    next()
  })
})

onBeforeUnmount(() => {
  notebookStore.clearNotebook()
  tocStore.clearTocNodes()
  documentStore.clearDocument()
  deregisterSSE()

  // unregister document-content safeguards
  unregisterRouterGuard?.()
  window.removeEventListener('beforeunload', preventBrowserClose)
})
</script>
