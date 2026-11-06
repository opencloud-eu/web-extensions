// pdf_viewer.mjs takes PDF.js from globalThis.pdfjsLib, which pdfjs-dist sets when imported.
import 'pdfjs-dist'
import { EventBus } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfFormFieldCommit } from '../../../src/composables/usePdfFormFieldCommit'

const mounted: { unmount: () => void }[] = []

function setup() {
  const eventBus = new EventBus()
  let commitFormField: () => void
  const wrapper = getComposableWrapper(() => {
    ;({ commitFormField } = usePdfFormFieldCommit({ eventBus }))
  })
  mounted.push(wrapper)
  const sandboxEvents: unknown[] = []
  eventBus.on('dispatcheventinsandbox', ({ detail }: { detail: unknown }) =>
    sandboxEvents.push(detail)
  )
  const updates: unknown[] = []
  eventBus.on('updatefromsandbox', ({ detail }: { detail: unknown }) => updates.push(detail))
  // What the scripts send back, PDF.js gets it from the event bus.
  function update(detail: object) {
    window.dispatchEvent(new CustomEvent('updatefromsandbox', { detail }))
    return updates.at(-1)
  }
  const layer = document.createElement('div')
  layer.className = 'annotationLayer'
  const field = document.createElement('input')
  field.dataset.elementId = '12R'
  field.value = 'AAA'
  layer.append(field)
  document.body.append(layer)
  field.focus()
  function type() {
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }
  return { commitFormField, sandboxEvents, update, field, type }
}

describe('usePdfFormFieldCommit', () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
  })

  // Otherwise the scripts commit it when it loses the focus, after the save.
  it('lets the form scripts commit the focused text field once typed into, like PDF.js on blur', () => {
    const { commitFormField, sandboxEvents, type } = setup()
    // Unchanged, like PDF.js on blur.
    commitFormField()
    expect(sandboxEvents).toHaveLength(0)
    type()
    commitFormField()
    expect(sandboxEvents).toEqual([
      expect.objectContaining({ id: '12R', name: 'Keystroke', value: 'AAA', willCommit: true })
    ])
    commitFormField()
    expect(sandboxEvents).toHaveLength(1)
  })

  it('keeps what was typed after committing from the answer of the scripts', () => {
    const { commitFormField, update, field, type } = setup()
    type()
    commitFormField()
    expect(update({ id: '12R', value: 'AAA' })).toEqual({ id: '12R', value: 'AAA' })
    type()
    expect(update({ id: '12R', value: 'AAA', siblings: null })).toEqual({
      id: '12R',
      siblings: null
    })
    expect(update({ id: '13R', value: 'B' })).toEqual({ id: '13R', value: 'B' })
    // Once the field is left, PDF.js' own commit on blur gets through again.
    field.blur()
    expect(update({ id: '12R', value: 'AAA' })).toEqual({ id: '12R', value: 'AAA' })
  })

  it('leaves checkboxes and fields outside the document alone', () => {
    const { commitFormField, sandboxEvents, field, type } = setup()
    field.type = 'checkbox'
    type()
    commitFormField()
    field.type = 'text'
    document.body.append(field)
    field.focus()
    type()
    commitFormField()
    expect(sandboxEvents).toHaveLength(0)
  })
})
