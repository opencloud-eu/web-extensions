import { TocNode } from '../types'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { sortTocNodes, useNotebookStore, useTocStore } from './stores'
import { useClientService } from '@opencloud-eu/web-pkg'

export const useLoadToc = () => {
  const { webdav } = useClientService()
  const notebookStore = useNotebookStore()
  const tocStore = useTocStore()

  const listFolderRecursive = async (
    space: SpaceResource,
    resource: Resource
  ): Promise<TocNode[]> => {
    const { children } = await webdav.listFiles(space, resource)
    const nodes: TocNode[] = []
    for (const entry of children) {
      if (entry.isFolder) {
        nodes.push({
          resource: entry,
          children: await listFolderRecursive(space, entry)
        })
      } else if (entry.mimeType === 'text/markdown') {
        nodes.push({
          resource: entry,
          children: []
        })
      }
    }
    return nodes.sort(sortTocNodes)
  }

  const loadToc = async () => {
    if (!notebookStore.space || !notebookStore.notebook) {
      return
    }
    try {
      tocStore.setTocNodes(await listFolderRecursive(notebookStore.space, notebookStore.notebook))
    } catch (e) {
      console.error('Failed to build table of contents', e)
    }
  }

  return {
    loadToc
  }
}
