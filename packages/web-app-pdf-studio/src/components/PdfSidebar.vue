<template>
  <aside
    class="pdf-studio-sidebar ext:z-20 ext:flex ext:w-[300px] ext:max-w-[80vw] ext:shrink-0 ext:flex-col ext:border-r ext:border-r-role-border ext:bg-role-surface"
    :class="{ 'ext:absolute ext:inset-y-0 ext:left-0 ext:shadow-lg': isTablet }"
    :aria-label="currentView.label"
  >
    <div class="ext:p-2">
      <oc-button
        id="pdf-studio-sidebar-views-toggle"
        class="pdf-studio-sidebar-views ext:p-1"
        appearance="raw"
        gap-size="small"
      >
        <oc-icon :name="currentView.icon" fill-type="line" size-class="ext:size-4" />
        <span class="ext:font-semibold" v-text="currentView.label" />
        <oc-icon name="arrow-down-s" fill-type="line" size-class="ext:size-4" />
      </oc-button>
      <oc-drop
        drop-id="pdf-studio-sidebar-views"
        toggle="#pdf-studio-sidebar-views-toggle"
        mode="click"
        padding-size="small"
        class="ext:w-auto ext:min-w-48"
        close-on-click
      >
        <oc-list>
          <pdf-menu-item
            v-for="view in views"
            :key="view.id"
            :class="`pdf-studio-sidebar-view-${view.id}`"
            :label="view.label"
            :icon="view.icon"
            :is-active="view.id === activeView"
            :disabled="!view.itemCount"
            @click="activeView = view.id"
          />
        </oc-list>
      </oc-drop>
    </div>
    <div
      v-if="activeView === 'outline' && outline"
      class="pdf-studio-outline ext:flex-1 ext:overflow-y-auto ext:p-2"
    >
      <pdf-outline :items="outline" />
    </div>
    <div
      v-else-if="activeView === 'attachments' && attachments"
      class="ext:flex-1 ext:overflow-y-auto ext:p-2"
    >
      <pdf-attachments :attachments="attachments" @open="emit('openAttachment', $event)" />
    </div>
    <div
      v-else-if="activeView === 'layers' && layers"
      class="pdf-studio-layers ext:flex-1 ext:overflow-y-auto ext:p-2"
    >
      <pdf-layers :items="layers" />
    </div>
    <div
      v-show="activeView === 'pages'"
      v-bind="containerProps"
      class="pdf-studio-thumbnails ext:flex-1 ext:p-2 ext:[overflow-anchor:none]"
    >
      <ol v-bind="wrapperProps" class="ext:m-0 ext:list-none ext:p-0">
        <pdf-thumbnail
          v-for="{ data: page } in list"
          :key="page"
          :pdf-document="pdfDocument"
          :page-number="page"
          :page-label="pageLabels?.[page - 1]"
          :rotation="rotation"
          :is-current="page === pageNumber"
          :is-read-only="isReadOnly"
          :is-processing="isProcessing"
          :focus-target="page === focusAction?.pageNumber ? focusAction.focusTarget : undefined"
          @focused="focusAction = undefined"
          @select="emit('goToPage', page)"
          @delete="(isKeyboard) => emit('deletePage', page, isKeyboard)"
          @move="(target, isKeyboard) => emit('movePage', page, target, isKeyboard)"
        />
      </ol>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, inject, shallowRef, unref, watch } from 'vue'
import { useIsMobile } from '@opencloud-eu/design-system/composables'
import { useGettext } from 'vue3-gettext'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { SidebarView } from '../helpers/initialView'
import type { PageAction } from '../composables/usePdfPageOperations'
import type { PdfAttachment } from '../composables/usePdfAttachments'
import PdfThumbnail from './PdfThumbnail.vue'
import { pdfOutlineKey } from '../composables/usePdfOutline'
import { pdfLayersKey } from '../composables/usePdfLayers'
import { usePdfThumbnailList } from '../composables/usePdfThumbnailList'
import PdfLayers from './PdfLayers.vue'
import PdfOutline from './PdfOutline.vue'
import PdfAttachments from './PdfAttachments.vue'
import PdfMenuItem from './PdfMenuItem.vue'

const {
  pdfDocument,
  pageNumber,
  pageLabels = undefined,
  rotation = 0,
  isReadOnly = false,
  isProcessing = false,
  lastAction = undefined,
  attachments = undefined
} = defineProps<{
  pdfDocument: PDFDocumentProxy
  pageNumber: number
  /** E.g. "iii" for the third page, see usePdfPageLabels. */
  pageLabels?: string[]
  /** Of all pages, on top of their own. */
  rotation?: number
  isReadOnly?: boolean
  isProcessing?: boolean
  /** The page the last page action was used on, as it is now, and what to focus there. */
  lastAction?: PageAction
  /** Undefined while loading. */
  attachments?: PdfAttachment[]
}>()

const emit = defineEmits<{
  goToPage: [pageNumber: number]
  deletePage: [pageNumber: number, isKeyboard: boolean]
  movePage: [pageNumber: number, targetPageNumber: number, isKeyboard: boolean]
  openAttachment: [attachment: PdfAttachment]
}>()

// Over the pages where there's no room next to them.
const { isTablet } = useIsMobile()
const { $gettext } = useGettext()

// Kept while the sidebar is closed, like in the PDF.js viewer.
const activeView = defineModel<SidebarView>('view', { default: 'pages' })

const { outline } = inject(pdfOutlineKey)
const { layers } = inject(pdfLayersKey)

// The count is undefined while loading, like in the PDF.js viewer the view is disabled then.
const views = computed<{ id: SidebarView; icon: string; label: string; itemCount?: number }[]>(
  () => [
    { id: 'pages', icon: 'pages', label: $gettext('Pages'), itemCount: pdfDocument.numPages },
    {
      id: 'outline',
      icon: 'file-list-3',
      label: $gettext('Document outline'),
      itemCount: unref(outline)?.length
    },
    {
      id: 'attachments',
      icon: 'attachment',
      label: $gettext('Attachments'),
      itemCount: attachments?.length
    },
    { id: 'layers', icon: 'stack', label: $gettext('Layers'), itemCount: unref(layers)?.length }
  ]
)

const currentView = computed(() => unref(views).find(({ id }) => id === unref(activeView)))

// A view that has nothing (any more), e.g. after loading another document, falls back to the
// pages, like in the PDF.js viewer.
watch(
  views,
  () => {
    if (unref(currentView).itemCount === 0) {
      activeView.value = 'pages'
    }
  },
  { immediate: true }
)

// The sidebar is new for every document, while the last action is set. Its thumbnail may mount
// only later, after scrolling to it. Once focused, not again when scrolling back.
const focusAction = shallowRef(lastAction)

const { list, containerProps, wrapperProps } = usePdfThumbnailList({
  pageCount: () => pdfDocument.numPages,
  pageNumber: () => pageNumber,
  isShown: () => unref(activeView) === 'pages'
})
</script>
