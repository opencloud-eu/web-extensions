import { flushPromises } from '@vue/test-utils'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import PdfSignatureImage from '../../../src/components/PdfSignatureImage.vue'
import type { SignatureData } from '../../../src/composables/usePdfSignature'

function imageSignature(width = 10): SignatureData {
  return {
    newCurves: [],
    areContours: true,
    thickness: 0,
    width,
    height: 5,
    outline: { viewBox: '0 0 10 5', toSVGPath: () => 'M0 0L10 5' }
  }
}

function createWrapper(found: SignatureData | null = imageSignature()) {
  const getFromImage = vi.fn().mockResolvedValue(found)
  const wrapper = mount(PdfSignatureImage, {
    props: {
      getFromImage,
      data: null,
      fileName: '',
      'onUpdate:data': (data: SignatureData | null) => wrapper.setProps({ data }),
      'onUpdate:fileName': (fileName: string) => wrapper.setProps({ fileName })
    },
    global: { plugins: [...defaultPlugins()], stubs: { 'oc-icon': true } }
  })
  return { wrapper, getFromImage }
}

async function chooseFile(wrapper: ReturnType<typeof createWrapper>['wrapper'], name: string) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['x'], name)],
    configurable: true
  })
  await input.trigger('change')
}

describe('PdfSignatureImage', () => {
  // Like in the PDF.js viewer, instead of the photo cut into a circle.
  it('shows the signature found in an image on paper, which can be cleared', async () => {
    const { wrapper, getFromImage } = createWrapper()
    await chooseFile(wrapper, 'sig.png')
    await flushPromises()
    expect(getFromImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'sig.png' }))
    expect(wrapper.props('fileName')).toBe('sig.png')
    expect(wrapper.find('.pdf-studio-signature-image-preview path').attributes('d')).toBe(
      'M0 0L10 5'
    )
    await wrapper.find('.pdf-studio-signature-image-clear').trigger('click')
    expect(wrapper.props('data')).toBeNull()
    expect(wrapper.props('fileName')).toBe('')
    expect(wrapper.find('.pdf-studio-signature-image-preview').exists()).toBe(false)
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
  })

  it('explains images without a signature', async () => {
    const { wrapper } = createWrapper(null)
    await chooseFile(wrapper, 'photo.png')
    await flushPromises()
    expect(wrapper.find('.oc-file-input-message').text()).toBe(
      'No signature could be found in this image.'
    )
    expect(wrapper.props('data')).toBeNull()
    expect(wrapper.props('fileName')).toBe('')
  })

  it('uses the last chosen image if an earlier one takes longer', async () => {
    const { wrapper, getFromImage } = createWrapper()
    let resolveFirst: (data: SignatureData) => void
    getFromImage
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(imageSignature(2))
    await chooseFile(wrapper, 'first.png')
    await chooseFile(wrapper, 'second.png')
    await flushPromises()
    resolveFirst(imageSignature(1))
    await flushPromises()
    expect(wrapper.props('data')).toEqual(expect.objectContaining({ width: 2 }))
    expect(wrapper.props('fileName')).toBe('second.png')
  })
})
