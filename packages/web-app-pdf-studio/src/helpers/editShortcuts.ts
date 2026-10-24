import type { AnnotationEditorUIManager } from 'pdfjs-dist'

// PDF.js doesn't export the type of its editors.
type AnnotationEditor = Parameters<AnnotationEditorUIManager['setSelected']>[0]

/**
 * Keeps PDF.js' editing shortcuts (e.g. Backspace deletes the selected annotation) out of a
 * dialog about `editor`. Returns the function to resume them, which only acts once.
 */
export function pauseEditShortcuts(
  uiManager: AnnotationEditorUIManager,
  editor: Pick<AnnotationEditor, 'isSelected'>
) {
  uiManager.removeEditListeners()
  let isResumed = false
  return () => {
    if (isResumed) {
      return
    }
    isResumed = true
    uiManager.addEditListeners()
    // PDF.js reports "nothing selected" when resuming, even if the annotation still is.
    if (editor.isSelected) {
      uiManager.setSelected(editor as AnnotationEditor)
    }
  }
}
