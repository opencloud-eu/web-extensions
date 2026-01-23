import { defineStore } from 'pinia'
import { computed, ref, unref } from 'vue'
import { TocNode } from '../../types'

export const sortTocNodes = (a: TocNode, b: TocNode) => {
  if (a.resource.isFolder === b.resource.isFolder) {
    return a.resource.name.toLowerCase().localeCompare(b.resource.name.toLowerCase())
  }
  return a.resource.isFolder ? -1 : 1
}

export const useTocStore = defineStore('toc', () => {
  const tocNodes = ref<TocNode[] | null>(null)

  const setTocNodes = (nodes: TocNode[]) => {
    tocNodes.value = nodes
  }
  const addTocNode = (node: TocNode, parentNode?: TocNode) => {
    if (parentNode) {
      // FIXME: we should find the parentNode in the tocNodes ref instead of mutating the parentNode
      // (as it might be a copy of the original node)
      parentNode.children.push(node)
      parentNode.children.sort(sortTocNodes)
    } else {
      tocNodes.value.push(node)
      tocNodes.value.sort(sortTocNodes)
    }
  }

  const isLoaded = computed(() => {
    return unref(tocNodes) !== null
  })

  const draggedNode = ref<TocNode | null>(null)
  const setDraggedNode = (node: TocNode | null) => {
    draggedNode.value = node
    if (node === null) {
      dragOverNodeId.value = null
    }
  }
  const isDragAndDropActive = computed(() => {
    return unref(draggedNode) !== null
  })
  const isDraggedNode = (node: TocNode) => {
    return unref(draggedNode)?.resource?.id === node.resource.id
  }
  const dragOverNodeId = ref<string | null>(null)
  const setDragOverNodeId = (id: string | null) => {
    dragOverNodeId.value = id
  }
  const isDragOverNode = (node: TocNode) => {
    return unref(dragOverNodeId) === node.resource.id
  }
  const dragOverRoot = ref<boolean>(false)
  const setDragOverRoot = (value: boolean) => {
    dragOverRoot.value = value
  }

  const toggleNodeCollapse = (node: TocNode) => {
    // FIXME: we should find the node in the tocNodes ref instead of mutating the node
    // (as it might be a copy of the original node)
    node.collapsed = !node.collapsed
  }

  const clearTocNodes = () => {
    tocNodes.value = null
    draggedNode.value = null
    dragOverNodeId.value = null
    dragOverRoot.value = false
  }

  return {
    tocNodes,
    setTocNodes,
    addTocNode,
    clearTocNodes,
    isLoaded,
    draggedNode,
    setDraggedNode,
    isDragAndDropActive,
    isDraggedNode,
    dragOverNodeId,
    setDragOverNodeId,
    isDragOverNode,
    dragOverRoot,
    setDragOverRoot,
    toggleNodeCollapse
  }
})
