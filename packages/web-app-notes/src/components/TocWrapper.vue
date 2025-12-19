<template>
  <div class="overflow-auto">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h2>{{ $gettext('Notes') }}</h2>
      <div class="flex nowrap gap-1">
        <ActionIconButton
          v-for="action in rootActions"
          :key="`root-action-button-${action.name}`"
          :resource="notebook"
          :action="action"
        />
      </div>
    </div>
    <TocList class="toc-tree text-sm" :nodes="tocNodes" />
  </div>
</template>

<script setup lang="ts">
import ActionIconButton from './ActionIconButton.vue'
import TocList from './TocList.vue'
import { useGettext } from 'vue3-gettext'
import {
  useActionsCreateFolder,
  useActionsCreateNote,
  useNotebookStore,
  useTocStore
} from '../composables'
import { storeToRefs } from 'pinia'

const { $gettext } = useGettext()

const notebookStore = useNotebookStore()
const { notebook } = storeToRefs(notebookStore)

const tocStore = useTocStore()
const { tocNodes } = storeToRefs(tocStore)

const { actions: actionsCreateFolder } = useActionsCreateFolder(null)
const { actions: actionsCreateNote } = useActionsCreateNote(null)
const rootActions = [...actionsCreateFolder, ...actionsCreateNote]
</script>
