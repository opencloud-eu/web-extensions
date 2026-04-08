import { TocNode } from '../../types'
import { FileAction, useClientService, useMessages, useUserStore } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useTask } from 'vue-concurrency'
import { useDocumentStore, useNotebookStore } from '../stores/index'
import { storeToRefs } from 'pinia'
import { unref } from 'vue'

export const useActionsSaveCurrentDocument = (node?: TocNode) => {
  const { $gettext } = useGettext()
  const { webdav } = useClientService()
  const { showMessage, showErrorMessage } = useMessages()
  const userStore = useUserStore()
  const notebookStore = useNotebookStore()
  const documentStore = useDocumentStore()
  const { documentResource, isDocumentDirty } = storeToRefs(documentStore)

  const savePageTask = useTask(function* (
    signal,
    newContent: string,
    onSuccessCallback?: () => void
  ) {
    const currentResource = unref(documentResource)
    if (!currentResource || !notebookStore.space) {
      return
    }

    try {
      const resource = yield webdav.putFileContents(notebookStore.space, {
        fileName: currentResource.name,
        parentFolderId: currentResource.parentFolderId,
        path: currentResource.path,
        previousEntityTag: currentResource.etag,
        content: newContent,
        signal
      })
      documentStore.setDocument(resource, newContent)
      showMessage({
        title: $gettext('»%{name}« was saved successfully', { name: currentResource.name || 'Note' })
      })
      onSuccessCallback?.()
    } catch (e) {
      console.error('Failed to save the new page content', e)
      showErrorMessage({ title: $gettext('Failed to save document'), errors: [e as Error] })
    }
  }).drop()
  const savePage = async (onSuccessCallback?: () => void) => {
    await savePageTask.perform(documentStore.documentContent, onSuccessCallback)
  }

  const actions: FileAction[] = [
    {
      name: 'save-note',
      icon: 'save',
      label: () => $gettext('Save'),
      isVisible: () => {
        if (node?.resource.id !== documentStore.documentId) {
          return false
        }
        return notebookStore.notebook?.canUpload({ user: userStore.user })
      },
      isDisabled: () => !unref(isDocumentDirty),
      handler: () => {
        return savePage()
      }
    }
  ]

  return {
    actions,
    savePage
  }
}
