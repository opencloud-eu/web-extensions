import { computed } from 'vue'
import { mock } from 'vitest-mock-extended'
import type { AnnotationEditorUIManager } from 'pdfjs-dist'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { useModals, type Modal } from '@opencloud-eu/web-pkg'
import { getSavedSignatureParams, usePdfSignature } from '../../../src/composables/usePdfSignature'

type SignatureModalAttrs = {
  canSave: boolean
  onSave: (data: unknown, description: string, isSaved: boolean) => Promise<void>
  getFromImage: (file: File) => Promise<unknown>
}

function setup() {
  const onChange = vi.fn()
  const onCancel = vi.fn()
  const storage = { isFull: computed(() => false), save: vi.fn().mockResolvedValue('uuid-1') }
  let signature: ReturnType<typeof usePdfSignature>
  let modals: ReturnType<typeof useModals>
  getComposableWrapper(() => {
    modals = useModals()
    vi.mocked(modals.dispatchModal).mockImplementation((modal) => ({ ...modal, id: 'modal-1' }))
    signature = usePdfSignature({ storage, onChange, onCancel })
  })
  // The signature dialog, or the one for its description
  function modal() {
    return vi.mocked(modals.dispatchModal).mock.calls[0][0] as Modal
  }
  function modalAttrs() {
    return modal().customComponentAttrs() as SignatureModalAttrs
  }
  const uiManager = mock<AnnotationEditorUIManager>({
    imageManager: { getFromFile: vi.fn().mockResolvedValue({ bitmap: 'bitmap' }) }
  })
  const editor = {
    description: null as string | null,
    isSelected: false,
    _uiManager: uiManager,
    getDrawnSignature: vi.fn(),
    getFromText: vi.fn(),
    getFromImage: vi.fn(() => ({ outline: 'image' })),
    addSignature: vi.fn(),
    remove: vi.fn()
  }
  return {
    manager: signature.signatureManager,
    modal,
    modalAttrs,
    uiManager,
    editor,
    onChange,
    onCancel,
    storage,
    updateModal: modals.updateModal
  }
}

describe('usePdfSignature', () => {
  it('asks for a new signature and adds it like the PDF.js viewer', async () => {
    const { manager, modal, modalAttrs, uiManager, editor, onChange } = setup()
    manager.getSignature({ uiManager, editor: editor as never })
    expect(uiManager.removeEditListeners).toHaveBeenCalled()
    expect(modal().confirmDisabled).toBe(true)
    await modalAttrs().onSave({ outline: 'x' }, 'Signature', false)
    expect(editor.addSignature).toHaveBeenCalledWith({ outline: 'x' }, 40, 'Signature', null)
    expect(uiManager.addEditListeners).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
  })

  it('saves the signature for reuse when asked to, the editor knows it by its uuid', async () => {
    const { manager, modalAttrs, uiManager, editor, storage } = setup()
    manager.getSignature({ uiManager, editor: editor as never })
    const attrs = modalAttrs()
    expect(attrs.canSave).toBe(true)
    await attrs.onSave({ outline: 'x' }, 'Jane', true)
    expect(storage.save).toHaveBeenCalledWith({ outline: 'x' }, 'Jane')
    expect(editor.addSignature).toHaveBeenCalledWith({ outline: 'x' }, 40, 'Jane', 'uuid-1')
  })

  // E.g. the browser blocks its storage.
  it('adds the signature also if it cannot be saved', async () => {
    const { manager, modalAttrs, uiManager, editor, storage } = setup()
    storage.save.mockRejectedValue(new Error('QuotaExceededError'))
    manager.getSignature({ uiManager, editor: editor as never })
    await modalAttrs().onSave({ outline: 'x' }, 'Jane', true)
    expect(editor.addSignature).toHaveBeenCalledWith({ outline: 'x' }, 40, 'Jane', null)
  })

  // Like the PDF.js viewer's dialog.
  it('edits the description of a signature, Update only for a change', async () => {
    const { manager, modal, editor, updateModal } = setup()
    editor.description = 'Jane'
    const button = await manager.renderEditButton(editor as never)
    button.click()
    expect(modal()).toMatchObject({
      title: 'Edit description',
      confirmText: 'Update',
      inputLabel: 'Description (alt text)',
      confirmDisabled: true
    })
    const setError = vi.fn()
    modal().onInput('Jane Doe', setError)
    expect(updateModal).toHaveBeenLastCalledWith('modal-1', 'confirmDisabled', false)
    modal().onInput('Jane', setError)
    expect(updateModal).toHaveBeenLastCalledWith('modal-1', 'confirmDisabled', true)
  })

  it('removes the empty signature when cancelled', () => {
    const { manager, modal, uiManager, editor, onCancel } = setup()
    manager.getSignature({ uiManager, editor: editor as never })
    modal().onCancel()
    expect(onCancel).toHaveBeenCalled()
    expect(editor.remove).toHaveBeenCalled()
    expect(editor.addSignature).not.toHaveBeenCalled()
    expect(uiManager.addEditListeners).toHaveBeenCalled()
  })

  it('reads signatures from images with PDF.js', async () => {
    const { manager, modalAttrs, uiManager, editor } = setup()
    manager.getSignature({ uiManager, editor: editor as never })
    const file = new File(['x'], 'sig.png')
    const data = await modalAttrs().getFromImage(file)
    expect(uiManager.imageManager.getFromFile).toHaveBeenCalledWith(file)
    expect(editor.getFromImage).toHaveBeenCalledWith('bitmap')
    expect(data).toEqual({ outline: 'image' })
  })

  it('renders an edit button for the toolbar of a signature that edits its description', async () => {
    const { manager, modal, uiManager, editor, onChange } = setup()
    editor.description = 'Signature'
    const button = await manager.renderEditButton(editor as never)
    expect(button.title).toBe('Signature')
    button.click()
    expect(modal().inputValue).toBe('Signature')
    expect(uiManager.removeEditListeners).toHaveBeenCalled()
    modal().onConfirm(' Jane ')
    expect(editor.description).toBe('Jane')
    expect(uiManager.addEditListeners).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
  })

  it('places saved signatures right away, smoothed already', () => {
    const lines = { curves: [{ points: [0, 0] }], thickness: 1, width: 1, height: 1 }
    const { signatureData } = getSavedSignatureParams({
      uuid: 'uuid-1',
      description: 'Signature',
      lines,
      areContours: true
    })
    expect(signatureData).toEqual({
      lines,
      mustSmooth: false,
      areContours: true,
      description: 'Signature',
      uuid: 'uuid-1',
      heightInPage: 40
    })
  })
})
