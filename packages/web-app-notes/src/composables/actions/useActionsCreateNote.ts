import { TocNode } from '../../types'
import { useGettext } from 'vue3-gettext'
import {
  FileAction,
  useClientService,
  useMessages,
  useRouter,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { useNotebookStore, useTocStore } from '../stores'
import { Resource, urlJoin } from '@opencloud-eu/web-client'
import { useAskForResourceName } from '../useAskForResourceName'
import { buildDocumentRoute } from './useActionsOpenDocument'

export const useActionsCreateNote = (parentNode: TocNode) => {
  const { $gettext } = useGettext()
  const { webdav } = useClientService()
  const { showMessage, showErrorMessage } = useMessages()
  const { askForResourceName } = useAskForResourceName()
  const router = useRouter()

  const userStore = useUserStore()
  const notebookStore = useNotebookStore()
  const tocStore = useTocStore()

  const getTargetFolderResource = (): Resource => {
    return parentNode?.resource?.isFolder ? parentNode.resource : notebookStore.notebook
  }
  const createNote = async () => {
    const parent = getTargetFolderResource()
    const name = await askForResourceName(
      $gettext('Create a new note'),
      $gettext('Note name'),
      $gettext('New note')
    )
    if (!name) {
      return
    }
    const fileName = name.endsWith('.md') ? name : `${name}.md`
    try {
      const path = urlJoin(parent.path, fileName)
      const resource = await webdav.putFileContents(notebookStore.space, { path, content: '' })
      showMessage({
        title: $gettext('»%{name}« was created successfully', { name: resource.name })
      })

      const newNode: TocNode = {
        resource
      }
      tocStore.addTocNode(newNode, parentNode)

      await router.push(buildDocumentRoute(notebookStore.space, notebookStore.notebook, newNode))
    } catch (e) {
      console.error(e)
      showErrorMessage({ title: $gettext('Failed to create note'), errors: [e] })
    }
  }

  const actions: FileAction[] = [
    {
      name: 'create-note',
      icon: 'sticky-note-add',
      label: () => (parentNode ? $gettext('Create note in folder') : $gettext('Create note')),
      isVisible: () => {
        const parent = getTargetFolderResource()
        if (!parent) {
          return false
        }
        return parent.canUpload({ user: userStore.user })
      },
      handler: createNote
    }
  ]

  return {
    actions
  }
}
