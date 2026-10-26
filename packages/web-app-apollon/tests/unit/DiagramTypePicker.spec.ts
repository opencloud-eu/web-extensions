import DiagramTypePicker from '../../src/DiagramTypePicker.vue'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'

describe('DiagramTypePicker', () => {
  it('shows a card for every diagram type', () => {
    const { wrapper } = createWrapper()

    expect(wrapper.findAll('[data-diagram-type]')).toHaveLength(13)
    expect(wrapper.find('[role="status"]').text()).toBe('13 diagram types')
  })

  it('emits the diagram type of a clicked card', async () => {
    const { wrapper } = createWrapper()

    await wrapper.find('[data-diagram-type="BPMN"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['BPMN']])
  })

  it('filters the cards by the search term', async () => {
    const { wrapper } = createWrapper()

    await wrapper.find('input').setValue('tokens')

    expect(
      wrapper.findAll('[data-diagram-type]').map((card) => card.attributes('data-diagram-type'))
    ).toEqual(['PetriNet'])
    expect(wrapper.find('[role="status"]').text()).toBe('1 diagram type')
  })

  it('shows a no content message when nothing matches', async () => {
    const { wrapper } = createWrapper()

    await wrapper.find('input').setValue('zzz')

    expect(wrapper.findAll('[data-diagram-type]')).toHaveLength(0)
    expect(wrapper.find('.no-content-message').text()).toContain('No diagram types found')
  })
})

function createWrapper() {
  return {
    wrapper: mount(DiagramTypePicker, {
      global: {
        plugins: [...defaultPlugins()],
        stubs: {
          InlineSvg: true,
          NoContentMessage: {
            template: '<div class="no-content-message"><slot name="message" /></div>'
          }
        }
      }
    })
  }
}
