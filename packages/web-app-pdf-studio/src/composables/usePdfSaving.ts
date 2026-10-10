import { nextTick, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useGettext } from 'vue3-gettext'
import { useMessages } from '@opencloud-eu/web-pkg'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { EventBus } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { usePdfChangeTracking } from './usePdfChangeTracking'
import type { EditingStates } from './usePdfEditing'

/**
 * Saving with AppWrapper: changes are reported as new content (see usePdfChangeTracking), and
 * every save gets the latest state, also from AppWrapper's own save button and autosave.
 */
export function usePdfSaving({
  pdfDocument,
  root,
  eventBus,
  isEnabled,
  isReadOnly,
  isDirty,
  content,
  etag,
  editing,
  scripting,
  onChange,
  onSave
}: {
  pdfDocument: MaybeRefOrGetter<PDFDocumentProxy | undefined>
  root: MaybeRefOrGetter<HTMLElement | null>
  eventBus: EventBus
  /** E.g. false while pages get rebuilt, they write the changes themselves. */
  isEnabled: MaybeRefOrGetter<boolean>
  isReadOnly: MaybeRefOrGetter<boolean>
  isDirty: MaybeRefOrGetter<boolean>
  content: MaybeRefOrGetter<ArrayBuffer>
  /** Changes with every save. */
  etag: MaybeRefOrGetter<string | undefined>
  editing: {
    editorMode: MaybeRefOrGetter<number>
    editingStates: MaybeRefOrGetter<EditingStates>
    isDrawing: () => boolean
    hasUnfinishedEdits: () => boolean
    finishDrawings: () => void
    /** Returns a function to go on typing where the text was left. */
    commitEditing: () => () => void
  }
  /** Form scripts get to know about saves, like in the PDF.js viewer. */
  scripting: { dispatchWillSave: () => Promise<void>; dispatchDidSave: () => Promise<void> }
  onChange: (content: ArrayBuffer) => void
  onSave: () => void
}) {
  const { $gettext } = useGettext()
  const { showErrorMessage } = useMessages()

  function showSaveError(error: Error) {
    console.error(error)
    showErrorMessage({ title: $gettext('Saving failed'), errors: [error] })
  }

  const tracking = usePdfChangeTracking({
    pdfDocument,
    root,
    isEnabled: () => !toValue(isReadOnly) && toValue(isEnabled),
    content,
    isDirty,
    isDrawing: editing.isDrawing,
    hasUnfinishedEdits: editing.hasUnfinishedEdits,
    commitEditing: editing.commitEditing,
    onChange,
    onError: showSaveError
  })

  // Annotations get committed by PDF.js asynchronously, e.g. when leaving a tool.
  watch(() => [toValue(editing.editorMode), toValue(editing.editingStates)], tracking.scheduleCheck)
  // Form scripts update fields asynchronously, e.g. sums.
  eventBus.on('updatefromsandbox', tracking.scheduleCheck)

  // AppWrapper's own saves (its button, autosave) may take the copy that marked the file as
  // changed instead of the content that follows it.
  watch(
    () => toValue(etag),
    async () => {
      if (!tracking.takeChangeMarker()) {
        await nextTick()
        if (!toValue(isDirty)) {
          tracking.markSaved()
        }
        return
      }
      // Drawings so far get saved too, text being typed stays in the box.
      editing.finishDrawings()
      try {
        await tracking.flush()
      } catch (e) {
        // The file stays marked as changed, saving it again would save the same.
        showSaveError(e as Error)
        return
      }
      await nextTick()
      if (toValue(isDirty)) {
        onSave()
        return
      }
      tracking.markSaved()
      // Still being typed: the file stays marked as changed, without saving the same again.
      if (editing.hasUnfinishedEdits()) {
        tracking.markChanged()
      }
    }
  )

  async function save({ goOnTyping = false } = {}) {
    // Text being typed or a drawing is only part of the document once finished.
    const resumeTyping = editing.commitEditing()
    try {
      // Also lets the scripts finish what committing the field started, e.g. formatting it.
      await scripting.dispatchWillSave()
      // The sandbox runs each event in a later task (see createScripting), its results belong to
      // this save.
      await new Promise((resolve) => setTimeout(resolve))
      const hasNewContent = await tracking.flush()
      // Everything is written now, no copy to look after when the save is done.
      tracking.takeChangeMarker()
      if (hasNewContent || toValue(isDirty)) {
        onSave()
        scripting.dispatchDidSave()
      }
    } catch (e) {
      showSaveError(e as Error)
    } finally {
      // Saving with the keyboard while writing is a habit, the writing goes on.
      if (goOnTyping) {
        resumeTyping()
      }
    }
  }

  // AppWrapper's save button would save the content before the latest changes are written.
  // Like Ctrl+S it waits for them, so one click is one save of the latest state.
  useEventListener(
    window,
    'click',
    (event: MouseEvent) => {
      if (toValue(isReadOnly) || !(event.target as Element).closest?.('#app-save-action')) {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      save()
    },
    { capture: true }
  )

  return {
    scheduleCheck: tracking.scheduleCheck,
    flush: tracking.flush,
    reset: tracking.reset,
    save
  }
}
