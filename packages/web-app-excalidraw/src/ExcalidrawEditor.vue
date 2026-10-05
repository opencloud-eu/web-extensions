<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, unref, watch, type PropType } from 'vue'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import ExcalidrawCanvas from './react_app/ExcalidrawCanvas'

// We mount Excalidraw - a React-only component - via vanilla React 18+ `createRoot`. The
// component is keyed by the file in App.vue, so `ydoc` and `awareness` never change within one
// instance; only `isReadOnly` can flip while the file stays open.
//
// We bypass the veaury Vue<->React bridge because veaury 2.6.x breaks on React 19 ("S is not a
// function" inside __veauryMountReactComponent__). Worth revisiting later: if veaury (or an
// alternative bridge) catches up to React 19, the bidirectional reactivity is a nicer fit than
// this manual re-render dance.
//
// Everything the user sees inside the editor is Excalidraw's own UI, including the collaborator
// avatars it derives from the same awareness. We deliberately add nothing on top of it: any
// element of ours would have to be positioned against Excalidraw's internal layout and would
// need maintenance whenever that changes.
const props = defineProps({
  ydoc: { type: Object as PropType<Y.Doc>, required: true },
  awareness: { type: Object as PropType<Awareness>, required: true },
  isReadOnly: { type: Boolean, default: false }
})

const containerRef = ref<HTMLElement | null>(null)
let root: Root | null = null

const renderReact = () => {
  if (!root) return
  root.render(
    createElement(ExcalidrawCanvas, {
      ydoc: props.ydoc,
      awareness: props.awareness,
      isReadOnly: props.isReadOnly
    })
  )
}

onMounted(() => {
  const container = unref(containerRef)
  if (!container) return
  root = createRoot(container)
  renderReact()
})

// Re-render so a view-mode flip reaches Excalidraw.
watch(
  () => props.isReadOnly,
  () => renderReact()
)

onBeforeUnmount(() => {
  root?.unmount()
  root = null
})
</script>

<template>
  <div class="oc-excalidraw size-full">
    <div ref="containerRef" class="oc-excalidraw__react-host" />
  </div>
</template>

<style>
.oc-excalidraw,
.oc-excalidraw__react-host,
.oc-excalidraw__react-host .excalidraw-host {
  width: 100%;
  height: 100%;
}
</style>
