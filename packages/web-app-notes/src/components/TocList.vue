<template>
  <ul class="ext:pl-0">
    <li
      v-for="node in nodes"
      :key="node.resource.isFolder ? `folder-${node.resource.id}` : `file-${node.resource.id}`"
    >
      <div
        class="ext:flex ext:items-center ext:gap-1 ext:py-1"
        :draggable="true"
        @dragstart="onDragStart(node, $event)"
        @dragend="onDragEnd"
      >
        <TocFolder v-if="node.resource.isFolder" :node="node" />
        <TocFile v-else :node="node" />
      </div>
      <div v-if="!node.collapsed && node.children?.length" class="ext:ml-4">
        <TocList :nodes="node.children" />
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import TocFolder from './TocFolder.vue'
import TocFile from './TocFile.vue'
import { TocNode } from '../types'
import { useDragAndDrop } from '../composables'

const { nodes } = defineProps<{
  nodes: TocNode[]
}>()

const { onDragStart, onDragEnd } = useDragAndDrop()
</script>
