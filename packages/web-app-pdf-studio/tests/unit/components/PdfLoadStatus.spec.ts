import { AppLoadingSpinner } from '@opencloud-eu/web-pkg'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import PdfLoadStatus from '../../../src/components/PdfLoadStatus.vue'

function createWrapper(props: Record<string, boolean>) {
  return mount(PdfLoadStatus, {
    props,
    global: {
      plugins: [...defaultPlugins()],
      stubs: {
        'oc-icon': true,
        NoContentMessage: {
          template: '<div><slot name="message" /><slot name="callToAction" /></div>'
        }
      }
    }
  })
}

describe('PdfLoadStatus', () => {
  it('offers to enter the password again after cancelling it', async () => {
    const wrapper = createWrapper({ isPasswordCancelled: true })
    expect(wrapper.text()).toContain('This PDF file is protected')
    await wrapper.find('.pdf-studio-password-retry').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('explains files that can not be opened', () => {
    expect(createWrapper({ hasError: true }).text()).toContain('could not be opened')
  })

  it('shows loading', () => {
    expect(createWrapper({ isLoading: true }).findComponent(AppLoadingSpinner).exists()).toBe(true)
  })
})
