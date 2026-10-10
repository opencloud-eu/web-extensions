import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mock } from 'vitest-mock-extended'
import { useIntersectionObserver } from '@vueuse/core'
import type { PageViewport, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfThumbnailImage } from '../../../src/composables/usePdfThumbnailImage'
import { usePdfThumbnailCache } from '../../../src/composables/usePdfThumbnailCache'

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useIntersectionObserver: vi.fn(() => ({ stop: vi.fn() }))
}))

function setup({
  isRendered = true,
  cache = undefined as ReturnType<typeof usePdfThumbnailCache> | undefined
} = {}) {
  HTMLCanvasElement.prototype.toBlob = (callback: BlobCallback) => callback(new Blob(['png']))
  const renderTasks: RenderTask[] = []
  const getViewport = vi.fn<PDFPageProxy['getViewport']>(() =>
    mock<PageViewport>({ width: 100, height: 141 })
  )
  const render = vi.fn<PDFPageProxy['render']>(() => {
    // Plain, a mock breaks the promise in it.
    const task = {
      promise: isRendered ? Promise.resolve() : new Promise<void>(() => {}),
      cancel: vi.fn()
    } as Pick<RenderTask, 'promise' | 'cancel'> as RenderTask
    renderTasks.push(task)
    return task
  })
  const page = mock<PDFPageProxy>({ rotate: 0, getViewport, render })
  const pdfDocument = mock<PDFDocumentProxy>()
  pdfDocument.getPage.mockResolvedValue(page)
  const rotation = ref(0)
  let imageUrl: ReturnType<typeof usePdfThumbnailImage>['imageUrl']
  const wrapper = getComposableWrapper(() => {
    ;({ imageUrl } = usePdfThumbnailImage({
      element: document.createElement('li'),
      pdfDocument,
      pageNumber: 2,
      rotation,
      cache
    }))
  })
  async function scrollIntoView() {
    const [, callback] = vi.mocked(useIntersectionObserver).mock.lastCall
    callback([{ isIntersecting: true } as IntersectionObserverEntry], undefined)
    await flushPromises()
  }
  return { imageUrl, getViewport, render, renderTasks, rotation, scrollIntoView, wrapper }
}

describe('usePdfThumbnailImage', () => {
  it('renders the page only once it is scrolled into view', async () => {
    const { imageUrl, render, scrollIntoView } = setup()
    await flushPromises()
    expect(render).not.toHaveBeenCalled()
    await scrollIntoView()
    expect(render).toHaveBeenCalledTimes(1)
    expect(imageUrl.value).toBeDefined()
  })

  it('renders again for another rotation, cancelling the running rendering', async () => {
    const { getViewport, render, renderTasks, rotation, scrollIntoView } = setup({
      isRendered: false
    })
    await scrollIntoView()
    rotation.value = 90
    await flushPromises()
    expect(renderTasks[0].cancel).toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(2)
    expect(getViewport).toHaveBeenLastCalledWith(expect.objectContaining({ rotation: 90 }))
  })

  it('shows the cached image until rendered, then caches the new one', async () => {
    const cache = usePdfThumbnailCache()
    const previous = new Blob(['previous'])
    cache.set(2, 0, previous)
    const { imageUrl, scrollIntoView } = setup({ cache })
    expect(imageUrl.value).toBeTruthy()
    await scrollIntoView()
    expect(cache.get(2, 0)).not.toBe(previous)
  })

  it('cancels the rendering when unmounted', async () => {
    const { renderTasks, scrollIntoView, wrapper } = setup({ isRendered: false })
    await scrollIntoView()
    wrapper.unmount()
    expect(renderTasks[0].cancel).toHaveBeenCalled()
  })
})
