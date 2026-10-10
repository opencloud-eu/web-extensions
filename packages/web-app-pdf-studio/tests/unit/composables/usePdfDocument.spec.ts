import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { useModals, type Modal } from '@opencloud-eu/web-pkg'
import { usePdfDocument } from '../../../src/composables/usePdfDocument'
import { loadPdfDocument } from '../../../src/helpers/pdfjs'

vi.mock('../../../src/helpers/pdfjs', () => ({ loadPdfDocument: vi.fn() }))

function createTask() {
  let resolve: (doc: PDFDocumentProxy) => void
  let reject: (e: Error) => void
  const task = {
    destroyed: false,
    promise: new Promise<PDFDocumentProxy>((res, rej) => {
      resolve = res
      reject = rej
    }),
    destroy: vi.fn(() => {
      task.destroyed = true
      reject(new Error('destroyed'))
      return Promise.resolve()
    })
  }
  return { task, resolve: (doc: PDFDocumentProxy) => resolve(doc), reject: (e: Error) => reject(e) }
}

function setup() {
  const onLoaded = vi.fn()
  let document: ReturnType<typeof usePdfDocument>
  let modals: ReturnType<typeof useModals>
  getComposableWrapper(() => {
    modals = useModals()
    vi.mocked(modals.dispatchModal).mockImplementation((modal) => ({ ...modal, id: 'modal' }))
    document = usePdfDocument({ onLoaded })
  })
  // The last password prompt
  function passwordModal() {
    return vi.mocked(modals.dispatchModal).mock.calls.at(-1)[0] as Modal
  }
  return { document, onLoaded, passwordModal }
}

describe('usePdfDocument', () => {
  it('hands the loaded document over and destroys the previous one afterwards', async () => {
    const first = createTask()
    const second = createTask()
    vi.mocked(loadPdfDocument)
      .mockReturnValueOnce(first.task as never)
      .mockReturnValueOnce(second.task as never)
    const { document, onLoaded } = setup()

    const firstLoad = document.load(new ArrayBuffer(1))
    first.resolve({ id: 1 } as never)
    await firstLoad
    const secondLoad = document.load(new ArrayBuffer(1))
    second.resolve({ id: 2 } as never)
    await secondLoad

    expect(onLoaded.mock.calls.map(([doc]) => doc)).toEqual([{ id: 1 }, { id: 2 }])
    expect(first.task.destroy).toHaveBeenCalled()
    expect(document.isLoading.value).toBe(false)
    expect(document.documentKey.value).toBe(2)
  })

  // The worker detaches the buffer, AppWrapper keeps the original.
  it('hands a copy of the content to PDF.js', () => {
    vi.mocked(loadPdfDocument).mockReturnValue(createTask().task as never)
    const { document } = setup()
    const data = new Uint8Array([1, 2, 3]).buffer
    document.load(data)
    const [passed] = vi.mocked(loadPdfDocument).mock.calls.at(-1)
    expect(passed).not.toBe(data)
    expect(Array.from(new Uint8Array(passed))).toEqual([1, 2, 3])
  })

  it('passes the page to show along with the loaded document', async () => {
    const { task, resolve } = createTask()
    vi.mocked(loadPdfDocument).mockReturnValue(task as never)
    const { document, onLoaded } = setup()
    const load = document.load(new ArrayBuffer(1), { pageNumber: 3 })
    resolve({ id: 1 } as never)
    await load
    expect(onLoaded).toHaveBeenCalledWith({ id: 1 }, { pageNumber: 3 })
  })

  it('reports documents that cannot be opened', async () => {
    const { task, reject } = createTask()
    vi.mocked(loadPdfDocument).mockReturnValue(task as never)
    const { document } = setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const load = document.load(new ArrayBuffer(1))
    reject(new Error('broken'))
    await load
    expect(document.loadError.value?.message).toBe('broken')
    // PDF.js' exceptions have no stack, which leaves only their minified class name otherwise.
    expect(consoleError).toHaveBeenCalledWith('Error: broken')
    consoleError.mockRestore()
  })

  it('explains the empty viewer when the password prompt was cancelled', async () => {
    const { task } = createTask()
    vi.mocked(loadPdfDocument).mockImplementation((_data, { onPasswordRequest }) => {
      onPasswordRequest({ isRetry: false, submit: vi.fn(), cancel: () => task.destroy() })
      return task as never
    })
    const { document, passwordModal } = setup()
    const load = document.load(new ArrayBuffer(1))
    passwordModal().onCancel()
    await load
    expect(document.isPasswordCancelled.value).toBe(true)
    expect(document.loadError.value).toBeUndefined()
  })

  it('reuses the password for documents rebuilt from the unlocked one', async () => {
    const first = createTask()
    const second = createTask()
    vi.mocked(loadPdfDocument)
      .mockImplementationOnce((_data, { onPasswordRequest }) => {
        onPasswordRequest({ isRetry: false, submit: vi.fn(), cancel: vi.fn() })
        return first.task as never
      })
      .mockReturnValueOnce(second.task as never)
    const { document, passwordModal } = setup()
    const load = document.load(new ArrayBuffer(1))
    passwordModal().onConfirm('secret')
    first.resolve({ id: 1 } as never)
    await load
    expect(document.getPassword()).toBe('secret')

    const reload = document.load(new ArrayBuffer(1))
    second.resolve({ id: 2 } as never)
    await reload
    expect(vi.mocked(loadPdfDocument).mock.calls[1][1]).toEqual(
      expect.objectContaining({ password: 'secret' })
    )
  })

  it('asks again with a hint after a wrong password', () => {
    vi.mocked(loadPdfDocument).mockImplementation((_data, { onPasswordRequest }) => {
      onPasswordRequest({ isRetry: true, submit: vi.fn(), cancel: vi.fn() })
      return createTask().task as never
    })
    const { document, passwordModal } = setup()
    document.load(new ArrayBuffer(1))
    expect(passwordModal()).toEqual(
      expect.objectContaining({
        inputType: 'password',
        message: 'Invalid password. Please try again.'
      })
    )
  })
})
