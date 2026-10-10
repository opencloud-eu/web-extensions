import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import PdfViewOptions from '../../../src/components/PdfViewOptions.vue'

vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  ScrollMode: { VERTICAL: 0, HORIZONTAL: 1, WRAPPED: 2, PAGE: 3 },
  SpreadMode: { NONE: 0, ODD: 1, EVEN: 2 }
}))

function createWrapper(scrollMode = 0, spreadMode = 1) {
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
    ).toEqual(['0', '1'])
  })

  it('emits the chosen modes', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.pdf-studio-scroll-option[data-mode="2"]').trigger('click')
    await wrapper.find('.pdf-studio-spread-option[data-mode="0"]').trigger('click')
    expect(wrapper.emitted('setScrollMode')).toEqual([[2]])
    expect(wrapper.emitted('setSpreadMode')).toEqual([[0]])
  })
})
