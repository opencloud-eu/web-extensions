<template>
  <div class="toc-item-wrapper note-row" :class="{ 'note-row--active': node.resource.id === documentId }">
    <div>
      <OcButton
        appearance="raw"
        class="note-row__button ext:w-full ext:text-left"
        justify-content="start"
        @click="openDocument(node)"
      >
        <span class="note-row__icon">
          <OcIcon name="article" fill-type="line" />
        </span>
        <span class="note-row__copy">
          <span class="note-row__title">{{ extractNameWithoutExtension(node.resource) }}</span>
          <span class="note-row__meta">{{ $gettext('Markdown page') }}</span>
        </span>
      </OcButton>
    </div>
    <div class="note-row__actions ext:flex ext:items-center ext:gap-1 ext:nowrap">
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
import { useGettext } from 'vue3-gettext'
import { unref } from 'vue'

const router = useRouter()
const { $gettext } = useGettext()

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
  gap: 0.35rem;
  align-items: center;
  padding: 0.2rem;
  border-radius: 1rem;
  border: 1px solid transparent;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    transform 120ms ease;
}

.toc-item-wrapper:hover {
  border-color: var(--oc-color-role-outline-variant, #d7dde5);
  background: var(--oc-color-interaction-hover);
}

.note-row--active {
  border-color: rgba(244, 187, 68, 0.48);
  background: rgba(244, 187, 68, 0.14);
}

.note-row__button {
  padding: 0.45rem 0.5rem;
}

.note-row__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin-right: 0.75rem;
  border-radius: 0.8rem;
  background: rgba(244, 187, 68, 0.16);
  color: var(--oc-color-icon-notes);
}

.note-row__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.05rem;
}

.note-row__title,
.note-row__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-row__title {
  font-weight: 700;
}

.note-row__meta {
  font-size: 0.78rem;
  color: var(--oc-color-role-on-surface-variant, rgba(15, 23, 42, 0.7));
}

.note-row__actions {
  opacity: 0.85;
}
</style>
