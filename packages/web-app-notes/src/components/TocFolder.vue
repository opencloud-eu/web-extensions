<template>
  <div
    class="toc-item-wrapper folder-row"
    :class="{
      'bg-role-secondary-container': isDragOverNode(node),
      'folder-row--drag-over': isDragOverNode(node)
    }"
    @dragover.prevent="onDragOverFolder(node)"
    @dragleave="onDragLeaveFolder(node)"
    @drop.prevent="onDropOnFolder(node)"
  >
    <div>
      <OcButton
        appearance="raw"
        class="folder-row__button ext:w-full ext:text-left"
        justify-content="start"
        @click="onFolderClick"
      >
        <span class="folder-row__chevron">
          <oc-icon :name="`arrow-${node.collapsed ? 'right' : 'down'}-s`" fill-type="line" />
        </span>
        <span class="folder-row__icon">
          <oc-icon name="folder-2" fill-type="line" />
        </span>
        <span class="folder-row__copy">
          <span
            class="folder-row__title"
            :class="{ 'ext:text-primary': folderStore.activeFolder?.id === node.resource.id }"
          >
            {{ node.resource.name }}
          </span>
          <span class="folder-row__meta">{{ $gettext('%{count} items', { count: itemCount(node) }) }}</span>
        </span>
      </OcButton>
    </div>
    <div class="folder-row__actions ext:flex ext:items-center ext:gap-1 ext:nowrap">
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
  useFolderStore,
  useNotebookStore,
  useTocStore
} from '../composables'
import {
  Action,
  MenuSection,
  useFileActionsDelete,
  useFileActionsRename
} from '@opencloud-eu/web-pkg'
import { unref } from 'vue'
import { useGettext } from 'vue3-gettext'

const { node } = defineProps<{
  node: TocNode
}>()
const { $gettext } = useGettext()

const tocStore = useTocStore()
const { isDragOverNode, toggleNodeCollapse } = tocStore
const notebookStore = useNotebookStore()
const folderStore = useFolderStore()
const { onDragOverFolder, onDragLeaveFolder, onDropOnFolder } = useDragAndDrop()

const onFolderClick = () => {
  folderStore.setActiveFolder(node.resource)
  toggleNodeCollapse(node)
}

const { actions: actionsCreateFolder } = useActionsCreateFolder(unref(node))
const { actions: actionsCreateNote } = useActionsCreateNote(unref(node))
const { actions: actionsRename } = useFileActionsRename()
const { actions: actionsDelete } = useFileActionsDelete()

const getActionOptions = (node: TocNode) => ({
  space: notebookStore.space,
  resources: [node.resource]
})

const getFolderMenuSections = (node: TocNode): MenuSection[] => {
  const items: Action[] = [
    ...actionsCreateFolder,
    ...actionsCreateNote,
    ...unref(actionsRename),
    ...unref(actionsDelete)
  ].filter((action) => action.isVisible(getActionOptions(node)))
  return [
    {
      name: 'folder-actions',
      items
    }
  ]
}

const itemCount = (node: TocNode) => {
  return node.children?.length || 0
}
</script>

<style scoped>
.toc-item-wrapper {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.35rem;
  align-items: center;
  padding: 0.2rem;
  border-radius: 1rem;
  border: 1px solid transparent;
  transition:
    background-color 120ms ease,
    border-color 120ms ease;
}

.toc-item-wrapper:hover {
  border-color: var(--oc-color-role-outline-variant, #d7dde5);
  background: var(--oc-color-interaction-hover);
}

.folder-row--drag-over {
  border-color: rgba(244, 187, 68, 0.55);
}

.folder-row__button {
  padding: 0.45rem 0.5rem;
}

.folder-row__chevron,
.folder-row__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.folder-row__chevron {
  width: 1.2rem;
  margin-right: 0.2rem;
}

.folder-row__icon {
  width: 2rem;
  height: 2rem;
  margin-right: 0.75rem;
  border-radius: 0.8rem;
  background: rgba(37, 99, 235, 0.08);
  color: var(--oc-color-role-primary, #2563eb);
}

.folder-row__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.05rem;
}

.folder-row__title,
.folder-row__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-row__title {
  font-weight: 700;
}

.folder-row__meta {
  font-size: 0.78rem;
  color: var(--oc-color-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}
</style>
