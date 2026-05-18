<script setup lang="ts">
import { type PropType } from 'vue'
import type { Resource } from '@opencloud-eu/web-client'
import type { AppConfigObject } from '@opencloud-eu/web-pkg'
import CollaborativeWrapper from './CollaborativeWrapper.vue'
import CodeMirrorEditor from './CodeMirrorEditor.vue'
import { codemirrorMarkdownAdapter } from './adapters/codemirrorMarkdown'
import pkg from '../package.json'

defineProps({
  applicationConfig: { type: Object as PropType<AppConfigObject>, required: true },
  currentContent: { type: String, required: true },
  isReadOnly: { type: Boolean, required: false, default: false },
  resource: { type: Object as PropType<Resource>, required: true }
})
</script>

<template>
  <CollaborativeWrapper
    :resource="resource"
    :current-content="currentContent"
    :is-read-only="isReadOnly"
    :adapter="codemirrorMarkdownAdapter"
    :editor="CodeMirrorEditor"
    :app-version="pkg.version"
  />
</template>
