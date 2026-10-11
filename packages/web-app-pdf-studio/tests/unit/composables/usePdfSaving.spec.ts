import { ref, shallowRef, toValue } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mock } from 'vitest-mock-extended'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { EventBus } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfSaving } from '../../../src/composables/usePdfSaving'
import { usePdfChangeTracking } from '../../../src/composables/usePdfChangeTracking'

vi.mock('../../../src/composables/usePdfChangeTracking', () => ({
  usePdfChangeTracking: vi.fn()
}))

// Their listeners on window would handle the clicks of later tests.
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

function setup({
  isReadOnly = false,
  isDirty = false,
  hasNewContent = true,
  hasChangeMarker = false,
  hasUnfinishedEdits = false
} = {}) {
  const tracking = {
    scheduleCheck: vi.fn(),
    flush: vi.fn().mockResolvedValue(hasNewContent),
    reset: vi.fn(),
    takeChangeMarker: vi.fn().mockReturnValue(hasChangeMarker),
    markChanged: vi.fn(),
    markSaved: vi.fn()
  }
  vi.mocked(usePdfChangeTracking).mockReturnValue(tracking)
  const state = { isDirty }
  const resumeTyping = vi.fn()
  const editorMode = ref(0)
  const editing = {
    editorMode,
    editingStates: ref({
      hasSomethingToUndo: false,
      hasSomethingToRedo: false,
      hasSelectedEditor: false
    }),
    isDrawing: () => false,
    hasUnfinishedEdits: () => hasUnfinishedEdits,
    finishDrawings: vi.fn(),
    commitEditing: vi.fn(() => resumeTyping)
  }
  const scripting = {
    dispatchWillSave: vi.fn().mockResolvedValue(undefined),
    dispatchDidSave: vi.fn().mockResolvedValue(undefined)
  }
  const onSave = vi.fn()
  const eventBus = mock<EventBus>()
  let saving: ReturnType<typeof usePdfSaving>
  const wrapper = getComposableWrapper(() => {
    saving = usePdfSaving({
      pdfDocument: shallowRef<PDFDocumentProxy>(),
      root: ref(document.createElement('div')),
      eventBus,
      isEnabled: true,
      isReadOnly,
      isDirty: () => state.isDirty,
      content: new ArrayBuffer(1),
      editing,
      scripting,
      onChange: vi.fn(),
      onSave
    })
  })
  mounted.push(wrapper)
  return { saving, tracking, editing, scripting, resumeTyping, onSave, state, eventBus }
}

