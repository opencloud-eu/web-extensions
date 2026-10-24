<template>
  <pdf-studio
    :key="resource.id"
    :resource="resource"
    :current-content="currentContent"
    :is-read-only="isReadOnly"
    :is-dirty="isDirty"
    :current-file-context="currentFileContext"
    @update:current-content="emit('update:currentContent', $event)"
    @save="emit('save')"
    @register:on-save-callback="emit('register:onSaveCallback', $event)"
  />
</template>

<script lang="ts">
import { defineAsyncComponent } from 'vue'
import { AppLoadingSpinner } from '@opencloud-eu/web-pkg'

// AppWrapper inspects the props and emits of this component to decide what to load and
// whether the app is an editor, so it has to be available synchronously. PDF.js and its
// stylesheet are big though, and are only pulled in once a PDF actually gets opened.
// Defined once for the module: inside setup, the loader would keep the first file in memory.
const PdfStudio = defineAsyncComponent({
  loader: () => import('./components/PdfStudio.vue'),
  loadingComponent: AppLoadingSpinner
})
</script>

<script setup lang="ts">
import type { Resource } from '@opencloud-eu/web-client'
import type { FileContext } from '@opencloud-eu/web-pkg'

const { resource, currentContent, isReadOnly, isDirty, currentFileContext } = defineProps<{
  resource: Resource
  currentContent: ArrayBuffer
  isReadOnly: boolean
  isDirty: boolean
  /** Where the file was opened from, to close the app. */
  currentFileContext: FileContext
}>()

const emit = defineEmits<{
  'update:currentContent': [content: ArrayBuffer]
  save: []
  /** AppWrapper calls it after each of its saves, see usePdfSaving. */
  'register:onSaveCallback': [callback: () => Promise<void>]
}>()
</script>
