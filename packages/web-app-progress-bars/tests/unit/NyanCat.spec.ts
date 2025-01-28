import { defaultComponentMocks, defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import NyanCat from '../../src/NyanCat.vue'

describe('nyan cat progress bar', () => {
  describe('loading', () => {
    it('renders the progress bar in a loading state', () => {
      const { wrapper } = createWrapper({ isLoading: true })
      expect(wrapper.find('#nyan-cat-progress-bar').exists()).toBeTruthy()
    })
    it('does not render the progress bar when not in a loading state', () => {
      const { wrapper } = createWrapper({ isLoading: false })
      expect(wrapper.find('#nyan-cat-progress-bar').exists()).toBeFalsy()
    })
  })
})

function createWrapper({ isLoading = false }: { isLoading?: boolean } = {}) {
  const mocks = { ...defaultComponentMocks() }
  vi.mocked(mocks.$loadingService).isLoading = isLoading

  return {
    wrapper: mount(NyanCat, {
      global: {
        plugins: [...defaultPlugins()],
        mocks,
        provide: mocks
      }
    })
  }
}
