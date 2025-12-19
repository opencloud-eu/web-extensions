<template>
  <div class="ext:overflow-auto">
    <div class="ext:mb-2 ext:flex ext:items-center ext:justify-between">
      <h2>{{ $gettext('Notes') }}</h2>
      <div class="ext:flex ext:nowrap ext:gap-1">
        <ActionIconButton
          v-for="action in rootActions"
          :key="`root-action-button-${action.name}`"
          :resource="notebook"
          :action="action"
        />
      </div>
    </div>
    <TocEmpty v-if="tocNodes.length === 0" />
    <template v-else>
      <TocList class="ext:text-sm" :nodes="tocNodes" />
      <div
        v-if="isDragAndDropActive"
        class="ext:h-30 ext:border ext:border-dashed ext:flex ext:items-center ext:justify-center"
        :class="{ 'bg-role-secondary-container': dragOverRoot, 'ext:rounded': dragOverRoot }"
        :aria-label="$gettext('Root drop zone')"
        @dragover.prevent="onDragOverRoot()"
        @dragleave="onDragLeaveRoot"
        @drop.prevent="onDropOnRoot()"
      >
        <span class="ext:text-sm ext:text-center">
          {{ $gettext('Drop here to move item to root of notebook') }}
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import ActionIconButton from './ActionIconButton.vue'
import TocEmpty from './TocEmpty.vue'
import TocList from './TocList.vue'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  useActionsCreateFolder,
  useActionsCreateNote,
  useDragAndDrop,
  useNotebookStore,
  useTocStore
} from '../composables'

const { $gettext } = useGettext()

const notebookStore = useNotebookStore()
const { notebook } = storeToRefs(notebookStore)

const tocStore = useTocStore()
const { tocNodes, isDragAndDropActive } = storeToRefs(tocStore)
const { dragOverRoot } = storeToRefs(tocStore)

const { onDragOverRoot, onDragLeaveRoot, onDropOnRoot } = useDragAndDrop()

const { actions: actionsCreateFolder } = useActionsCreateFolder(null)
const { actions: actionsCreateNote } = useActionsCreateNote(null)
const rootActions = computed(() => {
  return [...actionsCreateFolder, ...actionsCreateNote].filter((action) =>
    action.isVisible({ space: notebookStore.space, resources: [notebookStore.notebook] })
  )
})
</script>
