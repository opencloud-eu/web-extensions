import { Resource } from '@opencloud-eu/web-client'
import { TocNode } from './types/index'

export const appId = 'notes'
export const fileExtensionNotes = 'ocnb'

const stripExtension = (name: string, extension: string) => {
  const suffix = `.${extension}`
  return name.toLowerCase().endsWith(suffix) ? name.slice(0, -suffix.length) : name
}

const getSafeResourceName = (resource: Resource) => {
  return resource.name || resource.path?.split('/').filter(Boolean).pop() || ''
}

export const getResourceLabel = (resource: Resource) => {
  if (resource.isFolder) {
    return stripExtension(getSafeResourceName(resource), fileExtensionNotes)
  }

  const fileName = getSafeResourceName(resource)
  const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
  return extension ? stripExtension(fileName, extension) : fileName
}

export const flattenTocNodes = (nodes: TocNode[] = []): TocNode[] => {
  return nodes.flatMap((node) => [
    node,
    ...(node.children?.length ? flattenTocNodes(node.children) : [])
  ])
}

export const filterFoldersTree = (nodes: TocNode[] = []): TocNode[] => {
  return nodes
    .filter((node) => node.resource.isFolder)
    .map((node) => ({
      ...node,
      children: node.children ? filterFoldersTree(node.children) : []
    }))
}

export const getNotesInFolder = (nodes: TocNode[] = [], folderId: string | null): TocNode[] => {
  if (!folderId) {
    return nodes.filter((node) => !node.resource.isFolder)
  }

  const folderNode = flattenTocNodes(nodes).find((node) => node.resource.id === folderId)
  if (!folderNode || !folderNode.children) {
    return []
  }

  return folderNode.children.filter((node) => !node.resource.isFolder)
}

export const getNoteNodes = (nodes: TocNode[] = []) => {
  return flattenTocNodes(nodes).filter(({ resource }) => !resource.isFolder)
}

export const countNotes = (nodes: TocNode[] = []) => {
  return getNoteNodes(nodes).length
}

export const countFolders = (nodes: TocNode[] = []) => {
  return flattenTocNodes(nodes).filter(({ resource }) => resource.isFolder).length
}

export const searchNoteNodes = (nodes: TocNode[] = [], searchTerm: string) => {
  const query = searchTerm.trim().toLocaleLowerCase()

  if (!query) {
    return []
  }

  return getNoteNodes(nodes).filter(({ resource }) => {
    return getResourceLabel(resource).toLocaleLowerCase().includes(query)
  })
}

export const getNotebookPathLabel = (notebook: Resource | null, resource: Resource) => {
  if (!resource.path) {
    return 'Markdown note'
  }

  if (!notebook?.path) {
    return resource.path
  }

  const relativePath = resource.path.replace(notebook.path, '').split('/').filter(Boolean)

  if (relativePath.length <= 1) {
    return 'Root note'
  }

  return relativePath.slice(0, -1).join(' / ')
}
