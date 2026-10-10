import { defaultPlugins, mount, ocDropStub } from '@opencloud-eu/web-test-helpers'
import PdfFindBar from '../../../src/components/PdfFindBar.vue'
import type { FindOptions, FindResult } from '../../../src/composables/usePdfFindBar'

function createWrapper(findResult: Partial<FindResult> = {}, query = '') {
  const options: FindOptions = {
    highlightAll: true,
    caseSensitive: false,
    entireWord: false,
    matchDiacritics: false
  }
  const wrapper = mount(PdfFindBar, {
    props: {
      findResult: { current: 0, total: 0, notFound: false, ...findResult },
      query,
      'onUpdate:query': (value: string) => wrapper.setProps({ query: value }),
      options,
      'onUpdate:options': (value: FindOptions) => wrapper.setProps({ options: value })
    },
    global: {
      plugins: [...defaultPlugins()],
      stubs: { 'oc-icon': true, 'oc-drop': ocDropStub }
    },
    attachTo: document.body
  })
  return wrapper
}

describe('PdfFindBar', () => {
  it('searches for the previous query again when reopened', () => {
    const wrapper = createWrapper({}, 'foo')
    expect(wrapper.emitted('find')[0][0]).toBe('foo')
    wrapper.unmount()
  })

  it('focuses the search input when opened', () => {
    const wrapper = createWrapper()
    expect(document.activeElement).toBe(wrapper.find('.pdf-studio-find-input input').element)
    wrapper.unmount()
  })

  // PDF.js listens on window, e.g. Backspace would delete the selected annotation.
  it('keeps keys from PDF.js', async () => {
    const wrapper = createWrapper()
    const onWindowKeydown = vi.fn()
    window.addEventListener('keydown', onWindowKeydown)
    await wrapper.find('.pdf-studio-find-input input').trigger('keydown', { key: 'Backspace' })
    expect(onWindowKeydown).not.toHaveBeenCalled()
    window.removeEventListener('keydown', onWindowKeydown)
    wrapper.unmount()
  })

  it('can match diacritics', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.pdf-studio-find-match-diacritics input').setValue(true)
    const [, options] = wrapper.emitted('find')[0] as [string, { matchDiacritics: boolean }]
    expect(options.matchDiacritics).toBe(true)
    wrapper.unmount()
  })

  it('searches while typing', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.pdf-studio-find-input input').setValue('foo')
    expect(wrapper.emitted('find')[0]).toEqual([
      'foo',
      { highlightAll: true, caseSensitive: false, entireWord: false, matchDiacritics: false },
      { type: '', findPrevious: false }
    ])
    wrapper.unmount()
  })

  it('jumps to the next and previous match with enter and shift+enter', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('.pdf-studio-find-input input')
    await input.setValue('foo')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keydown', { key: 'Enter', shiftKey: true })
    const params = wrapper
      .emitted('find')
      .slice(1)
      .map((args) => args[2])
    expect(params).toEqual([
      { type: 'again', findPrevious: false },
      { type: 'again', findPrevious: true }
    ])
    wrapper.unmount()
  })

  it('re-runs the search when an option changes', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.pdf-studio-find-match-case input').setValue(true)
    const [, options, params] = wrapper.emitted('find')[0] as [
      string,
      { caseSensitive: boolean },
      unknown
    ]
    expect(options.caseSensitive).toBe(true)
    expect(params).toEqual({ type: 'casesensitivitychange', findPrevious: false })
    wrapper.unmount()
  })

  it("updates the options as a whole, not the parent's object", async () => {
    const wrapper = createWrapper()
    const { options } = wrapper.props()
    await wrapper.find('.pdf-studio-find-whole-words input').setValue(true)
    expect(options.entireWord).toBe(false)
    expect(wrapper.emitted<[FindOptions]>('update:options')[0][0].entireWord).toBe(true)
    wrapper.unmount()
  })

  it.each([
    [{ current: 2, total: 7 }, '2/7', '2 of 7 matches'],
    [{ notFound: true }, '0/0', 'Phrase not found']
  ])('shows the result %o', async (result, count, text) => {
    const wrapper = createWrapper(result)
    expect(wrapper.find('.pdf-studio-find-count').exists()).toBe(false)
    await wrapper.find('.pdf-studio-find-input input').setValue('foo')
    expect(wrapper.find('.pdf-studio-find-count').text()).toBe(count)
    // For screen readers
    expect(wrapper.find('.pdf-studio-find-result').text()).toBe(text)
    wrapper.unmount()
  })

  it('closes on escape', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.pdf-studio-find-input input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
