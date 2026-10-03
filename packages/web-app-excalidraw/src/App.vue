<template>
  <div class="excalidraw-app size-full">
    <app-loading-spinner v-if="!ydoc || !awareness" />
    <!--
      Keyed by the file: AppWrapper rebuilds the Y.Doc and the Awareness when the user
      navigates to another .excalidraw without tearing the app down. Re-creating the editor
      is simpler than re-binding the React root to the new session by hand.
    -->
    <ExcalidrawEditor
      v-else
      :key="resource.id"
      :ydoc="ydoc"
      :awareness="awareness"
      :is-read-only="isReadOnly"
    />
  </div>
</template>

<script setup lang="ts">
import { AppLoadingSpinner, type YjsEditorSlotProps } from '@opencloud-eu/web-pkg'
import ExcalidrawEditor from './ExcalidrawEditor.vue'

// AppWrapper owns the Yjs session and hands the Y.Doc and the Awareness down once the
// session is synced and hydrated. Both are null until then, also in local mode.
defineProps<YjsEditorSlotProps>()
</script>
