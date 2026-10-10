import { unref } from 'vue'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { AnnotationEditorParamsType } from 'pdfjs-dist'
import { usePdfAnnotationTools } from '../../../src/composables/usePdfAnnotationTools'

// The real module starts fetching resources under happy-dom, only the enums are needed.
vi.mock('pdfjs-dist', () => ({
  AnnotationEditorType: {
    FREETEXT: 3,
    HIGHLIGHT: 9,
    STAMP: 13,
    INK: 15,
    POPUP: 16,
    SIGNATURE: 101
  },
  AnnotationEditorParamsType: {
    FREETEXT_SIZE: 11,
    FREETEXT_COLOR: 12,
    INK_COLOR: 21,
    INK_THICKNESS: 22,
    INK_OPACITY: 23,
    HIGHLIGHT_COLOR: 31,
    HIGHLIGHT_THICKNESS: 32,
    HIGHLIGHT_FREE: 33,
    HIGHLIGHT_SHOW_ALL: 34
  }
}))

function setup({ params = new Map<number, unknown>(), isPublicLink = false } = {}) {
  let tools: ReturnType<typeof usePdfAnnotationTools>
  getComposableWrapper(
    () => {
      tools = usePdfAnnotationTools({ params })
    },
    { pluginOptions: { piniaOptions: { authState: { publicLinkContextReady: isPublicLink } } } }
  )
  return tools
}

function getSettings(tools: ReturnType<typeof usePdfAnnotationTools>, id: string) {
  return unref(tools.tools).find((tool) => tool.id === id).settings
}

describe('usePdfAnnotationTools', () => {
  it('lists the tools in the order of the toolbar', () => {
    expect(unref(setup().tools).map(({ id }) => id)).toEqual([
      'signature',
      'highlight',
      'freetext',
      'ink',
      'stamp',
      'comments'
    ])
  })

  it('reports the values of PDF.js, the defaults of its editors until then', () => {
    const tools = setup({ params: new Map([[AnnotationEditorParamsType.INK_THICKNESS, 7]]) })
    expect(tools.getValues(getSettings(tools, 'ink'))).toEqual({
      'ink-color': '#000000',
      'ink-thickness': 7,
      'ink-opacity': 1
    })
    expect(tools.getValues(getSettings(tools, 'highlight'))).toEqual({
      'highlight-color': '#FFFF98',
      'highlight-thickness': 12,
      'highlight-show-all': true
    })
  })

  it.each([
    [false, ['device', 'cloud']],
    // The file picker only shows the shared files there.
    [true, ['device']]
  ])('offers images from (public link: %s) %s', (isPublicLink, sources) => {
    expect(unref(setup({ isPublicLink }).imageSources).map(({ id }) => id)).toEqual(sources)
  })
})
