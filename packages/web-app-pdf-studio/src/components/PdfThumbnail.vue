<template>
  <li
    ref="root"
    class="pdf-studio-thumbnail ext:flex ext:justify-center ext:rounded-lg ext:p-2 ext:transition-colors"
    :class="
      isCurrent
        ? 'ext:bg-role-secondary-container ext:forced-colors:outline-2 ext:forced-colors:-outline-offset-2 ext:forced-colors:outline-[Highlight]'
        : 'ext:hover:bg-role-surface-container'
    "
    :style="{ height: `${THUMBNAIL_HEIGHT}px`, marginBottom: `${THUMBNAIL_GAP}px` }"
    :data-page-number="pageNumber"
  >
    <div class="ext:flex ext:min-w-0 ext:flex-col">
      <div class="ext:flex ext:h-40 ext:items-center ext:justify-center">
        <oc-button
          ref="pageButton"
          class="ext:block ext:overflow-hidden ext:rounded-md ext:bg-white ext:shadow-sm ext:ring-1 ext:ring-black/10"
          :aria-label="$gettext('Go to page %{page}', { page: label })"
          :aria-current="isCurrent ? 'page' : undefined"
          appearance="raw"
          gap-size="none"
          no-hover
          @click="emit('select')"
        >
          <img
            v-if="imageUrl"
            :src="imageUrl"
            alt=""
            class="ext:block ext:max-h-40 ext:w-auto ext:max-w-full"
          />
          <span v-else class="ext:block ext:aspect-[1/1.414] ext:h-40" />
        </oc-button>
      </div>
      <div
        class="ext:mt-1 ext:flex ext:h-6 ext:items-center ext:pl-0.5"
        :class="isReadOnly ? 'ext:justify-center' : 'ext:justify-between'"
      >
        <span
          class="ext:w-0 ext:flex-1 ext:truncate ext:text-xs ext:tabular-nums"
          :class="[
            isCurrent
              ? 'ext:font-semibold ext:text-role-on-secondary-container'
              : 'ext:text-role-on-surface-variant',
            { 'ext:text-center': isReadOnly }
          ]"
          v-text="label"
        />
        <template v-if="!isReadOnly">
          <oc-button
            :id="`pdf-studio-page-actions-${pageNumber}`"
            v-oc-tooltip="$gettext('Page actions')"
            :aria-label="$gettext('Actions for page %{page}', { page: label })"
            :disabled="isProcessing"
            class="pdf-studio-page-actions ext:p-1 ext:disabled:opacity-30"
            appearance="raw-inverse"
            color-role="surface"
            gap-size="none"
          >
            <oc-icon name="more-2" fill-type="line" size-class="ext:size-4" />
          </oc-button>
          <oc-drop
            :drop-id="`pdf-studio-page-actions-drop-${pageNumber}`"
            :toggle="`#pdf-studio-page-actions-${pageNumber}`"
            :title="$gettext('Page %{page}', { page: label })"
            mode="click"
            padding-size="small"
            class="ext:w-auto ext:min-w-48"
            close-on-click
          >
            <oc-list>
              <pdf-menu-item
                v-for="action in actions"
                :key="action.id"
                :class="`pdf-studio-${action.id}`"
                :label="action.label"
                :icon="action.icon"
                :disabled="action.disabled"
                @click="(event: MouseEvent) => action.handler(isKeyboardClick(event))"
              />
            </oc-list>
          </oc-drop>
        </template>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, unref, useTemplateRef } from 'vue'
import { until } from '@vueuse/core'
import { useGettext } from 'vue3-gettext'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { usePdfThumbnailImage } from '../composables/usePdfThumbnailImage'
import { THUMBNAIL_GAP, THUMBNAIL_HEIGHT } from '../composables/usePdfThumbnailList'
import { pdfThumbnailCacheKey } from '../composables/usePdfThumbnailCache'
import { pdfEventBusKey } from '../composables/usePdfViewer'
import PdfMenuItem from './PdfMenuItem.vue'

const {
  pdfDocument,
  pageNumber,
  pageLabel = undefined,
  rotation = 0,
  isCurrent = false,
  isReadOnly = false,
  isProcessing = false,
  focusTarget = undefined
} = defineProps<{
  pdfDocument: PDFDocumentProxy
  pageNumber: number
  /** E.g. "iii", see usePdfPageLabels. */
  pageLabel?: string
  /** Of the view, on top of the page's own. */
  rotation?: number
  isCurrent?: boolean
  isReadOnly?: boolean
  isProcessing?: boolean
  /** Focused when shown: the page, or the button of its actions ('page-actions'). */
  focusTarget?: string
}>()

const emit = defineEmits<{
  select: []
  delete: [isKeyboard: boolean]
  move: [targetPageNumber: number, isKeyboard: boolean]
  /** The focus target got the focus. */
  focused: []
}>()

const { $gettext } = useGettext()

// Clicks by Enter or Space have no click count.
function isKeyboardClick(event: MouseEvent) {
  return event.detail === 0
}

const actions = computed(() => [
  {
    id: 'move-page-up',
    icon: 'arrow-up',
    label: $gettext('Move page up'),
    disabled: pageNumber <= 1,
    handler: (isKeyboard: boolean) => emit('move', pageNumber - 1, isKeyboard)
  },
  {
    id: 'move-page-down',
    icon: 'arrow-down',
    label: $gettext('Move page down'),
    disabled: pageNumber >= pdfDocument.numPages,
    handler: (isKeyboard: boolean) => emit('move', pageNumber + 1, isKeyboard)
  },
  {
    id: 'delete-page',
    icon: 'delete-bin',
    label: $gettext('Delete page'),
    disabled: pdfDocument.numPages <= 1,
    handler: (isKeyboard: boolean) => emit('delete', isKeyboard)
  }
])

// Like the thumbnails of the PDF.js viewer.
const label = computed(() => pageLabel ?? String(pageNumber))

const root = useTemplateRef<HTMLLIElement>('root')
const { imageUrl } = usePdfThumbnailImage({
  element: root,
  pdfDocument: () => pdfDocument,
  pageNumber: () => pageNumber,
  rotation: () => rotation,
  cache: inject(pdfThumbnailCacheKey, undefined),
  eventBus: inject(pdfEventBusKey, undefined)
})

const pageButton = useTemplateRef<{ $el: HTMLElement }>('pageButton')

// E.g. the same action again for a page that was just moved, unless it doesn't apply anymore.
// The actions are available once the page operation is done.
async function focusTargetElement(target: string) {
  await until(() => isProcessing).toBe(false)
  await nextTick()
  const action = unref(root)?.querySelector<HTMLButtonElement>(`.pdf-studio-${target}`)
  const element = action && !action.disabled ? action : unref(pageButton)?.$el
  element?.focus({ preventScroll: true })
  emit('focused')
}

onMounted(() => {
  if (focusTarget) {
    focusTargetElement(focusTarget)
  }
})
</script>
