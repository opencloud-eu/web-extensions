import { TocNode } from '../types'
import { useNotebookStore, useTocStore } from './stores'
import { useClientService, useMessages } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { urlJoin } from '@opencloud-eu/web-client'

export const useDragAndDrop = () => {
  const { $gettext } = useGettext()
  const { webdav } = useClientService()
  const { showMessage, showErrorMessage } = useMessages()
  const tocStore = useTocStore()
  const notebookStore = useNotebookStore()

  let dragImageEl: HTMLElement | null = null
  const createDragImageFromTarget = (ev: DragEvent) => {
    const target = ev.currentTarget as HTMLElement | null
    if (!target) {
      return
    }
    const rect = target.getBoundingClientRect()
    const clone = target.cloneNode(true) as HTMLElement
    clone.style.position = 'fixed'
    clone.style.top = '-1000px'
    clone.style.left = '-1000px'
    clone.style.pointerEvents = 'none'
    clone.style.width = rect.width + 'px'
    clone.style.background = 'rgba(255, 255, 255, 0.9)'
    clone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
    document.body.appendChild(clone)
    const offsetX = Math.round(ev.clientX - rect.left)
    const offsetY = Math.round(ev.clientY - rect.top)
    ev.dataTransfer?.setDragImage?.(clone, offsetX, offsetY)
    dragImageEl = clone
  }
  const cleanupDragImage = () => {
    if (dragImageEl && dragImageEl.parentElement) {
      dragImageEl.parentElement.removeChild(dragImageEl)
    }
    dragImageEl = null
  }

  const onDragStart = (node: TocNode, ev: DragEvent) => {
    if (!notebookStore.hasWriteAccess) {
      return
    }
    tocStore.setDraggedNode(node)
    createDragImageFromTarget(ev)
  }

  const onDragEnd = () => {
    cleanupDragImage()
    tocStore.setDraggedNode(null)
    tocStore.setDragOverNodeId(null)
    tocStore.setDragOverRoot(false)
  }

  const onDragOverFolder = (targetNode: TocNode) => {
    if (!notebookStore.hasWriteAccess) {
      return
    }
    if (!targetNode.resource?.isFolder) {
      return
    }
    try {
      const sourceNode = tocStore.draggedNode
      if (!sourceNode?.resource) {
        return
      }
      tocStore.setDragOverNodeId(targetNode.resource.id)
    } catch {}
  }

  const onDragLeaveFolder = (targetNode: TocNode) => {
    if (tocStore.dragOverNodeId === targetNode.resource.id) {
      tocStore.setDragOverNodeId(null)
    }
  }

  const onDropOnFolder = async (targetNode: TocNode) => {
    if (!notebookStore.hasWriteAccess) {
      return
    }
    try {
      const sourceNode = tocStore.draggedNode
      if (!sourceNode?.resource) {
        return
      }

      // no-op if already in target folder
      const sourceParentPath = urlJoin(...sourceNode.resource.path.split('/').slice(0, -1))
      const targetPath = urlJoin(targetNode.resource.path)
      if (sourceParentPath === targetPath) {
        return
      }

      // error if moving a folder into itself
      if (
        sourceNode.resource.isFolder &&
        targetNode.resource.path.startsWith(sourceNode.resource.path)
      ) {
        showErrorMessage({ title: $gettext('Cannot move a folder into itself.') })
        return
      }

      await webdav.moveFiles(
        notebookStore.space,
        { fileId: sourceNode.resource.id, path: sourceNode.resource.path },
        notebookStore.space,
        {
          parentFolderId: targetNode.resource.id,
          name: sourceNode.resource.name,
          path: urlJoin(targetNode.resource.path, sourceNode.resource.name)
        }
      )

      showMessage({ title: $gettext('Moved »%{name}«', { name: sourceNode.resource.name }) })
      // note: ToC gets reloaded via SSE event
    } catch (e) {
      console.error(e)
      showErrorMessage({ title: $gettext('Failed to move item'), errors: [e] })
    } finally {
      onDragEnd()
    }
  }

  const onDragOverRoot = () => {
    if (!notebookStore.hasWriteAccess) {
      return
    }
    try {
      const sourceNode = tocStore.draggedNode
      if (!sourceNode?.resource) {
        return
      }
      tocStore.setDragOverRoot(true)
    } catch {}
  }

  const onDragLeaveRoot = () => {
    tocStore.setDragOverRoot(false)
  }

  const onDropOnRoot = async () => {
    if (!notebookStore.hasWriteAccess) {
      return
    }
    try {
      const sourceNode = tocStore.draggedNode
      if (!sourceNode?.resource) {
        return
      }

      // no-op if already in root
      const parentFolderPath = urlJoin(...sourceNode.resource.path.split('/').slice(0, -1))
      const rootFolderPath = urlJoin(notebookStore.notebook.path)
      if (parentFolderPath === rootFolderPath) {
        return
      }

      await webdav.moveFiles(
        notebookStore.space,
        { fileId: sourceNode.resource.id, path: sourceNode.resource.path },
        notebookStore.space,
        {
          parentFolderId: notebookStore.notebook.id,
          name: sourceNode.resource.name,
          path: urlJoin(notebookStore.notebook.path, sourceNode.resource.name)
        }
      )

      showMessage({
        title: $gettext('Moved »%{name}« to root', { name: sourceNode.resource.name })
      })
      // note: ToC gets reloaded via SSE event
    } catch (e) {
      console.error(e)
      showErrorMessage({ title: $gettext('Failed to move item'), errors: [e] })
    } finally {
      onDragEnd()
    }
  }

  return {
    onDragStart,
    onDragEnd,
    onDragOverFolder,
    onDragLeaveFolder,
    onDropOnFolder,
    onDragOverRoot,
    onDragLeaveRoot,
    onDropOnRoot
  }
}
