import { onBeforeUnmount, onMounted, toValue, unref, type MaybeRefOrGetter } from 'vue'
import { useEventListener } from '@vueuse/core'
import { TouchManager } from 'pdfjs-dist'
import { useIsMobile } from '@opencloud-eu/design-system/composables'
import { MAX_SCALE, MIN_SCALE } from '../helpers/pdfjs'

export type PdfShortcutActions = {
  save: () => void | Promise<void>
  print: () => void | Promise<void>
  /** Presentation mode, Ctrl+Alt+P. */
  present: () => void
  /** The hand tool (true) or text selection (false), `h` and `s`. */
  setHandTool: (isChosen: boolean) => void
  /** F4 */
  toggleSidebar: () => void
  openFindBar: () => void
  closeFindBar: () => void
  /** Ctrl+Alt+G */
  selectPageNumber: () => void
  /** The next or previous match, like Ctrl+G in browsers. */
  findAgain: (findPrevious: boolean) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  /** Zooms around a point on the screen, by zoom steps or by a factor, moving the pages along. */
  zoomAt: (
    change: { steps?: number; scaleFactor?: number },
    origin: [number, number],
    pan?: [number, number]
  ) => void
  panBy: (dx: number, dy: number) => void
  nextPage: () => void
  previousPage: () => void
  firstPage: () => void
  lastPage: () => void
  rotate: (delta: 90 | -90) => void
  undo: () => void
  redo: () => void
  /** Escape in the pages: deselecting, leaving the tool. */
  handleEscape: (event: KeyboardEvent) => void
}

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

// The keys that turn pages with "Page fit", whether they go back.
const PAGE_FIT_KEYS: Record<string, boolean> = {
  PageUp: true,
  ArrowUp: true,
  Backspace: true,
  PageDown: false,
  ArrowDown: false,
  ' ': false
}

// Keys that scroll the pages, the PDF.js viewer moves the focus to them for these.
const SCROLL_KEYS = [
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'ArrowLeft',
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  ' '
]

