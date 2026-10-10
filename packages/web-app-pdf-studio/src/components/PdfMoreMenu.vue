<template>
  <pdf-toolbar-button
    id="pdf-studio-more-toggle"
    ref="toggle"
    :label="$gettext('More actions')"
    icon="more"
    class="pdf-studio-more"
  />
  <oc-drop
    drop-id="pdf-studio-more-drop"
    toggle="#pdf-studio-more-toggle"
    :title="$gettext('More actions')"
    mode="click"
    padding-size="small"
    class="ext:w-auto ext:min-w-56"
    close-on-click
  >
    <div
      v-for="(group, index) in groups"
      :key="group.id"
      :class="{ 'ext:mt-2 ext:border-t ext:border-role-border ext:pt-2': index > 0 }"
    >
      <oc-list>
        <pdf-menu-item
          v-for="item in group.items"
          :key="item.id"
          :class="`pdf-studio-more-${item.id}`"
          :label="item.label"
          :icon="item.icon"
          :fill-type="item.fillType"
          :is-active="item.isActive"
          :disabled="item.isDisabled"
          @click="item.handler"
        />
      </oc-list>
    </div>
    <div class="ext:mt-2 ext:border-t ext:border-role-border ext:pt-2">
      <pdf-view-options
        :scroll-mode="scrollMode"
        :spread-mode="spreadMode"
        @set-scroll-mode="emit('setScrollMode', $event)"
        @set-spread-mode="emit('setSpreadMode', $event)"
      />
    </div>
    <oc-list class="ext:mt-2 ext:border-t ext:border-role-border ext:pt-2">
      <pdf-menu-item
        class="pdf-studio-more-properties"
        :label="$gettext('Document properties')"
        icon="file-info"
        @click="showProperties"
      />
    </oc-list>
  </oc-drop>
</template>

<script setup lang="ts">
import { computed, unref, useTemplateRef } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useIsMobile } from '@opencloud-eu/design-system/composables'
import PdfToolbarButton from './PdfToolbarButton.vue'
import PdfMenuItem from './PdfMenuItem.vue'
import PdfViewOptions from './PdfViewOptions.vue'

const {
  scrollMode,
  spreadMode,
  canUndo = false,
  canRedo = false,
  canAnnotate = false,
  canPresent = false,
  isPrinting = false,
  isHandToolActive = false,
  isToolActive = false,
  canZoomIn = true,
  canZoomOut = true,
  isFirstPage = false,
  isLastPage = false
} = defineProps<{
  scrollMode: number
  spreadMode: number
  canUndo?: boolean
  canRedo?: boolean
  /** Undo and redo only where the document can be edited. */
  canAnnotate?: boolean
  /** The browser allows full screen. */
  canPresent?: boolean
  isPrinting?: boolean
  isHandToolActive?: boolean
  /** An annotation tool is active, which pauses text selection and hand tool. */
  isToolActive?: boolean
  /** Not beyond the zoom limits. */
  canZoomIn?: boolean
  canZoomOut?: boolean
  isFirstPage?: boolean
  isLastPage?: boolean
}>()

const emit = defineEmits<{
  undo: []
  redo: []
  zoomIn: []
  zoomOut: []
  print: []
  present: []
  firstPage: []
  lastPage: []
  rotate: [delta: 90 | -90]
  setHandTool: [isChosen: boolean]
  setScrollMode: [mode: number]
  setSpreadMode: [mode: number]
  showProperties: []
}>()

const { $gettext } = useGettext()

// What doesn't fit into the toolbar is offered here, see PdfToolbar. Phones (touch) get no
// presentation mode and no hand tool.
const { isMobile, isTablet } = useIsMobile()

type MenuItem = {
  id: string
  icon: string
  fillType?: 'line' | 'none'
  label: string
  isActive?: boolean
  isDisabled?: boolean
  handler: () => void
}

function onlyIf(condition: boolean, ...items: MenuItem[]) {
  return condition ? items : []
}

// Like the secondary toolbar of the PDF.js viewer.
const groups = computed(() =>
  [
    {
      id: 'output',
      items: [
        ...onlyIf(unref(isTablet), {
          id: 'print',
          icon: 'printer',
          label: $gettext('Print'),
          isDisabled: isPrinting,
          handler: () => emit('print')
        }),
        ...onlyIf(canPresent && !unref(isMobile), {
          id: 'present',
          icon: 'presentation',
          label: $gettext('Presentation mode'),
          handler: () => emit('present')
        })
      ]
    },
    {
      id: 'edit',
      items: [
        ...onlyIf(
          canAnnotate && unref(isTablet),
          {
            id: 'undo',
            icon: 'arrow-go-back',
            label: $gettext('Undo'),
            isDisabled: !canUndo,
            handler: () => emit('undo')
          },
          {
            id: 'redo',
            icon: 'arrow-go-forward',
            label: $gettext('Redo'),
            isDisabled: !canRedo,
            handler: () => emit('redo')
          }
        )
      ]
    },
    {
      id: 'zoom',
      items: [
        ...onlyIf(
          unref(isMobile),
          {
            id: 'zoom-in',
            icon: 'zoom-in',
            label: $gettext('Zoom in'),
            isDisabled: !canZoomIn,
            handler: () => emit('zoomIn')
          },
          {
            id: 'zoom-out',
            icon: 'zoom-out',
            label: $gettext('Zoom out'),
            isDisabled: !canZoomOut,
            handler: () => emit('zoomOut')
          }
        )
      ]
    },
    {
      id: 'navigation',
      items: [
        {
          id: 'first-page',
          icon: 'skip-up',
          label: $gettext('Go to first page'),
          isDisabled: isFirstPage,
          handler: () => emit('firstPage')
        },
        {
          id: 'last-page',
          icon: 'skip-down',
          label: $gettext('Go to last page'),
          isDisabled: isLastPage,
          handler: () => emit('lastPage')
        }
      ]
    },
    {
      id: 'rotate',
      items: [
        {
          id: 'rotate-cw',
          icon: 'reset-right',
          label: $gettext('Rotate clockwise'),
          handler: () => emit('rotate', 90)
        },
        {
          id: 'rotate-ccw',
          icon: 'reset-left',
          label: $gettext('Rotate counterclockwise'),
          handler: () => emit('rotate', -90)
        }
      ]
    },
    {
      id: 'cursor',
      items: [
        ...onlyIf(
          !unref(isMobile),
          {
            id: 'text-selection',
            icon: 'cursor',
            label: $gettext('Text selection tool'),
            isActive: !isHandToolActive,
            // Like in the PDF.js viewer: both pause while annotating.
            isDisabled: isToolActive,
            handler: () => emit('setHandTool', false)
          },
          {
            id: 'hand-tool',
            icon: 'hand',
            fillType: 'none',
            label: $gettext('Hand tool'),
            isActive: isHandToolActive,
            isDisabled: isToolActive,
            handler: () => emit('setHandTool', true)
          }
        )
      ]
    }
  ].filter(({ items }) => items.length)
)

const toggle = useTemplateRef<{ $el: HTMLElement }>('toggle')

// The dialog returns the focus to where it was when it opened, the menu is gone by then.
function showProperties() {
  unref(toggle)?.$el.focus()
  emit('showProperties')
}
</script>
