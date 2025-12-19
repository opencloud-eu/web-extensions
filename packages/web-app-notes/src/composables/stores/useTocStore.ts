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
  const tocNodes = ref<TocNode[]>(null)

  const setTocNodes = (nodes: TocNode[]) => {
    tocNodes.value = nodes
  }
  const addTocNode = (node: TocNode, parentNode?: TocNode) => {
    if (parentNode) {
      parentNode.children.push(node)
      parentNode.children.sort(sortTocNodes)
    } else {
      tocNodes.value.push(node)
      tocNodes.value.sort(sortTocNodes)
    }
  }
  const clearTocNodes = () => {
    tocNodes.value = null
  }

  const isLoaded = computed(() => {
    return unref(tocNodes) !== null
  })

  return {
    tocNodes,
    setTocNodes,
    addTocNode,
    clearTocNodes,
    isLoaded
  }
})
