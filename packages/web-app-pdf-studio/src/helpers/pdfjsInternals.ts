import type { AnnotationEditorUIManager } from 'pdfjs-dist'
import type { PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import type { CommentTarget } from './comments'

/**
 * The parts of PDF.js this app needs that its type declarations don't cover. Everything else is
 * declared by pdfjs-dist, so the type check reports what an update changes. The class while
 * drawing, the image reading and the lookup of editable annotations are checked against PDF.js
 * itself by tests/unit/helpers/pdfjsInternals.spec.ts, the private fields (`_uiManager`, the
 * hidden signature editor, `popup`) only by shape. Missing parts end in the behavior without
 * them instead of errors. The class names the app looks for, what PDF.js uses of the managers
 * passed to its viewer (comments, signatures, alt text) and the text ids of usePdfL10n are
 * checked against PDF.js' code (tests/unit/pdfjsSource.ts), so an update reports them as well.
 */

/** PDF.js disables text selection while drawing (`disableUserSelect`), without a getter. */
export function isDrawing(viewer: PDFViewer) {
  return viewer.viewer.classList.contains('noUserSelect')
}

/** A new signature waits for its dialog, PDF.js keeps it hidden and incomplete until then. */
export function isCreatingSignature(viewer: PDFViewer) {
  return !!viewer.viewer.querySelector('.signatureEditor[hidden]')
}

/** The uiManager of an annotation editor, missing for annotations PDF.js can't edit. */
export function getEditorUiManager(editor: object): AnnotationEditorUIManager | undefined {
  return (editor as { _uiManager?: AnnotationEditorUIManager | null })._uiManager ?? undefined
}

/** An image file as PDF.js uses it for images and signatures, null if it can't be read. */
export async function getImageBitmap(
  uiManager: AnnotationEditorUIManager,
  file: File
): Promise<ImageBitmap | null> {
  const imageManager = uiManager.imageManager as {
    getFromFile?: (file: File) => Promise<{ bitmap: ImageBitmap } | null>
  }
  const image = await imageManager?.getFromFile?.(file)
  return image?.bitmap ?? null
}

/** The elements of a page's annotations, once they are rendered. */
function getAnnotationElements(viewer: PDFViewer, pageIndex: number) {
  const pageView = viewer.getPageView(pageIndex) as {
    annotationLayer?: { div?: HTMLElement | null }
  }
  return [
    ...(pageView?.annotationLayer?.div?.querySelectorAll<HTMLElement>('[data-annotation-id]') ?? [])
  ]
}

/** Whether the annotations of a page are rendered, e.g. to wait for them otherwise. */
export function hasRenderedAnnotations(viewer: PDFViewer, pageIndex: number) {
  return getAnnotationElements(viewer, pageIndex).length > 0
}

/**
 * What opens the comment of a saved annotation through the comment manager when clicked, also
 * for annotations PDF.js has no editor for (e.g. sticky notes): the button PDF.js puts after an
 * annotation with a popup object, otherwise the annotation itself (or a part of it) is the
 * trigger.
 */
export function getAnnotationCommentButton(viewer: PDFViewer, pageIndex: number, id: string) {
  const annotation = getAnnotationElements(viewer, pageIndex).find(
    (element) => element.dataset.annotationId === id
  )
  if (!annotation) {
    return null
  }
  const button = annotation.nextElementSibling
  if (button?.classList.contains('annotationCommentButton')) {
    return button as HTMLElement
  }
  if (annotation.classList.contains('popupTriggerArea')) {
    return annotation
  }
  return annotation.querySelector<HTMLElement>('.popupTriggerArea')
}

/** The comment popup PDF.js passes to the comment manager for a saved annotation. */
export function getAnnotationPopup(
  viewer: PDFViewer,
  pageIndex: number,
  id: string
): CommentTarget | undefined {
  const pageView = viewer.getPageView(pageIndex) as {
    annotationLayer?: { annotationLayer?: { getEditableAnnotation?: (id: string) => unknown } }
  }
  const annotation = pageView?.annotationLayer?.annotationLayer?.getEditableAnnotation?.(id) as {
    popup?: CommentTarget
  }
  return annotation?.popup
}
