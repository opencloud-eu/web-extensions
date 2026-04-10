<template>
  <main class="notes-shell ext:min-h-full ext:p-4 md:ext:p-6">
    <AppLoadingSpinner v-if="isLoading" />

    <template v-else>
      <section class="notes-layout">
        <header class="notes-hero ext:rounded-2xl ext:p-4 md:ext:p-5">
          <div class="notes-hero__layout">
            <div class="notes-hero__content ext:max-w-3xl">
              <h1 class="ext:mt-2 ext:mb-1 ext:text-2xl md:ext:text-3xl">
                {{ notebookTitle }}
              </h1>
              <p class="notes-hero__copy ext:mb-0 ext:text-sm md:ext:text-base">
                {{
                  $gettext(
                    'Markdown pages, nested sections and file-native structure. Fast enough for working notes, boring enough to stay maintainable.'
                  )
                }}
              </p>
            </div>

            <div class="notes-hero__search">
              <oc-text-input
                v-model="filterTerm"
                :label="$gettext('Search notes')"
                :clear-button-enabled="true"
                :fix-message-line="true"
                :placeholder="$gettext('Find a note by title')"
              />
              <p class="notes-hero__summary ext:mt-2 ext:mb-0 ext:text-sm">
                {{ searchSummary }}
              </p>
            </div>
          </div>

          <div class="notes-hero__stats ext:mt-4">
            <div class="notes-stat-chip">
              <span class="notes-stat-chip__value">{{ noteCount }}</span>
              <span>{{ $gettext('pages') }}</span>
            </div>
            <div class="notes-stat-chip">
              <span class="notes-stat-chip__value">{{ folderCount }}</span>
              <span>{{ $gettext('sections') }}</span>
            </div>
            <div class="notes-stat-chip" :class="{ 'notes-stat-chip--dirty': isDocumentDirty }">
              <span class="notes-stat-chip__value">{{ statusLabel }}</span>
              <span>{{ $gettext('editor state') }}</span>
            </div>
          </div>
        </header>

        <div class="notes-workspace">
          <oc-card class="notes-panel notes-panel--sidebar bg-role-surface-container ext:border">
            <FolderSidebar class="ext:h-full" :filter-term="filterTerm" />
          </oc-card>

          <oc-card class="notes-panel notes-panel--editor bg-role-surface-container ext:border">
            <div class="notes-editor">
              <div class="notes-editor__header ext:px-5 ext:py-4 md:ext:px-6">
                <div class="notes-editor__header-layout">
                  <div class="ext:min-w-0">
                    <p class="notes-editor__eyebrow ext:mb-2">{{ $gettext('Current page') }}</p>
                    <h2 class="ext:my-0 ext:truncate ext:text-2xl">{{ documentTitle }}</h2>
                    <p class="notes-editor__subcopy ext:mt-2 ext:mb-0">
                      {{ documentSubtitle }}
                    </p>
                  </div>

                  <span class="notes-status-pill" :class="{ 'notes-status-pill--dirty': isDocumentDirty }">
                    {{ statusLabel }}
                  </span>
                </div>
              </div>

              <div class="ext:min-h-0 ext:flex-1 ext:overflow-hidden">
                <NoPageSelected v-if="!documentResource" :filter-term="filterTerm" :note-count="noteCount" />
                <TextEditor
                  v-else
                  :resource="documentResource"
                  :current-content="documentContent"
                  :is-read-only="isReadOnly"
                  :application-config="{}"
                  @update:current-content="setDocumentContent"
                />
              </div>
            </div>
          </oc-card>
        </div>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import FolderSidebar from '../components/FolderSidebar.vue'
