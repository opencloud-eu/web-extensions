<template>
  <div class="notes-sidebar ext:flex ext:h-full ext:flex-col ext:overflow-hidden">
    <div class="notes-sidebar__header ext:p-4 md:ext:p-5">
      <div class="ext:flex ext:items-start ext:justify-between ext:gap-3">
        <div class="ext:min-w-0">
          <p class="notes-sidebar__eyebrow ext:mb-2">{{ activeFolderTitle }}</p>
          <h2 class="ext:my-0 ext:truncate ext:text-2xl">
            {{ filterTerm ? $gettext('Search Results') : $gettext('Pages') }}
          </h2>
          <p class="notes-sidebar__copy ext:mt-2 ext:mb-0">
            {{ $gettext('%{count} pages', { count: displayedNotes.length }) }}
          </p>
        </div>
      </div>

      <div v-if="!filterTerm" class="ext:mt-4 ext:flex ext:flex-wrap ext:gap-2">
        <ActionIconButton
          v-for="action in folderActions"
          :key="`action-button-${action.name}`"
          :resource="folderStore.activeFolder || notebook"
          :action="action"
        />
      </div>
    </div>

    <div class="ext:min-h-0 ext:flex-1 ext:overflow-auto ext:p-4 md:ext:p-5">
      <div v-if="displayedNotes.length" class="ext:flex ext:flex-col ext:gap-2">
        <ul class="ext:m-0 ext:pl-0">
          <li v-for="node in displayedNotes" :key="`note-list-result-${node.resource.id}`">
            <div
              class="ext:flex ext:items-center ext:gap-1 ext:py-1"
              :draggable="!filterTerm"
              @dragstart="onDragStart(node, $event)"
              @dragend="onDragEnd"
            >
              <TocFile :node="node" class="ext:flex-1" />
            </div>
            <div v-if="filterTerm" class="ext:ml-12 ext:mb-2 ext:text-xs ext:text-gray-500">
              {{ getNotebookPathLabel(notebook, node.resource) }}
            </div>
          </li>
        </ul>
      </div>

      <div v-else class="notes-search-empty ext:mt-8 ext:text-center">
        <oc-icon :name="filterTerm ? 'search' : 'file-text'" fill-type="line" size="large" />
        <h3 class="ext:mb-2 ext:mt-3">
          {{ filterTerm ? $gettext('No matching pages') : $gettext('This section is empty') }}
        </h3>
        <p class="ext:my-0 ext:text-sm ext:text-gray-600">
          {{ filterTerm ? $gettext('Try a different title.') : $gettext('Create a new page here to get started.') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionIconButton from './ActionIconButton.vue'
import TocFile from './TocFile.vue'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  useActionsCreateNote,
  useDragAndDrop,
  useFolderStore,
  useNotebookStore,
  useTocStore
} from '../composables'
import { flattenTocNodes, getNotebookPathLabel, getNotesInFolder, searchNoteNodes } from '../util'

const props = defineProps<{
  filterTerm: string
}>()

const { $gettext } = useGettext()

const notebookStore = useNotebookStore()
const { notebook } = storeToRefs(notebookStore)

const tocStore = useTocStore()
const { tocNodes } = storeToRefs(tocStore)

const folderStore = useFolderStore()
const { onDragStart, onDragEnd } = useDragAndDrop()

const activeParentNode = computed(() => {
  if (!folderStore.activeFolder) {
    return null
  }

  return flattenTocNodes(tocNodes.value || []).find(
    (node) => node.resource.id === folderStore.activeFolder?.id
  ) || null
})

const { actions: actionsCreateNote } = useActionsCreateNote(activeParentNode)
const folderActions = computed(() => {
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
    return $gettext('Root section')
  }

  return folderStore.activeFolder.name
})

const displayedNotes = computed(() => {
  if (props.filterTerm.trim()) {
    return searchNoteNodes(tocNodes.value || [], props.filterTerm)
  }

  return getNotesInFolder(tocNodes.value || [], folderStore.activeFolder?.id || null)
})
</script>

<style scoped>
.notes-sidebar__header {
  border-bottom: 1px solid var(--oc-color-role-outline-variant, #d7dde5);
}

.notes-sidebar__eyebrow {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--oc-color-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}

.notes-sidebar__copy {
  font-size: 0.85rem;
  color: var(--oc-color-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}

.notes-search-empty {
  color: var(--oc-color-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}
</style>