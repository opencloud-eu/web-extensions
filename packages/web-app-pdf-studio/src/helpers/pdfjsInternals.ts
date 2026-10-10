import type { AnnotationEditorUIManager } from 'pdfjs-dist'
import type { PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import type { CommentTarget } from './comments'

/**
 * The parts of PDF.js this app needs that its type declarations don't cover. Everything else is
 * declared by pdfjs-dist, so the type check reports what an update changes. The class while
 * drawing, the image reading and the lookup of editable annotations are checked against PDF.js
 * itself by tests/unit/helpers/pdfjsInternals.spec.ts, the private fields (`_uiManager`, the
 * hidden signature editor, `popup`) only by shape. Missing parts end in the behavior without
 * them instead of errors.
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
