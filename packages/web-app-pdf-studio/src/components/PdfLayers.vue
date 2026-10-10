<template>
  <oc-list
    raw
    class="ext:flex ext:flex-col ext:gap-0.5"
    :class="{ 'ext:ml-3 ext:border-l ext:border-l-role-outline-variant ext:pl-1': isNested }"
  >
    <li v-for="({ item, isExpanded }, index) in entries" :key="index">
      <template v-if="isLayerGroup(item)">
        <div class="ext:flex ext:items-center ext:gap-1">
          <pdf-tree-toggle
            class="pdf-studio-layers-toggle"
            :is-expanded="isExpanded"
            @toggle="expanded[index] = !isExpanded"
          />
          <span
            class="ext:break-words ext:text-sm"
            :class="{ 'ext:italic': item.name === null }"
            dir="auto"
            v-text="item.name ?? $gettext('Additional layers')"
          />
        </div>
        <pdf-layers v-if="isExpanded" :items="item.items" is-nested />
      </template>
      <oc-checkbox
        v-else
        class="pdf-studio-layer ext:py-1.5 ext:pl-2"
        :model-value="item.isVisible"
        :label="item.name || '–'"
        @update:model-value="setVisible(item.id, $event)"
      />
    </li>
  </oc-list>
</template>

<script setup lang="ts">
import { computed, inject, reactive } from 'vue'
import {
  isLayerGroup,
  pdfLayersKey,
  type PdfLayerGroup,
  type PdfLayerItem
} from '../composables/usePdfLayers'
import PdfTreeToggle from './PdfTreeToggle.vue'

const { items, isNested = false } = defineProps<{
  items: PdfLayerItem[]
  isNested?: boolean
}>()

const { setVisible } = inject(pdfLayersKey)

// By position, the items are new after every change. Groups without a name start collapsed,
// like in the PDF.js viewer.
const expanded = reactive<Record<number, boolean>>({})

function isGroupExpanded(group: PdfLayerGroup, index: number) {
  return expanded[index] ?? group.name !== null
}

const entries = computed(() =>
  items.map((item, index) => ({
    item,
    isExpanded: isLayerGroup(item) && isGroupExpanded(item, index)
  }))
)
</script>
