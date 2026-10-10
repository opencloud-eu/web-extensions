<template>
  <div class="ext:inline-flex">
    <pdf-toolbar-button
      :label="tool.label"
      :icon="tool.icon"
      :fill-type="tool.fillType"
      :is-active="isActive"
      :disabled="disabled"
      :class="['pdf-studio-tool', `pdf-studio-tool-${tool.id}`]"
      @click="emit('select')"
    />
    <oc-button
      :id="`pdf-studio-${tool.id}-settings-toggle`"
      v-oc-tooltip="dropTitle"
      :aria-label="dropTitle"
      :disabled="disabled || isDropDisabled"
      :class="`pdf-studio-${tool.id}-settings`"
      class="ext:inline-flex ext:items-center ext:px-0.5"
      appearance="raw"
      gap-size="none"
      @pointerdown="emit('openDrop')"
    >
      <oc-icon name="arrow-down-s" fill-type="line" size-class="ext:size-4" />
    </oc-button>
    <oc-drop
      ref="drop"
      :drop-id="`pdf-studio-${tool.id}-settings`"
      :toggle="`#pdf-studio-${tool.id}-settings-toggle`"
      :title="dropTitle"
      mode="click"
      :padding-size="paddingSize"
      :close-on-click="false"
      :is-menu="isMenu"
      class="ext:w-64"
    >
      <slot :hide="hide" />
    </oc-drop>
  </div>
</template>

<script setup lang="ts">
import { unref, useTemplateRef } from 'vue'
import PdfToolbarButton from './PdfToolbarButton.vue'

// A tool of the toolbar with a chevron next to it, which opens a drop with more of the tool.
const {
  tool,
  dropTitle,
  isActive = false,
  disabled = false,
  isDropDisabled = false,
  paddingSize = 'medium',
  isMenu = true
} = defineProps<{
  tool: { id: string; label: string; icon: string; fillType?: 'line' | 'none' }
  dropTitle: string
  isActive?: boolean
  disabled?: boolean
  /** Only the drop, e.g. the settings of a tool that isn't active. */
  isDropDisabled?: boolean
  paddingSize?: 'small' | 'medium'
  isMenu?: boolean
}>()

const emit = defineEmits<{ select: []; openDrop: [] }>()

defineSlots<{ default(props: { hide: () => void }): unknown }>()

const drop = useTemplateRef<{ hide(): void }>('drop')

function hide() {
  unref(drop)?.hide()
}
</script>
