<script setup lang="ts">
import { type PropType } from 'vue'
import type { Resource } from '@opencloud-eu/web-client'
import type { AppConfigObject } from '@opencloud-eu/web-pkg'
// PoC-stage: borrow the generic wrapper + adapter contract from the codemirror
// package via a relative import. Slated for extraction into a shared
// `@opencloud-eu/web-collab` package when a third app lands (plan §11 Phase 4).
import CollaborativeWrapper from '../../web-app-codemirror/src/CollaborativeWrapper.vue'
import TiptapEditor from './TiptapEditor.vue'
import { tiptapMarkdownAdapter } from './adapters/tiptapMarkdown'
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
    :adapter="tiptapMarkdownAdapter"
    :editor="TiptapEditor"
    :app-version="pkg.version"
  />
</template>
