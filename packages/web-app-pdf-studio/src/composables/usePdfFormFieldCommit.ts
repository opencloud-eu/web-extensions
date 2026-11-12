import { useEventListener } from '@vueuse/core'
import type { EventBus } from 'pdfjs-dist/web/pdf_viewer.mjs'

/**
 * Commits a form field for saving while it keeps the focus. PDF.js lets the form scripts commit
 * (format, calculate) a text field once it loses the focus, which changes the storage, so a save
 * before that would miss it. Also passes the updates of the scripts on to PDF.js, see
 * filterSandboxUpdate().
 */
export function usePdfFormFieldCommit({ eventBus }: { eventBus: EventBus }) {
  // Typed into since it was committed, PDF.js commits unchanged fields neither.
  let typedField: EventTarget | undefined
  // Committed for saving while it keeps the focus, see filterSandboxUpdate().
  let committedField: { id: string; element: EventTarget } | undefined
  useEventListener(document, 'input', (event: Event) => (typedField = event.target), {
    capture: true
  })
  useEventListener(document, 'focusout', () => (committedField = undefined), { capture: true })

  /** Committed before saving, the blur afterwards changes nothing. */
  function commitFormField() {
    const field = document.activeElement
    if (
      field !== typedField ||
      !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) ||
      !['text', 'password', 'textarea'].includes(field.type) ||
      !field.closest('.annotationLayer')
    ) {
      return
    }
    typedField = undefined
    committedField = { id: field.dataset.elementId, element: field }
    // The same event as PDF.js sends on blur.
    eventBus.dispatch('dispatcheventinsandbox', {
      source: null,
      detail: {
        id: field.dataset.elementId,
        name: 'Keystroke',
        value: field.value,
        willCommit: true,
        commitKey: 1,
        selStart: field.selectionStart,
        selEnd: field.selectionEnd
      }
    })
  }

  /**
   * The scripts answer a commit with the value of the field, which PDF.js writes into it even
   * while it has the focus. Typed into since it was committed for saving, what was typed would
   * be lost, so the value is left out then: the field has it, and the scripts get it with the
   * next commit.
   */
  function filterSandboxUpdate<T extends { id?: string; value?: unknown }>(detail: T): T {
    if (
      committedField &&
      detail.id === committedField.id &&
      typedField === committedField.element &&
      'value' in detail
    ) {
      const filtered = { ...detail }
      delete filtered.value
      return filtered
    }
    return detail
  }

  // The sandbox reports on window, the PDF.js viewer passes it on to its event bus like this.
  useEventListener(window, 'updatefromsandbox', ({ detail }: CustomEvent) =>
    eventBus.dispatch('updatefromsandbox', { source: window, detail: filterSandboxUpdate(detail) })
  )

  return { commitFormField }
}
