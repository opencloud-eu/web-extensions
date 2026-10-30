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
      <oc-list :aria-label="group.label">
        <pdf-menu-item
          v-for="item in group.items"
          :key="item.id"
          :class="group.optionClass ?? `pdf-studio-more-${item.id}`"
          :data-mode="item.mode"
          :label="item.label"
          :icon="item.icon"
          :fill-type="item.fillType"
          :is-active="item.isActive"
          :disabled="item.isDisabled"
          @click="item.handler"
        />
      </oc-list>
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
import { ScrollMode, SpreadMode } from 'pdfjs-dist/web/pdf_viewer.mjs'
import PdfToolbarButton from './PdfToolbarButton.vue'
import PdfMenuItem from './PdfMenuItem.vue'

const {
  inMenu,
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
  /** What the toolbar has no room for, see PdfToolbar. */
  inMenu: { print: boolean; undo: boolean; zoom: boolean }
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

// Phones (touch) get no presentation mode and no hand tool.
const { isMobile } = useIsMobile()

type MenuItem = {
  id: string
  icon: string
  fillType?: 'line' | 'none'
  label: string
  isActive?: boolean
  isDisabled?: boolean
  handler: () => void
  /** Of a view option, e.g. the scroll mode. */
  mode?: number
}

type MenuGroup = {
  id: string
  items: MenuItem[]
  label?: string
  /** The class of view options instead of the one from the id, e.g. for tests. */
  optionClass?: string
}

function onlyIf(condition: boolean, ...items: MenuItem[]) {
  return condition ? items : []
}

/** A view option, e.g. a scroll mode: the current one is marked, choosing one sets it. */
function viewOptions(
  options: { mode: number; icon: string; label: string }[],
  current: number,
  select: (mode: number) => void
): MenuItem[] {
  return options.map(({ mode, icon, label }) => ({
    id: String(mode),
    mode,
    icon,
    label,
    isActive: mode === current,
    handler: () => select(mode)
  }))
}

// Like the secondary toolbar of the PDF.js viewer, with the same choices and names.
const groups = computed<MenuGroup[]>(() =>
  [
    {
      id: 'output',
      items: [
        ...onlyIf(inMenu.print, {
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
          canAnnotate && inMenu.undo,
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
          inMenu.zoom,
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
          icon: 'clockwise',
          label: $gettext('Rotate clockwise'),
          handler: () => emit('rotate', 90)
        },
        {
          id: 'rotate-ccw',
          icon: 'anticlockwise',
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
    },
    {
      id: 'scroll',
      label: $gettext('Scrolling'),
      optionClass: 'pdf-studio-scroll-option',
      items: viewOptions(
        [
          { mode: ScrollMode.PAGE, icon: 'file-paper', label: $gettext('Page scrolling') },
          {
            mode: ScrollMode.VERTICAL,
            icon: 'arrow-up-down',
            label: $gettext('Vertical scrolling')
          },
          {
            mode: ScrollMode.HORIZONTAL,
            icon: 'arrow-left-right',
            label: $gettext('Horizontal scrolling')
          },
          { mode: ScrollMode.WRAPPED, icon: 'layout-grid', label: $gettext('Wrapped scrolling') }
        ],
        scrollMode,
        (mode) => emit('setScrollMode', mode)
      )
    },
    {
      id: 'spread',
      label: $gettext('Pages side by side'),
      optionClass: 'pdf-studio-spread-option',
      items: viewOptions(
        [
          { mode: SpreadMode.NONE, icon: 'file', label: $gettext('No spreads') },
          { mode: SpreadMode.ODD, icon: 'book-open', label: $gettext('Odd spreads') },
          { mode: SpreadMode.EVEN, icon: 'pages', label: $gettext('Even spreads') }
        ],
        spreadMode,
        (mode) => emit('setSpreadMode', mode)
      )
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
