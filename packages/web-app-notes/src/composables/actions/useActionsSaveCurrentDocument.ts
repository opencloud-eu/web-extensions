import { TocNode } from '../../types'
import { FileAction, useClientService, useMessages, useUserStore } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useTask } from 'vue-concurrency'
import { useDocumentStore, useNotebookStore } from '../stores'
import { storeToRefs } from 'pinia'
import { unref } from 'vue'

export const useActionsSaveCurrentDocument = (node: TocNode) => {
  const { $gettext } = useGettext()
  const { webdav } = useClientService()
  const { showMessage, showErrorMessage } = useMessages()
  const userStore = useUserStore()
  const notebookStore = useNotebookStore()
  const documentStore = useDocumentStore()
  const { documentResource, isDocumentDirty } = storeToRefs(documentStore)

  const savePageTask = useTask(function* (signal, newContent) {
    try {
      const resource = yield webdav.putFileContents(notebookStore.space, {
        fileName: unref(documentResource).name,
        parentFolderId: unref(documentResource).parentFolderId,
        path: unref(documentResource).path,
        previousEntityTag: unref(documentResource).etag,
        content: newContent,
        signal
      })
      documentStore.setDocument(resource, newContent)
      showMessage({
        title: $gettext('»%{name}« was saved successfully', { name: unref(documentResource).name })
      })
    } catch (e) {
      console.error('Failed to save the new page content', e)
      showErrorMessage({ title: $gettext('Failed to save document'), errors: [e] })
    }
  }).drop()
  const savePage = async () => {
    await savePageTask.perform(documentStore.documentContent)
  }

  const actions: FileAction[] = [
    {
      name: 'save-note',
      icon: 'save',
      label: () => $gettext('Save'),
      isVisible: () => {
        if (node.resource.id !== documentStore.documentId) {
          return false
        }
        return notebookStore.notebook.canUpload({ user: userStore.user })
      },
      isDisabled: () => !unref(isDocumentDirty),
      handler: savePage
    }
  ]

  return {
    actions
  }
}
