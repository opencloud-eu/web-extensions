<template>
  <div class="ext:w-100 toc-item-wrapper">
    <div>
      <OcButton
        appearance="raw"
        class="ext:p-1 ext:w-full ext:text-left"
        :class="{ 'ext:font-semibold': node.resource.id === documentId }"
        justify-content="start"
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

<script setup lang="ts">
import ActionIconButton from './ActionIconButton.vue'
import TocContextActions from './TocContextActions.vue'
import { extractDomSelector, extractNameWithoutExtension } from '@opencloud-eu/web-client'
import { TocNode } from '../types'
import {
  buildDocumentRoute,
  useActionsOpenDocument,
  useActionsSaveCurrentDocument,
  useDocumentStore,
  useNotebookStore
} from '../composables'
import { storeToRefs } from 'pinia'
import {
  Action,
  type MenuSection,
  useFileActionsDelete,
  useFileActionsRename,
  useRouter
} from '@opencloud-eu/web-pkg'
import { unref } from 'vue'

const router = useRouter()

const { node } = defineProps<{
  node: TocNode
}>()

const notebookStore = useNotebookStore()
const documentStore = useDocumentStore()
const { documentId } = storeToRefs(documentStore)

const openDocument = async (node: TocNode) => {
  await router.push(buildDocumentRoute(notebookStore.space, notebookStore.notebook, node))
}

const { actions: actionsRename } = useFileActionsRename()
const { actions: actionsDelete } = useFileActionsDelete()
const { actions: actionsOpenDocument } = useActionsOpenDocument(node)
const { actions: actionsSaveDocument } = useActionsSaveCurrentDocument(node)

const getActionOptions = (node: TocNode) => ({
  space: notebookStore.space,
  resources: [node.resource]
})

const getFileQuickActions = (node: TocNode): Action[] => {
  return [...actionsSaveDocument].filter((action) => action.isVisible(getActionOptions(node)))
}
const getFileMenuSections = (node: TocNode): MenuSection[] => {
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
