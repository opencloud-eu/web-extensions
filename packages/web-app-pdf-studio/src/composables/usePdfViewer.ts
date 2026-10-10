import {
  onBeforeUnmount,
  ref,
  shallowRef,
  toValue,
  unref,
  type InjectionKey,
  type MaybeRefOrGetter
} from 'vue'
import { promiseTimeout, useEventListener, useResizeObserver } from '@vueuse/core'
import { AnnotationEditorType, AnnotationMode, type PDFDocumentProxy } from 'pdfjs-dist'
import {
  DownloadManager,
  EventBus,
  LinkTarget,
  PDFFindController,
  PDFLinkService,
  PDFScriptingManager,
  ScrollMode,
  SpreadMode,
  PDFViewer
} from 'pdfjs-dist/web/pdf_viewer.mjs'
import { createScripting, pdfjsAssetUrls } from '../helpers/pdfjs'
import { getAnnotationPopup } from '../helpers/pdfjsInternals'
import { highlightColorsOption } from '../helpers/highlightColors'
import { usePdfEditing } from './usePdfEditing'
import { usePdfL10n } from './usePdfL10n'

const PRESET_SCALE_VALUES = ['auto', 'page-fit', 'page-width']

/** A preset of PDF.js or a zoom factor as string, e.g. '1.25'. */
export type ScaleValue = 'auto' | 'page-actual' | 'page-fit' | 'page-width' | (string & {})

/** The event bus of the viewer, for components that tell PDF.js about things, e.g. thumbnails. */
export const pdfEventBusKey: InjectionKey<EventBus> = Symbol('pdfEventBus')

/** Read by PDFViewer, but missing from its option types. */
type ExtraViewerOptions = {
  l10n: ReturnType<typeof usePdfL10n>['l10n']
  viewerAlert: HTMLElement | null
  altTextManager: object
  signatureManager: object
  commentManager: object
  enableHighlightFloatingButton: boolean
}