import NoPageSelected from '../components/NoPageSelected.vue'
import { extractNameWithoutExtension, Resource, SpaceResource } from '@opencloud-eu/web-client'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, unref, watchEffect } from 'vue'
import {
  AppLoadingSpinner,
  // @ts-ignore
  TextEditor,
  UnsavedChangesModal,
  queryItemAsString,
  useClientService,
  useModals,
  useRouteQuery,
  useRouter
} from '@opencloud-eu/web-pkg'
import {
  useActionsSaveCurrentDocument,
  useDocumentStore,
  useFolderStore,
  useLoadToc,
  useNotebookStore,
  useSSE,
  useTocStore
} from '../composables'
import { useGettext } from 'vue3-gettext'
import { countFolders, countNotes, getResourceLabel, searchNoteNodes } from '../util'

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
const folderStore = useFolderStore()
const tocStore = useTocStore()
const { notebook } = storeToRefs(notebookStore)
const { tocNodes } = storeToRefs(tocStore)
const { loadToc } = useLoadToc()
watchEffect(async () => {
  if (
    notebookStore.space?.id === space?.id &&
    notebookStore.notebook?.id === resource?.id &&
    tocStore.isLoaded
  ) {
    return
  }

  folderStore.clearActiveFolder()
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
const filterTerm = ref('')

const notebookTitle = computed(() => {
  return notebook.value ? getResourceLabel(notebook.value) : $gettext('Notes')
})

const noteCount = computed(() => countNotes(unref(tocNodes) || []))
const folderCount = computed(() => countFolders(unref(tocNodes) || []))
const searchMatchCount = computed(() => searchNoteNodes(unref(tocNodes) || [], unref(filterTerm)).length)

const searchSummary = computed(() => {
  if (unref(filterTerm).trim()) {
    return $gettext('%{count} matching pages', { count: searchMatchCount.value })
  }

  return $gettext('%{notes} pages across %{folders} sections', {
    notes: noteCount.value,
    folders: folderCount.value
  })
})

const documentTitle = computed(() => {
  if (!unref(documentResource)) {
    return $gettext('Nothing open yet')
  }

  return extractNameWithoutExtension(unref(documentResource))
})

const documentSubtitle = computed(() => {
  if (!unref(documentResource)) {
    if (unref(filterTerm).trim()) {
      return $gettext('Use the search results in the navigator to jump straight into a page.')
    }

    return $gettext('Select a page from the navigator or create a new note to begin writing.')
  }

  return $gettext('Markdown page inside %{name}', { name: notebookTitle.value })
})

const statusLabel = computed(() => {
  if (!unref(documentResource)) {
    return $gettext('Ready')
  }

  return unref(isDocumentDirty) ? $gettext('Unsaved') : $gettext('Saved')
})

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

let unregisterRouterGuard: (() => void) | undefined
const preventBrowserClose = (e: Event) => {
  if (unref(isDocumentDirty)) {
    e.preventDefault()
  }
}

onMounted(() => {
  registerSSE()

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
  folderStore.clearActiveFolder()
  notebookStore.clearNotebook()
  tocStore.clearTocNodes()
  documentStore.clearDocument()
  deregisterSSE()

  unregisterRouterGuard?.()
  window.removeEventListener('beforeunload', preventBrowserClose)
})
</script>

<style scoped>
.notes-shell {
  height: 100%;
  overflow: auto;
  background:
    radial-gradient(circle at top left, rgba(244, 187, 68, 0.14), transparent 28%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.03), transparent 34%);
}

.notes-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.notes-hero,
.notes-panel {
  border-color: var(--oc-role-outline-variant, #d7dde5);
}

.notes-hero {
  background:
    linear-gradient(135deg, rgba(244, 187, 68, 0.08), rgba(37, 99, 235, 0.05) 42%, transparent 72%),
    var(--oc-role-surface-container, var(--oc-role-surface, transparent));
  border: 1px solid var(--oc-role-outline-variant, #d7dde5);
}

.notes-hero__layout {
  display: grid;
  gap: 1.25rem;
}

.notes-hero__search {
  width: 100%;
  max-width: 32rem;
}

.notes-hero__eyebrow,
.notes-status-pill,
.notes-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--oc-role-outline-variant, #d7dde5);
  background: var(--oc-role-surface-container, var(--oc-color-interaction-hover));
}

.notes-hero__eyebrow {
  padding: 0.45rem 0.85rem;
  font-size: 0.84rem;
  font-weight: 700;
}

.notes-hero__copy,
.notes-hero__summary,
.notes-editor__subcopy,
.notes-editor__eyebrow {
  color: var(--oc-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}

.notes-hero__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.notes-workspace {
  display: grid;
  gap: 1rem;
  align-items: start;
}

.notes-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.notes-panel--sidebar {
  max-height: min(32rem, 48vh);
}

.notes-panel--editor {
  min-height: clamp(20rem, 44vh, 34rem);
}

.notes-editor {
  display: flex;
  height: 100%;
  min-height: inherit;
  flex-direction: column;
}

.notes-stat-chip {
  padding: 0.5rem 0.85rem;
  font-size: 0.85rem;
}

.notes-stat-chip__value {
  font-weight: 800;
}

.notes-stat-chip--dirty,
.notes-status-pill--dirty {
  background: rgba(244, 187, 68, 0.18);
}

.notes-editor__header {
  border-bottom: 1px solid var(--oc-role-outline-variant, #d7dde5);
}

.notes-editor__eyebrow {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.notes-editor__header-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notes-status-pill {
  padding: 0.5rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 700;
}

@media (min-width: 48rem) {
  .notes-editor__header-layout {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
}

@media (min-width: 64rem) {
  .notes-layout {
    height: 100%;
  }

  .notes-hero__layout {
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem);
    align-items: end;
  }

  .notes-workspace {
    flex: 1 1 0;
    min-height: 0;
    grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
    align-items: stretch;
  }

  .notes-panel--sidebar,
  .notes-panel--editor {
    max-height: none;
    min-height: 0;
  }
}
</style>
