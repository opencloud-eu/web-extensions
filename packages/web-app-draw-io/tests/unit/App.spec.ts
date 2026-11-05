import App from '../../src/App.vue'
import { mock } from 'vitest-mock-extended'
import { Resource } from '@opencloud-eu/web-client'
import { AppConfigObject } from '@opencloud-eu/web-pkg'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'

describe('Draw.io app', () => {
  it('uses the url from the app config as base iFrame url', () => {
    const url = 'https://foo.bar'
    const { wrapper } = createWrapper({ url })
    expect(wrapper.find('iFrame').attributes('src').startsWith(url)).toBeTruthy()
  })

  it('does not reload the diagram when the resource gets replaced after a save', async () => {
    const { wrapper, postMessageSpy } = createWrapper()
    await wrapper.setProps({ resource: mock<Resource>({ id: '1', etag: 'etag-2' }) })
    expect(postMessageSpy).not.toHaveBeenCalled()
  })
})

function createWrapper({ url = 'https://foo.bar' }: { url?: string } = {}) {
  const wrapper = mount(App, {
    props: {
      resource: mock<Resource>({ id: '1', etag: 'etag-1' }),
      applicationConfig: mock<AppConfigObject>({ url }),
      currentContent: '',
      isReadOnly: false,
      isDirty: false
    },
    global: { plugins: [...defaultPlugins()] }
  })
  const postMessageSpy = vi.fn()
  Object.defineProperty(wrapper.find('iframe').element, 'contentWindow', {
    value: { postMessage: postMessageSpy }
  })
  return { wrapper, postMessageSpy }
}
