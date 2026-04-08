import { TocNode } from '../../types'
import { useGettext } from 'vue3-gettext'
import { createFileRouteOptions, useRouter, FileAction } from '@opencloud-eu/web-pkg'
import { appId } from '../../util'
import { useNotebookStore } from '../stores/index'
import { storeToRefs } from 'pinia'
import { unref } from 'vue'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'

export const buildDocumentRoute = (
  space: SpaceResource | null,
  notebook: Resource | null,
  node: TocNode
) => {
  if (!space || !notebook) {
    throw new Error('Notebook context is not loaded')
  }

  const routeOptions = createFileRouteOptions(unref(space), unref(notebook))
  return {
    name: `${appId}-view`,
    params: routeOptions.params,
    query: {
      ...routeOptions.query,
      pageFileId: node.resource.fileId
    }
  }
}

export const useActionsOpenDocument = (node: TocNode) => {
  const { $gettext } = useGettext()
  const router = useRouter()
  const notebookStore = useNotebookStore()
  const { space, notebook } = storeToRefs(notebookStore)

  const actions: FileAction[] = [
    {
      name: 'open-note',
      icon: 'folder-open',
      label: () => $gettext('Open'),
      isVisible: () => true,
      handler: async () => {
        if (node.resource.isFolder) {
          return
        }
        await router.push(buildDocumentRoute(unref(space), unref(notebook), node))
      }
    }
  ]

  return {
    actions
  }
}
