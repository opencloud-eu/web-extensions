import { defineStore } from 'pinia'
import { ref } from 'vue'
import { Resource } from '@opencloud-eu/web-client'

export const useFolderStore = defineStore('notes-folder', () => {
  const activeFolder = ref<Resource | null>(null)

  const setActiveFolder = (folder: Resource | null) => {
    activeFolder.value = folder
  }

  const clearActiveFolder = () => {
    activeFolder.value = null
  }

  return {
    activeFolder,
    setActiveFolder,
    clearActiveFolder
  }
})