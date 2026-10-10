<template>
  <template v-for="(group, index) in groups" :key="group.id">
    <oc-list
      :class="{ 'ext:mt-2 ext:border-t ext:border-role-border ext:pt-2': index > 0 }"
      :aria-label="group.label"
    >
      <pdf-menu-item
        v-for="option in group.options"
        :key="option.value"
        :class="`pdf-studio-${group.id}-option`"
        :data-mode="option.value"
        :label="option.label"
        :icon="option.icon"
        :is-active="option.value === group.current"
        @click="group.select(option.value)"
      />
    </oc-list>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { ScrollMode, SpreadMode } from 'pdfjs-dist/web/pdf_viewer.mjs'
import PdfMenuItem from './PdfMenuItem.vue'

const { scrollMode, spreadMode } = defineProps<{ scrollMode: number; spreadMode: number }>()

const emit = defineEmits<{
  setScrollMode: [mode: number]
  setSpreadMode: [mode: number]
}>()

const { $gettext } = useGettext()

// Same choices and names as in the PDF.js viewer's menu.
const groups = computed(() => [
  {
    id: 'scroll',
    label: $gettext('Scrolling'),
    current: scrollMode,
    select: (mode: number) => emit('setScrollMode', mode),
    options: [
      { value: ScrollMode.PAGE, icon: 'file-paper', label: $gettext('Page scrolling') },
      { value: ScrollMode.VERTICAL, icon: 'arrow-up-down', label: $gettext('Vertical scrolling') },
      {
        value: ScrollMode.HORIZONTAL,
        icon: 'arrow-left-right',
        label: $gettext('Horizontal scrolling')
      },
      { value: ScrollMode.WRAPPED, icon: 'layout-grid', label: $gettext('Wrapped scrolling') }
    ]
  },
  {
    id: 'spread',
    label: $gettext('Pages side by side'),
    current: spreadMode,
    select: (mode: number) => emit('setSpreadMode', mode),
    options: [
      { value: SpreadMode.NONE, icon: 'file', label: $gettext('No spreads') },
      { value: SpreadMode.ODD, icon: 'book-open', label: $gettext('Odd spreads') },
      { value: SpreadMode.EVEN, icon: 'pages', label: $gettext('Even spreads') }
    ]
  }
])
</script>
