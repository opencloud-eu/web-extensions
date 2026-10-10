import { getDocument, GlobalWorkerOptions, PasswordResponses } from 'pdfjs-dist'
import type { PDFDocumentLoadingTask } from 'pdfjs-dist'

// `new URL(..., import.meta.url)` resolves against the served URL of this chunk
// (`<oc-root>/js/<chunk>.mjs`), so the assets copied by vite.config.ts are found
// regardless of the path OpenCloud is mounted under.
const assetBaseUrl = new URL(/* @vite-ignore */ '../pdfjs/', import.meta.url).href

// The zoom limits of PDF.js, which doesn't export them.
export const MIN_SCALE = 0.1
export const MAX_SCALE = 25

export const pdfjsAssetUrls = {
  worker: `${assetBaseUrl}pdf.worker.min.mjs`,
  // Not the minified one: its short global names clash with variables of form scripts
  // (e.g. `var f`), the PDF.js viewer uses this one as well.
  sandbox: `${assetBaseUrl}pdf.sandbox.mjs`,
  cMaps: `${assetBaseUrl}cmaps/`,
  standardFonts: `${assetBaseUrl}standard_fonts/`,
  iccs: `${assetBaseUrl}iccs/`,
  wasm: `${assetBaseUrl}wasm/`,
  images: `${assetBaseUrl}images/`
}

type Sandbox = {
  create(data: unknown): void
  dispatchEvent(event: unknown): void
  nukeSandbox(): void
}

/**
 * The sandbox for form scripts, same as PDF.js' default. PDF.js forwards the sandbox' events
 * from a window listener it never removes when it creates the default itself, which would keep
 * every opened document in memory.
 */
export function createScripting() {
  const sandbox: Promise<Sandbox | null> = import(/* @vite-ignore */ pdfjsAssetUrls.sandbox)
    .then(({ QuickJSSandbox }): Promise<Sandbox> => QuickJSSandbox(pdfjsAssetUrls.wasm))
    .catch((error): null => {
      // The document still works, just without its scripts.
      console.warn('PDF form scripts are not available, e.g. the CSP forbids WebAssembly', error)
      return null
    })
  return {
    async createSandbox(data: unknown) {
      ;(await sandbox)?.create(data)
    },
    async dispatchEventInSandbox(event: unknown) {
      const instance = await sandbox
      setTimeout(() => instance?.dispatchEvent(event))
    },
    async destroySandbox() {
      ;(await sandbox)?.nukeSandbox()
    }
  }
}

export type PasswordRequest = {
  /** True if a previously entered password was wrong. */
  isRetry: boolean
  submit: (password: string) => void
  cancel: () => void
}

/** `data` is transferred to PDF.js' worker, which detaches it. */
export function loadPdfDocument(
  data: ArrayBuffer,
  {
    onPasswordRequest,
    password
  }: {
    onPasswordRequest?: (request: PasswordRequest) => void
    /** Tried first, PDF.js only asks via `onPasswordRequest` if it doesn't fit. */
    password?: string
  } = {}
): PDFDocumentLoadingTask {
  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = pdfjsAssetUrls.worker
  }

  const loadingTask = getDocument({
    data: new Uint8Array(data),
    password,
    cMapUrl: pdfjsAssetUrls.cMaps,
    cMapPacked: true,
    standardFontDataUrl: pdfjsAssetUrls.standardFonts,
    iccUrl: pdfjsAssetUrls.iccs,
    wasmUrl: pdfjsAssetUrls.wasm,
    // Renders XFA forms (often used by authorities), PDF.js keeps them disabled by default.
    enableXfa: true
  })

  if (onPasswordRequest) {
    loadingTask.onPassword = (updatePassword: (password: string) => void, reason: number) => {
      onPasswordRequest({
        isRetry: reason === PasswordResponses.INCORRECT_PASSWORD,
        submit: updatePassword,
        cancel: () => loadingTask.destroy()
      })
    }
  }

  return loadingTask
}
