import App from '../../src/App.vue'
import { mock } from 'vitest-mock-extended'
import { Resource } from '@opencloud-eu/web-client'
import { AppConfigObject } from '@opencloud-eu/web-pkg'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'

function createMockBpmnClass() {
  return class {
    importXML = vi.fn().mockResolvedValue({})
    saveSVG = vi.fn().mockResolvedValue({ svg: '<svg></svg>' })
    get = vi.fn().mockReturnValue({ zoom: vi.fn(), attachTo: vi.fn(), detach: vi.fn() })
    on = vi.fn()
    destroy = vi.fn()
  }
}

vi.mock('bpmn-js/lib/Modeler', () => ({
  default: createMockBpmnClass()
}))

vi.mock('bpmn-js/lib/Viewer', () => ({
  default: createMockBpmnClass()
}))

vi.mock('bpmn-js-properties-panel', () => ({
  BpmnPropertiesPanelModule: {},
  BpmnPropertiesProviderModule: {}
}))

vi.mock('diagram-js-minimap', () => ({
  default: {}
}))

describe('BPMN app', () => {
  it('renders the canvas container', () => {
    const { wrapper } = createWrapper()
    expect(wrapper.find('.bpmn-canvas').exists()).toBeTruthy()
  })

  it('renders the properties panel in edit mode', () => {
    const { wrapper } = createWrapper({ isReadOnly: false })
    expect(wrapper.find('.bpmn-properties').exists()).toBeTruthy()
  })

  it('hides the properties panel in read-only mode', () => {
    const { wrapper } = createWrapper({ isReadOnly: true })
    expect(wrapper.find('.bpmn-properties').exists()).toBeFalsy()
  })

  it('renders the toolbar', () => {
    const { wrapper } = createWrapper()
    expect(wrapper.find('.bpmn-toolbar').exists()).toBeTruthy()
  })

  it('shows fit and export buttons', () => {
    const { wrapper } = createWrapper()
    const buttons = wrapper.findAll('.bpmn-toolbar button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('shows the properties toggle button in edit mode', () => {
    const { wrapper } = createWrapper({ isReadOnly: false })
    const buttons = wrapper.findAll('.bpmn-toolbar button')
    expect(buttons.length).toBe(3)
  })

  it('hides the properties toggle button in read-only mode', () => {
    const { wrapper } = createWrapper({ isReadOnly: true })
    const buttons = wrapper.findAll('.bpmn-toolbar button')
    expect(buttons.length).toBe(2)
  })
})

function createWrapper({ isReadOnly = false }: { isReadOnly?: boolean } = {}) {
  return {
    wrapper: mount(App, {
      props: {
        resource: mock<Resource>(),
        applicationConfig: mock<AppConfigObject>(),
        currentContent: '',
        isReadOnly,
        isDirty: false
      },
      global: { plugins: [...defaultPlugins()] }
    })
  }
}