export function usePdfViewer({
  container,
  viewerAlert,
  isReadOnly,
  altTextManager,
  signatureManager,
  commentManager
}: {
  container: MaybeRefOrGetter<HTMLDivElement | null>
  /** Where PDF.js announces changes to screen readers, e.g. "Highlight added". */
  viewerAlert: MaybeRefOrGetter<HTMLElement | null>
  isReadOnly: MaybeRefOrGetter<boolean>
  /** Handles PDF.js' "Alt text" button on images, see usePdfAltText. */
  altTextManager: object
  /** Creates signatures for PDF.js' signature editor, see usePdfSignature. */
  signatureManager: object
  /** Shows and edits comments of annotations, see usePdfComments. */
  commentManager: object
}) {
  const eventBus = new EventBus()
  // Downloads files attached to the PDF when clicking them.
  const downloadManager = new DownloadManager()
  const linkService = new PDFLinkService({ eventBus, externalLinkTarget: LinkTarget.BLANK })
  const findController = new PDFFindController({ eventBus, linkService })
  // Runs the JavaScript of forms (calculations, validation, showing/hiding fields) in PDF.js'
  // sandbox. PDF.js only starts it for documents that actually contain scripts.
  const scriptingManager = new PDFScriptingManager({
    eventBus,
    externalServices: { createScripting }
  })
  useEventListener(window, 'updatefromsandbox', ({ detail }: CustomEvent) =>
    eventBus.dispatch('updatefromsandbox', { source: window, detail })
  )

  const { l10n } = usePdfL10n()
  const viewer = shallowRef<PDFViewer>()
  const { reset: resetEditing, ...editing } = usePdfEditing({ eventBus, viewer })

  const pagesCount = ref(0)
  const pageNumber = ref(1)
  const scaleValue = ref<ScaleValue>('auto')
  // The zoom the preset results in, e.g. 1.25 for "Page width".
  const scale = ref(1)
  const scrollMode = ref<number>(ScrollMode.VERTICAL)
  const spreadMode = ref<number>(SpreadMode.NONE)

  const rotation = ref(0)
  // Page to show once the pages of the next document are initialized.
  let initialPageNumber = 1
  // The tool stays active for a rebuilt document, e.g. after undoing a page change.
  let initialEditorMode: number = AnnotationEditorType.NONE

  eventBus.on('pagesinit', () => {
    const pdfViewer = unref(viewer)
    pagesCount.value = pdfViewer.pagesCount
    // PDF.js resets the view for every document, a rebuilt one (e.g. after deleting a page)
    // keeps it.
    pdfViewer.scrollMode = unref(scrollMode)
    pdfViewer.spreadMode = unref(spreadMode)
    pdfViewer.pagesRotation = unref(rotation)
    pdfViewer.currentPageNumber = Math.min(initialPageNumber, pdfViewer.pagesCount)
    pdfViewer.currentScaleValue = unref(scaleValue)
    // A new document starting on page 1 changes no page in PDF.js' eyes, so it doesn't tell.
    pageNumber.value = pdfViewer.currentPageNumber
    // The keyboard scrolls the pages right away.
    if (document.activeElement === document.body) {
      toValue(container)?.focus({ preventScroll: true })
    }
    initialPageNumber = 1
    // PDF.js has no uiManager for read-only files and XFA forms.
    if (initialEditorMode !== AnnotationEditorType.NONE && unref(editing.uiManager)) {
      pdfViewer.annotationEditorMode = { mode: initialEditorMode }
    }
  })
  // Until all pages are loaded, PDF.js gives them the size of the first one, which "auto" etc.
  // used for the page shown. The PDF.js viewer waits for them, here the zoom is applied again.
  eventBus.on('pagesloaded', () => {
    const value = unref(scaleValue)
    if (PRESET_SCALE_VALUES.includes(value)) {
      unref(viewer).currentScaleValue = value
    }
  })
  eventBus.on('pagechanging', ({ pageNumber: page }: { pageNumber: number }) => {
    pageNumber.value = page
  })
  eventBus.on('scalechanging', (evt: { scale: number; presetValue?: string }) => {
    scaleValue.value = evt.presetValue || String(evt.scale)
    scale.value = evt.scale
  })
  eventBus.on(
    'rotationchanging',
    ({ pagesRotation, pageNumber: page }: { pagesRotation: number; pageNumber: number }) => {
      rotation.value = pagesRotation
      // The pages change their size, stay on the same one.
      unref(viewer).currentPageNumber = page
    }
  )
  eventBus.on('scrollmodechanged', ({ mode }: { mode: number }) => {
    scrollMode.value = mode
  })
  eventBus.on('spreadmodechanged', ({ mode }: { mode: number }) => {
    spreadMode.value = mode
  })

  function createViewer() {
    const readOnly = toValue(isReadOnly)
    // As object, PDFViewer's l10n option only takes PDF.js' own class.
    const extraOptions: object = {
      l10n,
      viewerAlert: toValue(viewerAlert),
      altTextManager,
      signatureManager,
      commentManager,
      // Selecting text offers to highlight or comment it, like in Firefox.
      enableHighlightFloatingButton: !readOnly
    } satisfies ExtraViewerOptions
    const pdfViewer = new PDFViewer({
      container: toValue(container),
      eventBus,
      linkService,
      findController,
      scriptingManager,
      downloadManager,
      imageResourcesPath: pdfjsAssetUrls.images,
      // The highlight tool looks up its color names in it, without the option it fails. Same
      // palette as the PDF.js viewer.
      annotationEditorHighlightColors: highlightColorsOption,
      annotationMode: readOnly ? AnnotationMode.ENABLE : AnnotationMode.ENABLE_FORMS,
      annotationEditorMode: readOnly ? AnnotationEditorType.DISABLE : AnnotationEditorType.NONE,
      ...extraOptions
    })
    linkService.setViewer(pdfViewer)
    scriptingManager.setViewer(pdfViewer)
    // PDF.js leaves translating to whoever passes the l10n.
    l10n.translate(toValue(container))
    viewer.value = pdfViewer
  }

  // Keeps "fit" zoom levels fitting when the available space changes (window resize, sidebar
  // toggled).
  useResizeObserver(container, () => {
    const value = unref(scaleValue)
    if (unref(pagesCount) && PRESET_SCALE_VALUES.includes(value)) {
      unref(viewer).currentScaleValue = value
    }
  })

  function setDocument(
    pdfDocument: PDFDocumentProxy,
    { pageNumber: page = 1 }: { pageNumber?: number } = {}
  ) {
    if (!unref(viewer)) {
      createViewer()
    }
    initialPageNumber = page
    initialEditorMode = unref(editing.editorMode)
    resetEditing()
    pagesCount.value = 0
    unref(viewer).setDocument(pdfDocument)
    linkService.setDocument(pdfDocument, null)
  }

  function goToPage(page: number) {
    if (page < 1 || page > unref(pagesCount)) {
      return
    }
    unref(viewer).currentPageNumber = page
  }

  // By spread when pages are side by side.
  function nextPage() {
    unref(viewer)?.nextPage()
  }

  function previousPage() {
    unref(viewer)?.previousPage()
  }

  // The toolbar is usable before a document is loaded (or if loading failed).
  function setScale(value: ScaleValue) {
    const pdfViewer = unref(viewer)
    if (!pdfViewer) {
      return
    }
    pdfViewer.currentScaleValue = value
  }

  function zoomIn() {
    unref(viewer)?.increaseScale()
  }

  function zoomOut() {
    unref(viewer)?.decreaseScale()
  }

  /** Zooms around a point on the screen, e.g. for pinching or Ctrl + mouse wheel. */
  function zoomAt(
    { steps, scaleFactor }: { steps?: number; scaleFactor?: number },
    origin: [number, number],
    pan?: [number, number]
  ) {
    unref(viewer)?.updateScale({ steps, scaleFactor, origin, pan })
  }

  function panBy(dx: number, dy: number) {
    unref(viewer)?.panBy(dx, dy)
  }

  function setScrollMode(mode: number) {
    const pdfViewer = unref(viewer)
    if (!pdfViewer) {
      return
    }
    pdfViewer.scrollMode = mode
  }

  function setSpreadMode(mode: number) {
    const pdfViewer = unref(viewer)
    if (!pdfViewer) {
      return
    }
    pdfViewer.spreadMode = mode
  }

  function rotate(delta: 90 | -90) {
    const pdfViewer = unref(viewer)
    if (!pdfViewer) {
      return
    }
    pdfViewer.pagesRotation = (pdfViewer.pagesRotation + delta + 360) % 360
  }

  /**
   * The comment of a saved annotation, as PDF.js passes it to the comment manager. Available
   * once the annotations of its page are rendered, e.g. after scrolling to it.
   */
  async function getAnnotationComment(pageIndex: number, id: string) {
    function findComment() {
      return unref(viewer) && getAnnotationPopup(unref(viewer), pageIndex, id)
    }
    if (!findComment()) {
      const rendered = new AbortController()
      await Promise.race([
        promiseTimeout(3000),
        new Promise<void>((resolve) =>
          eventBus.on(
            'annotationlayerrendered',
            ({ pageNumber: page }: { pageNumber: number }) => page === pageIndex + 1 && resolve(),
            { signal: rendered.signal }
          )
        )
      ])
      rendered.abort()
    }
    return findComment() ?? null
  }

  onBeforeUnmount(() => {
    unref(viewer)?.setDocument(null)
    linkService.setDocument(null)
  })

  return {
    ...editing,
    viewer,
    eventBus,
    linkService,
    downloadManager,
    scriptingManager,
    pagesCount,
    pageNumber,
    scaleValue,
    scale,
    rotation,
    scrollMode,
    spreadMode,
    zoomAt,
    panBy,
    setScrollMode,
    setSpreadMode,
    setDocument,
    goToPage,
    nextPage,
    previousPage,
    setScale,
    zoomIn,
    zoomOut,
    rotate,
    getAnnotationComment
  }
}
