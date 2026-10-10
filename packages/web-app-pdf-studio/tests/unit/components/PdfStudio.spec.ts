import { ref, shallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mock } from 'vitest-mock-extended'
import type { Resource } from '@opencloud-eu/web-client'
import type { AnnotationEditorUIManager, PDFDocumentProxy } from 'pdfjs-dist'
import type { EventBus } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { defaultPlugins, shallowMount } from '@opencloud-eu/web-test-helpers'
import PdfStudio from '../../../src/components/PdfStudio.vue'
import { usePdfSaving } from '../../../src/composables/usePdfSaving'
import { usePdfDocument } from '../../../src/composables/usePdfDocument'
import { usePdfCloudImagePicker } from '../../../src/composables/usePdfCloudImagePicker'

const { createEditor, handleEscape, openPicker } = vi.hoisted(() => ({
  handleEscape: vi.fn(),
  createEditor: vi.fn(),
  openPicker: vi.fn()
}))

vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  ScrollMode: { VERTICAL: 0, HORIZONTAL: 1, WRAPPED: 2, PAGE: 3 },
  SpreadMode: { NONE: 0, ODD: 1, EVEN: 2 },
  FindState: { FOUND: 0, NOT_FOUND: 1 }
}))
vi.mock('pdfjs-dist', () => ({
  AnnotationEditorType: { NONE: 0, STAMP: 13, POPUP: 16, SIGNATURE: 101 },
  TouchManager: vi.fn()
}))
vi.mock('pdfjs-dist/web/pdf_viewer.css', () => ({}))
vi.mock('../../../src/composables/usePdfViewer', () => ({
  pdfEventBusKey: Symbol('pdfEventBus'),
  usePdfViewer: () => ({
    eventBus: mock<EventBus>(),
    scriptingManager: {},
    linkService: {},
    uiManager: shallowRef(mock<AnnotationEditorUIManager>()),
    commitEditing: vi.fn(() => () => {}),
    isDrawing: () => false,
    hasUnfinishedEdits: () => false,
    finishDrawings: vi.fn(),
    pagesCount: ref(1),
    pageNumber: ref(1),
    scaleValue: ref('auto'),
    editorMode: ref(0),
    isToolActive: ref(false),
    editingStates: ref({}),
    setDocument: vi.fn(),
    createEditor,
    handleEscape
  })
}))
vi.mock('../../../src/composables/usePdfDocument', () => ({
  usePdfDocument: vi.fn()
}))
vi.mock('../../../src/composables/usePdfSaving', () => ({
  usePdfSaving: vi.fn()
}))
vi.mock('../../../src/composables/usePdfCloudImagePicker', () => ({
  usePdfCloudImagePicker: vi.fn(() => ({ openPicker }))
}))
vi.mock('../../../src/composables/usePdfPrint', () => ({
  usePdfPrint: () => ({ isPrinting: ref(false), print: vi.fn() })
}))

function createWrapper({
  isReadOnly = false,
  isPasswordCancelled = false
}: {
  isReadOnly?: boolean
  isPasswordCancelled?: boolean
} = {}) {
  const load = vi.fn()
  const scheduleCheck = vi.fn()
  const save = vi.fn()
  const afterSave = vi.fn()
  vi.mocked(usePdfDocument).mockReturnValue({
    pdfDocument: shallowRef(mock<PDFDocumentProxy>({ isPureXfa: false })),
    isLoading: ref(false),
    loadError: ref<Error>(),
    isPasswordCancelled: ref(isPasswordCancelled),
    documentKey: ref(1),
    getPassword: () => undefined,
    load
  })
  vi.mocked(usePdfSaving).mockReturnValue({
    scheduleCheck,
    flush: vi.fn(),
    reset: vi.fn(),
    afterSave,
    save
  })

  const currentContent = new ArrayBuffer(1)
  const wrapper = shallowMount(PdfStudio, {
    props: { resource: mock<Resource>({ etag: '1' }), currentContent, isReadOnly, isDirty: false },
    global: {
      plugins: [...defaultPlugins()]
    },
    attachTo: document.body
  })
  return { wrapper, load, save, afterSave, scheduleCheck, currentContent }
}

describe('PdfStudio', () => {
  it('loads the current content on mount', async () => {
    const { wrapper, load, currentContent } = createWrapper()
    await flushPromises()
    expect(load).toHaveBeenCalledWith(currentContent)
    wrapper.unmount()
  })

  it('offers to enter the password again after cancelling it', () => {
    const { wrapper, load, currentContent } = createWrapper({ isPasswordCancelled: true })
    load.mockClear()
    wrapper.findComponent({ name: 'PdfLoadStatus' }).vm.$emit('retry')
    expect(load).toHaveBeenCalledWith(currentContent)
    wrapper.unmount()
  })

  it('reports written changes as the content and registers for the saves of AppWrapper', () => {
    const { wrapper, afterSave } = createWrapper()
    expect(wrapper.emitted('register:onSaveCallback')).toEqual([[afterSave]])
    const content = new ArrayBuffer(2)
    vi.mocked(usePdfSaving).mock.lastCall[0].onChange(content)
    vi.mocked(usePdfSaving).mock.lastCall[0].onSave()
    expect(wrapper.emitted('update:currentContent')).toEqual([[content]])
    expect(wrapper.emitted('save')).toHaveLength(1)
    wrapper.unmount()
  })

  it('saves with Ctrl+S, typing goes on afterwards', () => {
    const { wrapper, save } = createWrapper()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    expect(save).toHaveBeenCalledWith({ goOnTyping: true })
    wrapper.unmount()
  })

  it('hands Escape over to the editing', async () => {
    const { wrapper } = createWrapper()
    // The listener is added once the root element is there.
    await flushPromises()
    await wrapper.find('.pdf-studio-viewer-container').trigger('keydown', { key: 'Escape' })
    expect(handleEscape).toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
    wrapper.unmount()
  })

  it('places images picked from the cloud as a new image annotation', async () => {
    const { wrapper } = createWrapper()
    const { onImage } = vi.mocked(usePdfCloudImagePicker).mock.calls.at(-1)[0]
    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await onImage(file)
    expect(createEditor).toHaveBeenCalledWith(13, { bitmapFile: file })
    wrapper.unmount()
  })

  it('adds images from the device, PDF.js asks for the file', () => {
    const { wrapper } = createWrapper()
    wrapper.findComponent({ name: 'PdfToolbar' }).vm.$emit('addImage', 'device')
    expect(createEditor).toHaveBeenCalledWith(13)
    expect(openPicker).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('adds images from the cloud with the file picker', () => {
    const { wrapper } = createWrapper()
    wrapper.findComponent({ name: 'PdfToolbar' }).vm.$emit('addImage', 'cloud')
    expect(openPicker).toHaveBeenCalled()
    expect(createEditor).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('places saved signatures right away', () => {
    const { wrapper } = createWrapper()
    const signature = {
      uuid: 'uuid-1',
      description: 'Signature',
      lines: { curves: [{ points: [0, 0] }], thickness: 1, width: 1, height: 1 },
      areContours: false
    }
    wrapper.findComponent({ name: 'PdfToolbar' }).vm.$emit('addSavedSignature', signature)
    expect(createEditor).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ signatureData: expect.objectContaining({ uuid: 'uuid-1' }) })
    )
    wrapper.unmount()
  })
})
