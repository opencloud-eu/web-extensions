<template>
  <div ref="containerRef" class="apollon-editor size-full" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, unref, watch, type PropType } from 'vue'
import { storeToRefs } from 'pinia'
import type * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import { ApollonEditor, paletteControl, zoomControl } from '@tumaet/apollon'
import '@tumaet/apollon/style.css'
import { useThemeStore } from '@opencloud-eu/web-pkg'

const props = defineProps({
  ydoc: { type: Object as PropType<Y.Doc>, required: true },
  awareness: { type: Object as PropType<Awareness>, required: true },
  isReadOnly: { type: Boolean, default: false }
})

const { currentTheme } = storeToRefs(useThemeStore())
const dataTheme = computed(() => (unref(currentTheme)?.isDark ? 'dark' : 'light'))

const containerRef = ref<HTMLElement | null>(null)
let editor: ApollonEditor | null = null

onMounted(() => {
  const container = unref(containerRef)
  if (!container) {
    return
  }
  editor = new ApollonEditor(container, {
    readonly: props.isReadOnly,
    dataTheme: unref(dataTheme),
    controls: [paletteControl(), zoomControl()],
    collaboration: {
      ydoc: props.ydoc,
      awareness: props.awareness,
      showPresence: true,
      showCursors: true,
      showSelectionHighlights: true,
      showFollow: false
    }
  })
})

watch(
  () => props.isReadOnly,
  (isReadOnly) => editor?.setReadonly(isReadOnly)
)

watch(dataTheme, (theme) => unref(containerRef)?.setAttribute('data-theme', theme))

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})
</script>