/** Keyboard shortcuts, Ctrl + mouse wheel zoom and pinching, following the PDF.js viewer. */
export function usePdfShortcuts({
  root,
  container,
  isReadOnly,
  isPresenting,
  isToolActive,
  editingStates,
  isPageFit,
  isFindBarOpen,
  scale,
  actions
}: {
  root: MaybeRefOrGetter<HTMLElement | null>
  container: MaybeRefOrGetter<HTMLElement | null>
  isReadOnly: MaybeRefOrGetter<boolean>
  /** The presentation mode turns the pages itself, no zooming, no editing. */
  isPresenting: MaybeRefOrGetter<boolean>
  /** PDF.js handles undo and redo of its edits itself while a tool is active. */
  isToolActive: MaybeRefOrGetter<boolean>
  /** Whether PDF.js has edits to undo or redo, without the page operations. */
  editingStates: MaybeRefOrGetter<{ hasSomethingToUndo: boolean; hasSomethingToRedo: boolean }>
  isPageFit: MaybeRefOrGetter<boolean>
  isFindBarOpen: MaybeRefOrGetter<boolean>
  /** The current zoom, e.g. 1.25 for 125%. */
  scale: MaybeRefOrGetter<number>
  actions: PdfShortcutActions
}) {
  const { isMobile } = useIsMobile()

  function isInModal(event: KeyboardEvent) {
    return !!(event.target as Element).closest?.('.oc-modal')
  }

  // Only react to keys meant for the app, not e.g. for an open modal.
  function isForApp(event: KeyboardEvent) {
    const target = event.target as Node | null
    return target === document.body || !!toValue(root)?.contains(target)
  }

  function handleModifierShortcut(event: KeyboardEvent) {
    const key = event.key.toLowerCase()
    if (key === 's' && !toValue(isReadOnly)) {
      // Runs before AppWrapper's own Ctrl+S binding, so the latest edits get written into
      // the content before it is saved.
      event.preventDefault()
      event.stopImmediatePropagation()
      actions.save()
      return
    }
    // The browser would print the OpenCloud page around the document, e.g. with the focus in
    // its search, but not from a dialog.
    if (key === 'p' && !isInModal(event)) {
      event.preventDefault()
      actions.print()
      return
    }
    if (!isForApp(event)) {
      return
    }
    if ((key === 'z' || key === 'y') && !isEditable(event.target) && !toValue(isPresenting)) {
      handleUndoKey(event, key === 'y' || event.shiftKey)
      return
    }
    if (key === 'f') {
      event.preventDefault()
      actions.openFindBar()
      return
    }
    if (key === 'g') {
      event.preventDefault()
      actions.findAgain(event.shiftKey)
      return
    }
    // First and last page like in the PDF.js viewer, not while typing.
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !isEditable(event.target)) {
      event.preventDefault()
      if (event.key === 'ArrowUp') {
        actions.firstPage()
      } else {
        actions.lastPage()
      }
      focusPages(event)
      return
    }
    const zoomAction = {
      '+': actions.zoomIn,
      '=': actions.zoomIn,
      '-': actions.zoomOut,
      '0': actions.resetZoom
    }[key]
    if (zoomAction) {
      // Zooms the document instead of the whole browser page.
      event.preventDefault()
      zoom(zoomAction)
    }
  }

  // While a tool is active PDF.js undoes its own edits, the page operations only once it has
  // none left, like the undo and redo buttons.
  function handleUndoKey(event: KeyboardEvent, isRedo: boolean) {
    const { hasSomethingToUndo, hasSomethingToRedo } = toValue(editingStates)
    if (toValue(isToolActive) && (isRedo ? hasSomethingToRedo : hasSomethingToUndo)) {
      return
    }
    event.preventDefault()
    if (isRedo) {
      actions.redo()
      return
    }
    actions.undo()
  }

  // The presentation mode fits the pages itself, like in the PDF.js viewer.
  function zoom(zoomAction: () => void) {
    if (!toValue(isPresenting)) {
      zoomAction()
    }
  }

  // The browser scrolls whatever has the focus, e.g. the thumbnails after clicking one or a
  // toolbar button. The pages get the focus first, so they scroll instead. Not from menus,
  // which move through their items with the arrow keys.
  function focusPages(event: KeyboardEvent) {
    const target = event.target as Element
    const viewerContainer = toValue(container)
    if (
      !viewerContainer ||
      toValue(isPresenting) ||
      viewerContainer.contains(target) ||
      target.closest?.('.oc-drop')
    ) {
      return
    }
    viewerContainer.focus({ preventScroll: true })
  }

  // Without a horizontal scrollbar left and right turn pages. Not for annotations, which move
  // with them.
  function handleArrowKey(event: KeyboardEvent) {
    const viewerContainer = toValue(container)
    const isOnAnnotation = !!(event.target as Element).closest?.(
      '.annotationEditorLayer, .annotationLayer'
    )
    if (
      !viewerContainer ||
      isOnAnnotation ||
      viewerContainer.scrollWidth > viewerContainer.clientWidth
    ) {
      return
    }
    event.preventDefault()
    if (event.key === 'ArrowRight') {
      actions.nextPage()
      return
    }
    actions.previousPage()
  }

  function handleKeyShortcut(event: KeyboardEvent) {
    // Space presses a focused button, like in the PDF.js viewer.
    const isButtonPress = event.key === ' ' && event.target instanceof HTMLButtonElement
    if (!isForApp(event) || isEditable(event.target) || isButtonPress) {
      return
    }
    if (SCROLL_KEYS.includes(event.key)) {
      focusPages(event)
    }
    // With "Page fit" a page is a screen, so these keys turn pages.
    if (toValue(isPageFit) && event.key in PAGE_FIT_KEYS) {
      event.preventDefault()
      const isBack = PAGE_FIT_KEYS[event.key] || (event.key === ' ' && event.shiftKey)
      if (isBack) {
        actions.previousPage()
        return
      }
      actions.nextPage()
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      handleArrowKey(event)
      return
    }
    const handler = {
      n: actions.nextPage,
      j: actions.nextPage,
      p: actions.previousPage,
      k: actions.previousPage,
      Home: actions.firstPage,
      End: actions.lastPage,
      '+': () => zoom(actions.zoomIn),
      '=': () => zoom(actions.zoomIn),
      '-': () => zoom(actions.zoomOut),
      F4: actions.toggleSidebar,
      r: () => actions.rotate(90),
      R: () => actions.rotate(-90),
      h: () => actions.setHandTool(true),
      s: () => actions.setHandTool(false)
    }[event.key]
    if (handler) {
      event.preventDefault()
      handler()
    }
  }

  // Pinching on a trackpad also arrives as wheel events with the Ctrl key, but without pressing it.
  let isCtrlKeyDown = false

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Control') {
      isCtrlKeyDown = true
    }
    if (event.altKey) {
      // Ctrl+Alt+P (Cmd+Alt+P) and Ctrl+Alt+G. By code, with Alt it types another key.
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || isInModal(event)) {
        return
      }
      if (event.code === 'KeyP') {
        event.preventDefault()
        actions.present()
      } else if (event.code === 'KeyG' && !toValue(isPresenting)) {
        event.preventDefault()
        actions.selectPageNumber()
      }
      return
    }
    if (event.ctrlKey || event.metaKey) {
      // "+" needs Shift on many keyboard layouts, redo is Ctrl+Shift+Z, Ctrl+Shift+G finds back.
      if (!event.shiftKey || ['+', 'z', 'g'].includes(event.key.toLowerCase())) {
        handleModifierShortcut(event)
      }
      return
    }
    handleKeyShortcut(event)
  }

  // Pinching zooms continuously, a mouse wheel in zoom steps. The remainders add up, small
  // movements would be lost otherwise.
  let unusedTicks = 0
  const wheelFactor = { unused: 1 }
  const touchFactor = { unused: 1 }

  function accumulateTicks(ticks: number) {
    if (Math.sign(unusedTicks) === -Math.sign(ticks)) {
      unusedTicks = 0
    }
    unusedTicks += ticks
    const wholeTicks = Math.trunc(unusedTicks)
    unusedTicks -= wholeTicks
    return wholeTicks
  }

  function accumulateFactor(factor: number, remainder: { unused: number }) {
    const previousScale = toValue(scale)
    const target = Math.min(
      Math.max(previousScale * factor * remainder.unused, MIN_SCALE),
      MAX_SCALE
    )
    // PDF.js rounds the zoom to whole percents.
    const newScale = Math.round(target * 100) / 100
    remainder.unused = target / newScale
    return newScale / previousScale
  }

  function onWheel(event: WheelEvent) {
    if (toValue(isPresenting)) {
      return
    }
    const scaleFactor = Math.exp(-event.deltaY / 100)
    const isPinch =
      event.ctrlKey &&
      !isCtrlKeyDown &&
      event.deltaMode === WheelEvent.DOM_DELTA_PIXEL &&
      event.deltaX === 0 &&
      event.deltaZ === 0 &&
      Math.abs(scaleFactor - 1) < 0.05
    if (!isPinch && !event.ctrlKey && !event.metaKey) {
      return
    }
    event.preventDefault()
    const origin: [number, number] = [event.clientX, event.clientY]
    if (isPinch) {
      actions.zoomAt({ scaleFactor: accumulateFactor(scaleFactor, wheelFactor) }, origin)
      return
    }
    // Upwards zooms in.
    const delta = -Math.sign(event.deltaY) * Math.hypot(event.deltaX, event.deltaY)
    const steps =
      event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
        ? accumulateTicks(delta / 30)
        : Math.abs(delta) >= 1
          ? Math.sign(delta)
          : accumulateTicks(delta)
    if (steps) {
      actions.zoomAt({ steps }, origin)
    }
  }

  // Pinching on touch screens zooms the pages instead of the whole browser page.
  const touchAbort = new AbortController()
  onMounted(() => {
    new TouchManager({
      container: toValue(container),
      isPinchingDisabled: () => toValue(isPresenting),
      onPinching: (
        origin: [number, number],
        prevDistance: number,
        distance: number,
        panX: number,
        panY: number
      ) => {
        const scaleFactor = accumulateFactor(distance / prevDistance, touchFactor)
        actions.zoomAt({ scaleFactor }, origin, [panX, panY])
      },
      onPinchEnd: () => {
        touchFactor.unused = 1
      },
      onPanning: actions.panBy,
      signal: touchAbort.signal
    })
  })
  onBeforeUnmount(() => touchAbort.abort())

  function onEscape(event: KeyboardEvent) {
    // Drops are bottom drawers on small screens. Their own Escape handling comes after
    // AppWrapper's, which would close the app.
    const drawer = unref(isMobile) && document.querySelector('.oc-bottom-drawer')
    if (drawer) {
      event.stopPropagation()
      drawer.querySelector<HTMLElement>('.oc-bottom-drawer-close-button')?.click()
      return
    }
    // It ends the full screen, not the app.
    if (toValue(isPresenting)) {
      event.stopPropagation()
      return
    }
    // From anywhere in the app, like in the PDF.js viewer.
    if (toValue(isFindBarOpen)) {
      event.stopPropagation()
      actions.closeFindBar()
      return
    }
    // Read-only, there is nothing to leave or deselect, so AppWrapper closes the app as usual.
    if (toValue(isReadOnly)) {
      return
    }
    actions.handleEscape(event)
  }

  useEventListener(window, 'keydown', onKeydown, { capture: true })
  useEventListener(root, 'keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onEscape(event)
    }
  })
  useEventListener(window, 'keyup', (event: KeyboardEvent) => {
    if (event.key === 'Control') {
      isCtrlKeyDown = false
    }
  })
  // The key may be released while another window has the focus.
  useEventListener(window, 'blur', () => (isCtrlKeyDown = false))
  // Also over the toolbar and the sidebar, the browser would zoom the whole page otherwise.
  useEventListener(root, 'wheel', onWheel, { passive: false })
}
