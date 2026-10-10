<template>
  <oc-list
    raw
    class="ext:flex ext:flex-col ext:gap-0.5"
    :class="{ 'ext:ml-3 ext:border-l ext:border-l-role-outline-variant ext:pl-1': isNested }"
  >
    <li v-for="({ item, isExpanded }, index) in entries" :key="index">
      <div
        class="ext:flex ext:items-start ext:gap-1 ext:rounded-lg ext:pr-2"
        :class="
          isCurrent(item)
            ? 'ext:bg-role-secondary-container ext:text-role-on-secondary-container'
            : 'ext:hover:bg-role-surface-container-high'
        "
      >
        <pdf-tree-toggle
          v-if="item.items.length"
          class="pdf-studio-outline-toggle"
          :is-expanded="isExpanded"
          @toggle="toggle(item)"
        />
        <span v-else class="ext:w-8 ext:shrink-0" />
        <oc-button
          v-bind="
            item.url
              ? { type: 'a', href: item.url, target: '_blank', rel: 'noopener noreferrer' }
              : {}
          "
          class="pdf-studio-outline-item ext:min-w-0 ext:flex-1 ext:py-1.5 ext:text-left ext:text-sm"
          :class="{ 'ext:font-semibold': item.bold, 'ext:italic': item.italic }"
          :aria-current="isCurrent(item) ? 'location' : undefined"
          :disabled="!item.url && !canOpen(item)"
          appearance="raw"
          justify-content="left"
          gap-size="small"
          no-hover
          @click="!item.url && open(item)"
        >
          <span class="ext:break-words" dir="auto" v-text="getTitle(item)" />
          <oc-icon
            v-if="item.url"
            name="external-link"
            fill-type="line"
            size-class="ext:size-3.5 ext:shrink-0"
          />
        </oc-button>
        <span
          v-if="getPageNumber(item)"
          class="ext:shrink-0 ext:pt-2 ext:text-xs ext:tabular-nums ext:text-role-on-surface-variant"
          v-text="getPageNumber(item)"
        />
      </div>
      <pdf-outline v-if="item.items.length && isExpanded" :items="item.items" is-nested />
    </li>
  </oc-list>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { pdfOutlineKey, type OutlineItem } from '../composables/usePdfOutline'
import PdfTreeToggle from './PdfTreeToggle.vue'

const { items, isNested = false } = defineProps<{
  items: OutlineItem[]
  isNested?: boolean
}>()

const { getPageNumber, isCurrent, isExpanded: isItemExpanded, toggle, open } = inject(pdfOutlineKey)

const entries = computed(() => items.map((item) => ({ item, isExpanded: isItemExpanded(item) })))

// Same as the PDF.js viewer: invisible characters removed, a dash for empty titles.
function getTitle({ title }: OutlineItem) {
  return (
    title
      .replaceAll(/[\x01-\x1F]/g, ' ')
      .replaceAll('\x00', '')
      .trim() || '–'
  )
}

function canOpen({ dest, action, attachment, setOCGState }: OutlineItem) {
  return !!(dest || action || attachment || setOCGState)
}
</script>
