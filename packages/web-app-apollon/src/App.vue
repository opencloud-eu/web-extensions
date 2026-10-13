<template>
  <div class="apollon-app size-full">
    <app-loading-spinner v-if="!ydoc || !awareness" />
    <ApollonEditor
      v-else-if="diagramExists"
      :key="resource.id"
      :ydoc="ydoc"
      :awareness="awareness"
      :is-read-only="isReadOnly"
    />
    <div
      v-else-if="isUnreadable || isReadOnly"
      class="apollon-notice flex size-full items-center justify-center p-4 text-role-on-surface-variant"
    >
      <span
        v-if="isUnreadable"
        v-text="$gettext('This file could not be read as an Apollon diagram.')"
      />
      <span v-else v-text="$gettext('This diagram is empty.')" />
    </div>
    <DiagramTypePicker v-else @select="onSelectType" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { UMLDiagramType } from '@tumaet/apollon'
import { extractNameWithoutExtension } from '@opencloud-eu/web-client'
import { AppLoadingSpinner, type YjsEditorSlotProps } from '@opencloud-eu/web-pkg'
import ApollonEditor from './ApollonEditor.vue'
import DiagramTypePicker from './DiagramTypePicker.vue'
import { createDiagram } from './adapters/apollonAdapter'
import { useDiagramExists } from './composables/useDiagramExists'

const props = defineProps<YjsEditorSlotProps>()

const { $gettext } = useGettext()

const { diagramExists } = useDiagramExists(() => props.ydoc)

// The session hands over an empty document for a file that has content only when
// hydrating it failed. Offering a diagram type then would overwrite that content.
const isUnreadable = computed(() => {
  return typeof props.currentContent === 'string' && props.currentContent.trim() !== ''
})

function onSelectType(type: UMLDiagramType) {
  if (!props.ydoc) {
    return
  }
  createDiagram(props.ydoc, type, extractNameWithoutExtension(props.resource))
}
</script>
