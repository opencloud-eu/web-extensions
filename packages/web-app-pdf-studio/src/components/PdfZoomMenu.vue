<template>
  <pdf-toolbar-button
    id="pdf-studio-zoom-toggle"
    class="pdf-studio-zoom"
    :label="$gettext('Zoom')"
    has-dropdown
  >
    <span class="pdf-studio-zoom-label ext:mr-1 ext:min-w-12 ext:text-sm" v-text="currentLabel" />
  </pdf-toolbar-button>
  <oc-drop
    drop-id="pdf-studio-zoom-drop"
    toggle="#pdf-studio-zoom-toggle"
    mode="click"
    padding-size="small"
    class="ext:w-auto ext:min-w-44"
    close-on-click
  >
    <oc-list>
      <pdf-menu-item
        v-for="option in scaleOptions"
        :key="option.value"
        class="pdf-studio-scale-option"
        :data-scale="option.value"
        :label="option.label"
        :is-active="option.value === scaleValue"
        @click="emit('setScale', option.value)"
      />
    </oc-list>
  </oc-drop>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { ScaleValue } from '../composables/usePdfViewer'
import PdfMenuItem from './PdfMenuItem.vue'
import PdfToolbarButton from './PdfToolbarButton.vue'

const { scaleValue, scale } = defineProps<{
  scaleValue: ScaleValue
  /** The current zoom, e.g. 1.25 for 125%. */
  scale: number
}>()

const emit = defineEmits<{
  setScale: [value: ScaleValue]
}>()

const language = useGettext()
const { $gettext } = language

function formatPercent(value: number) {
  return new Intl.NumberFormat(language.current.replace('_', '-'), {
    style: 'percent',
    maximumFractionDigits: 0
  }).format(value)
}

const scaleOptions = computed<{ value: ScaleValue; label: string }[]>(() => [
  { value: 'auto', label: $gettext('Automatic zoom') },
  { value: 'page-actual', label: $gettext('Actual size') },
  { value: 'page-fit', label: $gettext('Page fit') },
  { value: 'page-width', label: $gettext('Page width') },
  ...[0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((scale) => ({
    value: String(scale),
    label: formatPercent(scale)
  }))
])

// The actual zoom also for presets like "Page fit", short so the toolbar fits narrow windows.
const currentLabel = computed(() => formatPercent(scale))
</script>
