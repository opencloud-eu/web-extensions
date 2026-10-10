import { mock } from 'vitest-mock-extended'
import type { AnnotationEditorUIManager } from 'pdfjs-dist'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { useModals } from '@opencloud-eu/web-pkg'
import { usePdfAltText } from '../../../src/composables/usePdfAltText'

vi.mock('@opencloud-eu/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@opencloud-eu/web-pkg')>()),
  useModals: vi.fn()
}))

function setup(altTextData?: { altText?: string; decorative?: boolean }) {
  const dispatchModal = vi.fn()
  vi.mocked(useModals).mockReturnValue({ dispatchModal } as never)
  const onChange = vi.fn()
  let altText: ReturnType<typeof usePdfAltText>
  getComposableWrapper(() => {
    altText = usePdfAltText({ onChange })
  })
  const uiManager = mock<AnnotationEditorUIManager>()
  const editor = { altTextData, altTextFinish: vi.fn(), isSelected: false }
  altText.altTextManager.editAltText(uiManager, editor)
  const modal = dispatchModal.mock.calls[0][0]
  return { modal, attrs: modal.customComponentAttrs(), uiManager, editor, onChange }
}

describe('usePdfAltText', () => {
  it('opens a dialog with the current description and pauses PDF.js shortcuts', () => {
    const { attrs, uiManager } = setup({ altText: 'A cat', decorative: false })
    expect(attrs).toEqual(expect.objectContaining({ altText: 'A cat', decorative: false }))
    expect(uiManager.removeEditListeners).toHaveBeenCalled()
  })

  it('saves the description into the image annotation', () => {
    const { attrs, editor, uiManager, onChange } = setup()
    attrs.onSave({ altText: 'A dog', decorative: false })
    expect(editor.altTextData).toEqual({ altText: 'A dog', decorative: false })
    expect(editor.altTextFinish).toHaveBeenCalled()
    expect(uiManager.addEditListeners).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
  })

  it('restores PDF.js when cancelled, without changes', () => {
    const { modal, editor, uiManager, onChange } = setup({ altText: 'A cat' })
    modal.onCancel()
    expect(editor.altTextData).toEqual({ altText: 'A cat' })
    expect(editor.altTextFinish).toHaveBeenCalledTimes(1)
    expect(uiManager.addEditListeners).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})