describe('usePdfSaving', () => {
  describe('save', () => {
    it('writes pending changes, then saves', async () => {
      const { saving, tracking, editing, onSave, resumeTyping } = setup()
      await saving.save()
      expect(editing.commitEditing).toHaveBeenCalled()
      expect(tracking.flush).toHaveBeenCalled()
      expect(onSave).toHaveBeenCalled()
      expect(resumeTyping).not.toHaveBeenCalled()
    })

    it('lets form scripts know before and after saving, like the PDF.js viewer', async () => {
      const { saving, tracking, scripting, onSave } = setup()
      const calls: string[] = []
      scripting.dispatchWillSave.mockImplementation(() => {
        calls.push('willSave')
        return Promise.resolve()
      })
      tracking.flush.mockImplementation(() => {
        calls.push('flush')
        return Promise.resolve(true)
      })
      onSave.mockImplementation(() => calls.push('save'))
      scripting.dispatchDidSave.mockImplementation(() => {
        calls.push('didSave')
        return Promise.resolve()
      })
      await saving.save()
      expect(calls).toEqual(['willSave', 'flush', 'save', 'didSave'])
    })

    // Form scripts commit fields and react to WillSave in a later task.
    it('waits for the form scripts before writing the changes', async () => {
      const { saving, tracking, scripting } = setup()
      const calls: string[] = []
      scripting.dispatchWillSave.mockImplementation(() => {
        setTimeout(() => calls.push('scripts'))
        return Promise.resolve()
      })
      tracking.flush.mockImplementation(() => {
        calls.push('flush')
        return Promise.resolve(true)
      })
      await saving.save()
      expect(calls).toEqual(['scripts', 'flush'])
    })

    it('does not save when the changes cannot be written', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { saving, tracking, onSave } = setup({ isDirty: true })
      tracking.flush.mockRejectedValue(new TypeError('broken'))
      await saving.save()
      expect(onSave).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('goes on typing after saving with the keyboard', async () => {
      const { saving, resumeTyping } = setup()
      await saving.save({ goOnTyping: true })
      expect(resumeTyping).toHaveBeenCalled()
    })

    it.each([
      [false, false, 0],
      [false, true, 1],
      [true, false, 1]
    ])(
      'saves only with something to save (new content: %s, unsaved: %s)',
      async (hasNewContent, isDirty, count) => {
        const { saving, onSave } = setup({ hasNewContent, isDirty })
        await saving.save()
        expect(onSave).toHaveBeenCalledTimes(count)
      }
    )

    it('tracks no changes in read-only files', () => {
      setup({ isReadOnly: true })
      expect(toValue(vi.mocked(usePdfChangeTracking).mock.calls.at(-1)[0].isEnabled)).toBe(false)
    })
  })

  // It would save before the latest changes are written.
  describe("AppWrapper's save button", () => {
    function clickSaveButton() {
      const button = document.createElement('button')
      button.id = 'app-save-action'
      const onClick = vi.fn()
      button.addEventListener('click', onClick)
      document.body.append(button)
      button.click()
      button.remove()
      return onClick
    }

    it('saves like Ctrl+S, once', async () => {
      const { onSave } = setup()
      const onClick = clickSaveButton()
      await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('is left alone in read-only files', () => {
      const { onSave } = setup({ isReadOnly: true })
      expect(clickSaveButton()).toHaveBeenCalled()
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  // E.g. autosave: it saves the copy that marked the file as changed. AppWrapper calls
  // afterSave() once it is done.
  describe("AppWrapper's saves", () => {
    it.each([
      [true, 1],
      [false, 0]
    ])(
      'save the content that followed the copy (copy saved: %s)',
      async (hasChangeMarker, count) => {
        const { saving, onSave } = setup({ hasChangeMarker, isDirty: true })
        await saving.afterSave()
        expect(onSave).toHaveBeenCalledTimes(count)
      }
    )

    it('keep edits that are still unfinished marked, without saving again', async () => {
      const { saving, onSave, tracking, editing } = setup({
        hasChangeMarker: true,
        hasUnfinishedEdits: true
      })
      await saving.afterSave()
      expect(editing.finishDrawings).toHaveBeenCalled()
      expect(onSave).not.toHaveBeenCalled()
      expect(tracking.markSaved).toHaveBeenCalled()
      expect(tracking.markChanged).toHaveBeenCalled()
    })

    it('do not save the same again when the changes cannot be written', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { saving, onSave, tracking } = setup({ hasChangeMarker: true, isDirty: true })
      tracking.flush.mockRejectedValue(new TypeError('broken'))
      await saving.afterSave()
      expect(onSave).not.toHaveBeenCalled()
      expect(tracking.markSaved).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('make the saved content the one to come back to', async () => {
      const { saving, tracking } = setup()
      await saving.afterSave()
      expect(tracking.markSaved).toHaveBeenCalled()
    })
  })

  // PDF.js commits annotations asynchronously, e.g. when leaving a tool.
  it('checks for changes when the tool or the editing state changes', async () => {
    const { tracking, editing } = setup()
    editing.editorMode.value = 15
    await flushPromises()
    expect(tracking.scheduleCheck).toHaveBeenCalledTimes(1)
  })

  it('checks for changes after form scripts updated fields', () => {
    const { tracking, eventBus } = setup()
    const [, listener] = eventBus.on.mock.calls.find(([name]) => name === 'updatefromsandbox')
    listener()
    expect(tracking.scheduleCheck).toHaveBeenCalled()
  })
})
