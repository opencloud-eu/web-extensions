import { TocNode } from '../../types'
import { FileAction, useClientService, useMessages } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { Resource, urlJoin } from '@opencloud-eu/web-client'
import { useNotebookStore, useTocStore } from '../stores'
import { useAskForResourceName } from '../useAskForResourceName'

export const useActionsCreateFolder = (parentNode: TocNode) => {
  const { $gettext } = useGettext()
  const { webdav } = useClientService()
  const { showMessage, showErrorMessage } = useMessages()
  const { askForResourceName } = useAskForResourceName()

  const notebookStore = useNotebookStore()
  const tocStore = useTocStore()

  const getTargetFolderResource = (): Resource => {
    return parentNode?.resource?.isFolder ? parentNode.resource : notebookStore.notebook
  }
  const createFolder = async () => {
    const parent = getTargetFolderResource()
    const name = await askForResourceName(
      $gettext('Create a new folder'),
      $gettext('Folder name'),
      $gettext('New folder')
    )
    if (!name) {
      return
    }
    try {
      const path = urlJoin(parent.path, name)
      const resource = await webdav.createFolder(notebookStore.space, { path })
      showMessage({ title: $gettext('»%{name}« was created successfully', { name }) })

      const newNode: TocNode = {
        resource,
        children: [],
        collapsed: false
      }
      tocStore.addTocNode(newNode, parentNode)
    } catch (e) {
      console.error(e)
      showErrorMessage({ title: $gettext('Failed to create folder'), errors: [e] })
    }
  }

  const actions: FileAction[] = [
    {
      name: 'create-folder',
      icon: 'folder-add',
      label: () => (parentNode ? $gettext('Create sub-folder') : $gettext('Create folder')),
      isVisible: () => {
        const parent = getTargetFolderResource()
        if (!parent) {
          return false
        }
        return parent.canCreate()
      },
      handler: createFolder
    }
  ]

  return {
    actions
  }
}
