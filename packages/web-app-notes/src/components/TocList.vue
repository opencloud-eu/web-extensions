<template>
  <ul class="ext:pl-0">
    <li
      v-for="node in nodes"
      :key="node.resource.isFolder ? `folder-${node.resource.id}` : `file-${node.resource.id}`"
    >
      <div
        class="ext:flex ext:items-center ext:gap-1 ext:py-1"
        :draggable="true"
        @dragstart="onDragStart(node, $event)"
        @dragend="onDragEnd"
      >
        <template v-if="node.resource.isFolder">
          <div
            class="ext:w-100 toc-item-wrapper"
            :class="{
              'bg-role-secondary-container': tocStore.isDragOverNode(node),
              'ext:rounded': tocStore.isDragOverNode(node)
            }"
            @dragover.prevent="onDragOverFolder(node)"
            @dragleave="onDragLeaveFolder(node)"
            @drop.prevent="onDropOnFolder(node)"
          >
            <div>
              <OcButton
                appearance="raw"
                class="ext:p-1 ext:w-full ext:justify-start ext:text-left"
                @click="node.collapsed = !node.collapsed"
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
        <template v-else>
          <div class="ext:w-100 toc-item-wrapper">
            <div>
              <OcButton
                appearance="raw"
                class="ext:p-1 ext:w-full ext:justify-start ext:text-left"
                :class="{ 'ext:font-semibold': node.resource.id === documentId }"
                @click="() => openDocument(node)"
              >
                <OcIcon name="article" fill-type="line" class="ext:text-neutral-500" />
                {{ extractNameWithoutExtension(node.resource) }}
              </OcButton>
            </div>
            <div class="ext:flex ext:nowrap ext:items-center ext:gap-1">
              <ActionIconButton
                v-for="action of getFileQuickActions(node)"
                :key="`file-quick-action-${action.name}-${extractDomSelector(node.resource.id)}`"
                :resource="node.resource"
                :action="action"
              />
              <TocContextActions :node="node" :menu-sections="getFileMenuSections(node)" />
            </div>
          </div>
        </template>
      </div>
      <div v-if="!node.collapsed && node.children?.length" class="ext:ml-4">
        <TocList :nodes="node.children" />
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import ActionIconButton from './ActionIconButton.vue'
import TocContextActions from './TocContextActions.vue'
import { TocNode } from '../types'
import { extractDomSelector, extractNameWithoutExtension } from '@opencloud-eu/web-client'
import {
  Action,
  useFileActionsDelete,
  useFileActionsRename,
  useRouter,
  type MenuSection
} from '@opencloud-eu/web-pkg'
import { unref } from 'vue'
import {
  buildDocumentRoute,
  useActionsCreateFolder,
  useActionsCreateNote,
  useActionsOpenDocument,
  useActionsSaveCurrentDocument,
  useDragAndDrop,
  useDocumentStore,
  useNotebookStore,
  useTocStore
} from '../composables'
import { storeToRefs } from 'pinia'

const router = useRouter()

const { nodes } = defineProps<{
  nodes: TocNode[]
}>()

const notebookStore = useNotebookStore()
const documentStore = useDocumentStore()
const { documentId } = storeToRefs(documentStore)

const tocStore = useTocStore()

const { onDragStart, onDragEnd, onDragOverFolder, onDragLeaveFolder, onDropOnFolder } =
  useDragAndDrop()

const openDocument = async (node: TocNode) => {
  await router.push(buildDocumentRoute(notebookStore.space, notebookStore.notebook, node))
}

const { actions: actionsRename } = useFileActionsRename()
const { actions: actionsDelete } = useFileActionsDelete()

const getActionOptions = (node: TocNode) => ({
  space: notebookStore.space,
  resources: [node.resource]
})

const getFolderMenuSections = (node: TocNode): MenuSection[] => {
  const { actions: actionsCreateFolder } = useActionsCreateFolder(node)
  const { actions: actionsCreateNote } = useActionsCreateNote(node)

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

const getFileQuickActions = (node: TocNode): Action[] => {
  const { actions: actionsSaveDocument } = useActionsSaveCurrentDocument(node)

  return [...actionsSaveDocument].filter((action) => action.isVisible(getActionOptions(node)))
}
const getFileMenuSections = (node: TocNode): MenuSection[] => {
  const { actions: actionsOpenDocument } = useActionsOpenDocument(node)
  const { actions: actionsSaveDocument } = useActionsSaveCurrentDocument(node)

  const items: Action[] = [
    ...actionsOpenDocument,
    ...actionsSaveDocument,
    ...unref(actionsRename),
    ...unref(actionsDelete)
  ].filter((action) => action.isVisible(getActionOptions(node)))
  return [
    {
      name: 'file-actions',
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
