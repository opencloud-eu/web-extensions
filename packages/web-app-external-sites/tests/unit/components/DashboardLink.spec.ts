import DashboardLink from '../../../src/components/DashboardLink.vue'
import { ExternalSite } from '../../../src/types'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'

describe('dashboard link', () => {
  it('shows the icon of a site as an application icon', () => {
    const { wrapper } = createWrapper({ icon: 'book' })

    expect(wrapper.find('.oc-application-icon').exists()).toBe(true)
  })

  it('uses the color of a site as the background of its icon', () => {
    const { wrapper } = createWrapper({ icon: 'book', color: '#0d856f' })

    expect(wrapper.find('.oc-application-icon').attributes('style')).toContain('#0d856f')
  })

  it('shows a site without a color whose icon name the host cannot derive a color from', () => {
    const { wrapper } = createWrapper({ icon: 'key' })

    expect(wrapper.find('.oc-application-icon').attributes('style')).toContain('#01985c')
  })

  it('shows no icon for a site without one', () => {
    const { wrapper } = createWrapper({})

    expect(wrapper.find('.oc-application-icon').exists()).toBe(false)
  })
})

function createWrapper(site: Partial<ExternalSite>) {
  return {
    wrapper: mount(DashboardLink, {
      props: {
        site: { name: 'Docs', url: 'https://docs.example.org', target: 'external', ...site },
        dashboardPath: '/'
      },
      global: { plugins: [...defaultPlugins()] }
    })
  }
}
