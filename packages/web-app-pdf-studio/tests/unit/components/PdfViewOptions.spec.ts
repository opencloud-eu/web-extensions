// pdf_viewer.mjs takes PDF.js from globalThis.pdfjsLib, which pdfjs-dist sets when imported.
import 'pdfjs-dist'
import { ScrollMode, SpreadMode } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import PdfViewOptions from '../../../src/components/PdfViewOptions.vue'

function createWrapper(scrollMode = ScrollMode.VERTICAL, spreadMode = SpreadMode.ODD) {
  return mount(PdfViewOptions, {
    props: { scrollMode, spreadMode },
    global: { plugins: [...defaultPlugins()], stubs: { 'oc-icon': true } }
  })
}

describe('PdfViewOptions', () => {
  it('offers the scroll and spread modes of the PDF.js viewer, the current ones marked', () => {
    const wrapper = createWrapper()
    const scroll = wrapper.findAll('.pdf-studio-scroll-option')
    const spread = wrapper.findAll('.pdf-studio-spread-option')
    expect(scroll.map((option) => option.text())).toEqual([
      'Page scrolling',
      'Vertical scrolling',
      'Horizontal scrolling',
      'Wrapped scrolling'
    ])
    expect(spread.map((option) => option.text())).toEqual([
      'No spreads',
      'Odd spreads',
      'Even spreads'
    ])
    expect(
      wrapper.findAll('[aria-current]').map((option) => option.attributes('data-mode'))
    ).toEqual([`${ScrollMode.VERTICAL}`, `${SpreadMode.ODD}`])
  })

  it('emits the chosen modes', async () => {
    const wrapper = createWrapper()
    await wrapper
      .find(`.pdf-studio-scroll-option[data-mode="${ScrollMode.WRAPPED}"]`)
      .trigger('click')
    await wrapper.find(`.pdf-studio-spread-option[data-mode="${SpreadMode.NONE}"]`).trigger('click')
    expect(wrapper.emitted('setScrollMode')).toEqual([[ScrollMode.WRAPPED]])
    expect(wrapper.emitted('setSpreadMode')).toEqual([[SpreadMode.NONE]])
  })
})
