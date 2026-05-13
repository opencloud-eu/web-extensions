<template>
  <div
    class="ext:w-100 toc-item-wrapper"
    :class="{
      'ext:bg-role-secondary-container': isDragOverNode(node),
      'ext:rounded': isDragOverNode(node)
    }"
    @dragover.prevent="onDragOverFolder(node)"
    @dragleave="onDragLeaveFolder(node)"
    @drop.prevent="onDropOnFolder(node)"
  >
    <div>
      <OcButton
        appearance="raw"
        class="ext:p-1 ext:w-full ext:text-left"
        justify-content="start"
        @click="toggleNodeCollapse(node)"
      >
        <oc-icon
          :name="`arrow-${node.collapsed ? 'right' : 'down'}-s`"
          fill-type="line"
          class="ext:text-neutral-500"
        />
        <span class="ext:font-medium">{{ node.resource.name }}</span>
      </OcButton>
    </div>
    <div class="ext:flex ext:nowrap ext:gap-1 ext:items-center">
      <TocContextActions :node="node" :menu-sections="getFolderMenuSections(node)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import TocContextActions from './TocContextActions.vue'
import { TocNode } from '../types'
import {
  useActionsCreateFolder,
  useActionsCreateNote,
  useDragAndDrop,
  useNotebookStore,
  useTocStore
} from '../composables'
import {
  Action,
  ActionExtension,
  MenuSection,
  useExtensionRegistry,
  useFileActionsDelete
} from '@opencloud-eu/web-pkg'
import { computed, unref } from 'vue'

const { node } = defineProps<{
  node: TocNode
}>()

const { getExtensionById } = useExtensionRegistry()
const tocStore = useTocStore()
const { isDragOverNode, toggleNodeCollapse } = tocStore
const notebookStore = useNotebookStore()
const { onDragOverFolder, onDragLeaveFolder, onDropOnFolder } = useDragAndDrop()

const renameAction = computed(() => {
  const renameExtension = getExtensionById<ActionExtension>(
    'com.github.opencloud-eu.web.files.context-action.rename'
  )

  return renameExtension?.action
})

const { actions: actionsCreateFolder } = useActionsCreateFolder(unref(node))
const { actions: actionsCreateNote } = useActionsCreateNote(unref(node))
const { actions: actionsDelete } = useFileActionsDelete()

const getActionOptions = (node: TocNode) => ({
  space: notebookStore.space,
  resources: [node.resource]
})

const getFolderMenuSections = (node: TocNode): MenuSection[] => {
  const items: Action[] = [
    ...actionsCreateFolder,
    ...actionsCreateNote,
    ...unref(actionsDelete),
    ...(unref(renameAction) ? [unref(renameAction)] : [])
  ].filter((action) => action.isVisible(getActionOptions(node)))
  return [
    {
      name: 'folder-actions',
      items
    }
  ]
}
</script>

<style scoped>
.toc-item-wrapper {
  display: grid;
  grid-template-columns: 1fr auto;
}
</style>
