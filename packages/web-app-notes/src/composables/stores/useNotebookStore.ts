import { defineStore } from 'pinia'
import { computed, ref, unref } from 'vue'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'

export const useNotebookStore = defineStore('notebook', () => {
  const space = ref<SpaceResource | null>(null)
  const notebook = ref<Resource | null>(null)
  const setNotebook = (spaceResource: SpaceResource, notebookResource: Resource) => {
    space.value = spaceResource
    notebook.value = notebookResource
  }

  const clearNotebook = () => {
    space.value = null
    notebook.value = null
  }

  const isLoaded = computed(() => {
    return unref(space) !== null && unref(notebook) !== null
  })

  const hasWriteAccess = computed(() => {
    return unref(notebook)?.canCreate()
  })

  return {
    space,
    notebook,
    setNotebook,
    clearNotebook,
    isLoaded,
    hasWriteAccess
  }
})
