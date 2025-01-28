import { Resource } from '@opencloud-eu/web-client'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { AppConfigObject } from '@opencloud-eu/web-pkg'
import App from '../../src/App.vue'

describe('json viewer', () => {
  it('renders the json editor', () => {
    const { wrapper } = createWrapper()
    expect(wrapper.find('.jse-main').exists()).toBeTruthy()
  })
  it('renders the given json keys and values', async () => {
    const content = { foo: 'bar' }
    const { wrapper } = createWrapper({ currentContent: JSON.stringify(content) })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.jse-key').text()).toEqual('foo')
    expect(wrapper.find('.jse-value').text()).toEqual(content.foo)
  })
  describe('dark and light theme', () => {
    it('uses the dark theme if enabled', () => {
      const { wrapper } = createWrapper({ isDark: true })
      expect(wrapper.find('.oc-json-viewer div').classes()).toContain('jse-theme-dark')
    })
    it('does not use the dark theme if not enabled', () => {
      const { wrapper } = createWrapper({ isDark: false })
      expect(wrapper.find('.oc-json-viewer div').classes()).not.toContain('jse-theme-dark')
    })
  })
})

function createWrapper({
  currentContent = '{"foo": "bar"}',
  isDark = false
}: { currentContent?: string; isDark?: boolean } = {}) {
  return {
    wrapper: mount(App, {
      props: {
        resource: mock<Resource>(),
        applicationConfig: mock<AppConfigObject>(),
        currentContent,
        isReadOnly: false
      },
      global: {
        plugins: [...defaultPlugins({ piniaOptions: { themeState: { currentTheme: { isDark } } } })]
      }
    })
  }
}
