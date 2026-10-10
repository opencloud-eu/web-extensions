import { mock } from 'vitest-mock-extended'
import type { AnnotationEditorUIManager } from 'pdfjs-dist'
import { pauseEditShortcuts } from '../../../src/helpers/editShortcuts'

describe('pauseEditShortcuts', () => {
  it('pauses the shortcuts until resumed, once', () => {
    const uiManager = mock<AnnotationEditorUIManager>()
    const resume = pauseEditShortcuts(uiManager, { isSelected: false })
    expect(uiManager.removeEditListeners).toHaveBeenCalled()
    resume()
    resume()
    expect(uiManager.addEditListeners).toHaveBeenCalledTimes(1)
    expect(uiManager.setSelected).not.toHaveBeenCalled()
  })

  // PDF.js reports "nothing selected" when resuming.
  it('selects the annotation again if it still is selected', () => {
    const uiManager = mock<AnnotationEditorUIManager>()
    const editor = { isSelected: true }
    pauseEditShortcuts(uiManager, editor)()
    expect(uiManager.setSelected).toHaveBeenCalledWith(editor)
  })
})
