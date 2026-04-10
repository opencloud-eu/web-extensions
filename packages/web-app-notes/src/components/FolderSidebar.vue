<template>
  <div class="notes-sidebar ext:flex ext:h-full ext:flex-col ext:overflow-hidden">
    <div class="notes-sidebar__header ext:p-4 md:ext:p-5">
      <div class="ext:flex ext:items-start ext:justify-between ext:gap-3">
        <div class="ext:min-w-0">
          <p class="notes-sidebar__eyebrow ext:mb-2">{{ activeFolderTitle }}</p>
          <h2
            class="ext:my-0 ext:cursor-pointer ext:truncate ext:text-2xl"
            @click="folderStore.setActiveFolder(null)"
          >
            {{ filterTerm ? $gettext('Search Results') : notebookTitle }}
          </h2>
          <p class="notes-sidebar__copy ext:mt-2 ext:mb-0">
            <template v-if="filterTerm">
              {{ $gettext('%{count} pages', { count: displayedNotes.length }) }}
            </template>
            <template v-else>
              {{ $gettext('%{count} items', { count: totalItemCount }) }}
            </template>
          </p>
        </div>
      </div>

      <div v-if="!filterTerm" class="ext:mt-4 ext:flex ext:flex-wrap ext:gap-2">
        <ActionIconButton
          v-for="action in rootActions"
          :key="`root-action-button-${action.name}`"
          :resource="notebook"
          :action="action"
        />
        <ActionIconButton
          v-for="action in createNoteActions"
          :key="`create-note-button-${action.name}`"
          :resource="folderStore.activeFolder || notebook"
          :action="action"
        />
      </div>
    </div>

    <div class="ext:min-h-0 ext:flex-1 ext:overflow-auto ext:p-4 md:ext:p-5">
      <!-- Search Mode -->
      <div v-if="filterTerm" class="ext:flex ext:flex-col ext:gap-2">
        <ul v-if="displayedNotes.length" class="ext:m-0 ext:pl-0">
          <li v-for="node in displayedNotes" :key="`note-list-result-${node.resource.id}`">
            <div class="ext:flex ext:items-center ext:gap-1 ext:py-1">
              <TocFile :node="node" class="ext:flex-1" />
            </div>
            <div class="ext:ml-12 ext:mb-2 ext:text-xs text-role-on-surface-variant">
              {{ getNotebookPathLabel(notebook, node.resource) }}
            </div>
          </li>
        </ul>
        <div v-else class="notes-search-empty ext:mt-8 ext:text-center">
          <oc-icon name="search" fill-type="line" size="large" />
          <h3 class="ext:mb-2 ext:mt-3">{{ $gettext('No matching pages') }}</h3>
          <p class="ext:my-0 ext:text-sm text-role-on-surface-variant">
            {{ $gettext('Try a different title.') }}
          </p>
        </div>
      </div>

      <!-- Tree Mode -->
      <template v-else>
        <TocEmpty v-if="!tocNodes?.length" />
        <template v-else>
          <TocList class="ext:text-sm" :nodes="tocNodes" />
          <div
            v-if="isDragAndDropActive"
            class="notes-root-dropzone"
            :class="{ 'bg-role-secondary-container': dragOverRoot, 'notes-root-dropzone--active': dragOverRoot }"
            :aria-label="$gettext('Root drop zone')"
            @dragover.prevent="onDragOverRoot()"
            @dragleave="onDragLeaveRoot"
            @drop.prevent="onDropOnRoot()"
          >
            <span class="ext:text-center ext:text-sm">
              {{ $gettext('Drop here to move item to root of notebook') }}
            </span>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionIconButton from './ActionIconButton.vue'
import TocEmpty from './TocEmpty.vue'
import TocList from './TocList.vue'
import TocFile from './TocFile.vue'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  useActionsCreateFolder,
  useActionsCreateNote,
  useDragAndDrop,
  useFolderStore,
  useNotebookStore,
  useTocStore
} from '../composables'
import { flattenTocNodes, getNotebookPathLabel, getResourceLabel, countNotes, countFolders, searchNoteNodes } from '../util'

const props = defineProps<{
  filterTerm: string
}>()

const { $gettext } = useGettext()

const notebookStore = useNotebookStore()
const { notebook } = storeToRefs(notebookStore)

const tocStore = useTocStore()
const { tocNodes, isDragAndDropActive, dragOverRoot } = storeToRefs(tocStore)

const folderStore = useFolderStore()

const { onDragOverRoot, onDragLeaveRoot, onDropOnRoot } = useDragAndDrop()

const { actions: actionsCreateFolder } = useActionsCreateFolder(null)
const rootActions = computed(() => {
  if (!notebook.value) {
    return []
  }

  return actionsCreateFolder.filter((action) =>
    action.isVisible({ space: notebookStore.space, resources: [notebook.value] })
  )
})

const activeParentNode = computed(() => {
  if (!folderStore.activeFolder) {
    return null
  }
  return flattenTocNodes(tocNodes.value || []).find(
    (node) => node.resource.id === folderStore.activeFolder?.id
  ) || null
})

const { actions: actionsCreateNote } = useActionsCreateNote(activeParentNode)
const createNoteActions = computed(() => {
  const target = folderStore.activeFolder || notebook.value
  if (!target) {
    return []
  }
  return actionsCreateNote.filter((action) =>
    action.isVisible({ space: notebookStore.space, resources: [target] })
  )
})

const activeFolderTitle = computed(() => {
  if (props.filterTerm) {
    return $gettext('Searching')
  }
  if (!folderStore.activeFolder) {
    return $gettext('Navigator')
  }
  return folderStore.activeFolder.name
})

const notebookTitle = computed(() => {
  return notebook.value ? getResourceLabel(notebook.value) : $gettext('Notes')
})

const totalItemCount = computed(() => countFolders(tocNodes.value || []) + countNotes(tocNodes.value || []))

const displayedNotes = computed(() => {
  if (props.filterTerm.trim()) {
    return searchNoteNodes(tocNodes.value || [], props.filterTerm)
  }
  return []
})
</script>

<style scoped>
.notes-sidebar__header {
  border-bottom: 1px solid var(--oc-role-outline-variant, #d7dde5);
}

.notes-sidebar__eyebrow {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--oc-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}

.notes-sidebar__copy,
.text-role-on-surface-variant {
  font-size: 0.85rem;
  color: var(--oc-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}

.notes-root-dropzone {
  margin-top: 1rem;
  padding: 1.5rem 1rem;
  border-radius: 1rem;
  border: 2px dashed var(--oc-role-outline, #cbd5e1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--oc-role-on-surface-variant, rgba(15, 23, 42, 0.7));
  transition: all 120ms ease;
}

.notes-root-dropzone--active {
  border-color: var(--oc-role-primary, #2563eb);
  background: rgba(37, 99, 235, 0.05);
}
</style>