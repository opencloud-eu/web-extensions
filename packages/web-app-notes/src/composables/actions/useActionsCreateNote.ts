import { TocNode } from '../../types'
import { useGettext } from 'vue3-gettext'
import { unref, Ref } from 'vue'
import {
  FileAction,
  useClientService,
  useMessages,
  useRouter,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { useNotebookStore, useTocStore } from '../stores/index'
import { Resource, urlJoin } from '@opencloud-eu/web-client'
import { useAskForResourceName } from '../useAskForResourceName'
import { buildDocumentRoute } from './useActionsOpenDocument'

export const useActionsCreateNote = (parentNodeArg: TocNode | Ref<TocNode | null> | null) => {
  const { $gettext } = useGettext()
  const { webdav } = useClientService()
  const { showMessage, showErrorMessage } = useMessages()
  const { askForResourceName } = useAskForResourceName()
  const router = useRouter()

  const userStore = useUserStore()
  const notebookStore = useNotebookStore()
  const tocStore = useTocStore()

  const getTargetFolderResource = (): Resource | null => {
    const parentNode = unref(parentNodeArg)
    return parentNode?.resource?.isFolder ? parentNode.resource : notebookStore.notebook
  }

  const createNote = async () => {
    const parent = getTargetFolderResource()
    if (!parent || !notebookStore.space) {
      return
    }

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
        title: $gettext('»%{name}« was created successfully', { name: resource.name || fileName })
      })

      const newNode: TocNode = {
        resource
      }
      tocStore.addTocNode(newNode, unref(parentNodeArg) || undefined)

      await router.push(buildDocumentRoute(notebookStore.space, notebookStore.notebook, newNode))
    } catch (e) {
      console.error(e)
      showErrorMessage({ title: $gettext('Failed to create note'), errors: [e as Error] })
    }
  }

  const actions: FileAction[] = [
    {
      name: 'create-note',
      icon: 'sticky-note-add',
      label: () => (unref(parentNodeArg) ? $gettext('Create note in folder') : $gettext('Create note')),
      isVisible: () => {
        const parent = getTargetFolderResource()
        if (!parent) {
          return false
        }
        return parent.canUpload?.({ user: userStore.user }) ?? false
      },
      handler: createNote
    }
  ]

  return {
    actions
  }
}
