import App from '../../src/App.vue'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'

describe('external sites app', () => {
  it('uses the given name and url for the iFrame title and source', () => {
    const name = 'fooBar'
    const url = 'https://foo.bar'
    const { wrapper } = createWrapper({ name, url })

    expect(wrapper.find('iFrame').attributes('title')).equal(name)
    expect(wrapper.find('iFrame').attributes('src').startsWith(url)).toBeTruthy()
  })
})

function createWrapper({ name = '', url = '' }: { name?: string; url?: string } = {}) {
  return {
    wrapper: mount(App, {
      props: { name, url },
      global: { plugins: [...defaultPlugins()] }
    })
  }
}
