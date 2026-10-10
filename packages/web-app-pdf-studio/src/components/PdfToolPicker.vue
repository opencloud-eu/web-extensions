<template>
  <pdf-toolbar-button
    id="pdf-studio-tool-picker-toggle"
    :label="toggleLabel"
    :icon="activeTool?.icon ?? 'pencil-ruler-2'"
    :fill-type="activeTool?.fillType ?? 'line'"
    :is-active="!!activeTool"
    :disabled="disabled"
    has-dropdown
    class="pdf-studio-tool-picker"
    @pointerdown="emit('openSettings')"
  />
  <oc-drop
    ref="drop"
    drop-id="pdf-studio-tool-picker"
    toggle="#pdf-studio-tool-picker-toggle"
    :title="$gettext('Annotation tools')"
    mode="click"
    padding-size="small"
    :close-on-click="false"
    :is-menu="false"
    class="ext:w-64"
  >
    <oc-list>
      <template v-for="tool in tools" :key="tool.id">
        <pdf-menu-item
          v-if="tool.id !== 'stamp'"
          :class="`pdf-studio-tool-picker-${tool.id}`"
          :label="tool.label"
          :icon="tool.icon"
          :fill-type="tool.fillType"
          :is-active="tool.mode === editorMode"
          @click="selectTool(tool.mode)"
        />
      </template>
    </oc-list>
    <div :class="sectionClass">
      <p :class="headingClass" v-text="imageTool.label" />
      <oc-list>
        <pdf-menu-item
          v-for="source in imageSources"
          :key="source.id"
          :class="`pdf-studio-tool-picker-image-${source.id}`"
          :label="source.label"
          :icon="source.icon"
          @click="addImage(source.id)"
        />
      </oc-list>
    </div>
    <div v-if="activeTool?.settings" :class="sectionClass" class="pdf-studio-tool-picker-settings">
      <p :class="headingClass" v-text="activeTool.settingsLabel" />
      <pdf-tool-settings
        class="ext:px-2"
        :settings="activeTool.settings"
        :values="getValues(activeTool.settings)"
        @update="(type, value) => emit('updateParam', activeTool.mode, type, value)"
      />
    </div>
    <div v-if="savedSignatures.length" :class="sectionClass">
      <p :class="headingClass" v-text="$gettext('Saved signatures')" />
      <pdf-saved-signatures
        :signatures="savedSignatures"
        :has-add-new="false"
        @add="addSavedSignature"
        @remove="(uuid) => emit('removeSavedSignature', uuid)"
      />
    </div>
  </oc-drop>
</template>

<script setup lang="ts">
import { computed, unref, useTemplateRef } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  usePdfAnnotationTools,
  type AnnotationToolsEmits,
  type AnnotationToolsProps
} from '../composables/usePdfAnnotationTools'
import type { SavedSignature } from '../composables/usePdfSignatureStorage'
import PdfToolbarButton from './PdfToolbarButton.vue'
import PdfMenuItem from './PdfMenuItem.vue'
import PdfToolSettings from './PdfToolSettings.vue'
import PdfSavedSignatures from './PdfSavedSignatures.vue'

const {
  editorMode,
  params = new Map(),
  savedSignatures = [],
  disabled = false
} = defineProps<AnnotationToolsProps>()

const emit = defineEmits<AnnotationToolsEmits>()

const { $gettext } = useGettext()

const { tools, imageSources, getValues } = usePdfAnnotationTools({ params: () => params })

const sectionClass = 'ext:mt-2 ext:border-t ext:border-role-border ext:pt-2'
const headingClass = 'ext:px-2 ext:pb-1 ext:text-xs ext:text-role-on-surface-variant'

const drop = useTemplateRef<{ hide(): void }>('drop')

const imageTool = computed(() => unref(tools).find(({ id }) => id === 'stamp'))
const activeTool = computed(() => unref(tools).find(({ mode }) => mode === editorMode))

// It opens the drop (expanded state), it isn't a toggle of the tool, which it names instead.
const toggleLabel = computed(() =>
  unref(activeTool)
    ? $gettext('Annotation tools: %{tool}', { tool: unref(activeTool).label })
    : $gettext('Annotation tools')
)

// The drop closes right away, the tool is used on the page.
function selectTool(mode: number) {
  unref(drop)?.hide()
  emit('selectTool', mode)
}

function addImage(source: 'device' | 'cloud') {
  unref(drop)?.hide()
  emit('addImage', source)
}

function addSavedSignature(signature: SavedSignature) {
  unref(drop)?.hide()
  emit('addSavedSignature', signature)
}
</script>
