import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { useModals } from '@opencloud-eu/web-pkg'
import { loadPdfDocument, type PasswordRequest } from '../helpers/pdfjs'

export function usePdfDocument({
  onLoaded
}: {
  /** `pageNumber` is the page to show, as passed to `load()`. */
  onLoaded: (doc: PDFDocumentProxy, options: { pageNumber: number }) => void
}) {
  const { $gettext } = useGettext()
  const { dispatchModal, removeModal } = useModals()

  const pdfDocument = shallowRef<PDFDocumentProxy>()
  const isLoading = ref(false)
  const loadError = ref<Error>()
  const isPasswordCancelled = ref(false)
  // Changes with every loaded document, so per-document UI like thumbnails can start fresh.
  const documentKey = ref(0)
  let currentTask: PDFDocumentLoadingTask | undefined
  let pendingTask: PDFDocumentLoadingTask | undefined
  // The password that unlocked the document. Documents rebuilt from it (e.g. after deleting
  // a page) are encrypted the same way, so users don't have to enter it again. Memory only.
  let password: string | undefined
  let submittedPassword: string | undefined
  let passwordModalId: string | undefined
  // E.g. a page operation finishing after the app was closed must not start a new worker.
  let isUnmounted = false

  function askForPassword({ isRetry, submit, cancel }: PasswordRequest) {
    passwordModalId = dispatchModal({
      elementClass: 'pdf-studio-password-modal',
      title: $gettext('Password required'),
      // Not as input error, the modal would keep the confirm button disabled until typing.
      message: isRetry
        ? $gettext('Invalid password. Please try again.')
        : $gettext('This PDF file is protected. Enter the password to open it.'),
      confirmText: $gettext('Open'),
      hasInput: true,
      inputType: 'password',
      inputLabel: $gettext('Password'),
      onConfirm: (value: string) => {
        passwordModalId = undefined
        submittedPassword = value
        submit(value)
      },
      onCancel: () => {
        passwordModalId = undefined
        cancel()
        isPasswordCancelled.value = true
      }
    }).id
  }

  async function load(data: ArrayBuffer, { pageNumber = 1 }: { pageNumber?: number } = {}) {
    if (isUnmounted) {
      return
    }
    pendingTask?.destroy()
    submittedPassword = undefined
    // A copy, AppWrapper keeps the original as the content of the file.
    const task = (pendingTask = loadPdfDocument(data.slice(0), {
      password,
      onPasswordRequest: askForPassword
    }))
    isLoading.value = true
    loadError.value = undefined
    isPasswordCancelled.value = false

    try {
      const doc = await task.promise
      if (task !== pendingTask) {
        return
      }
      const previousTask = currentTask
      currentTask = task
      password = submittedPassword ?? password
      pdfDocument.value = doc
      documentKey.value++
      onLoaded(doc, { pageNumber })
      // Only now that the viewer shows the new document the old one can go.
      previousTask?.destroy()
    } catch (e) {
      // Destroying a task (newer load, cancelled password prompt) rejects it as well.
      if (task === pendingTask && !task.destroyed) {
        // PDF.js' exceptions have no stack, the console would only show their class name.
        const error = e as Error
        console.error(`${error.name}: ${error.message}`)
        loadError.value = error
      }
    } finally {
      if (task === pendingTask) {
        pendingTask = undefined
        isLoading.value = false
      }
    }
  }

  onBeforeUnmount(() => {
    isUnmounted = true
    if (passwordModalId) {
      removeModal(passwordModalId)
    }
    pendingTask?.destroy()
    currentTask?.destroy()
  })

  return {
    pdfDocument,
    isLoading,
    loadError,
    isPasswordCancelled,
    documentKey,
    load,
    getPassword: () => password
  }
}
