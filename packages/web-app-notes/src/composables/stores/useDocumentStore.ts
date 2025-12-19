import { defineStore } from 'pinia'
import { computed, ref, unref } from 'vue'
import { Resource } from '@opencloud-eu/web-client'

export const useDocumentStore = defineStore('document', () => {
  const documentResource = ref<Resource>()
  const documentContent = ref<string>()
  const documentContentInitial = ref<string>()

  const documentId = computed(() => {
    return unref(documentResource)?.id
  })

  const setDocument = (resource: Resource, content: string) => {
    documentResource.value = resource
    setDocumentContent(content, true)
  }
  const setDocumentContent = (content: string, resetInitial: boolean = false) => {
    documentContent.value = content
    if (resetInitial) {
      documentContentInitial.value = content
    }
  }
  const isDocumentDirty = computed(() => {
    return unref(documentContent) !== unref(documentContentInitial)
  })

  const clearDocument = () => {
    documentResource.value = null
    documentContent.value = ''
    documentContentInitial.value = ''
  }

  return {
    documentId,
    documentResource,
    documentContent,
    setDocument,
    setDocumentContent,
    isDocumentDirty,
    clearDocument
  }
})
