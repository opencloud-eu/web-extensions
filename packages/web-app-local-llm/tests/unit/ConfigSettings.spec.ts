import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ConfigSettings from '../../src/components/ConfigSettings.vue'
import * as api from '../../src/services/api'

vi.mock('../../src/services/api', () => ({
  getConfigs: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  deleteConfig: vi.fn(),
  setDefaultConfig: vi.fn(),
  testConnection: vi.fn()
}))

// Mock global alert and confirm
global.alert = vi.fn()
global.confirm = vi.fn(() => true)

describe('ConfigSettings component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getConfigs).mockResolvedValue([
      {
        id: 'config1',
        name: 'Ollama Local',
        apiUrl: 'http://localhost:11434/v1/chat/completions',
        apiToken: 'ollama',
        modelName: 'llama2',
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt: 'You are a helpful assistant.',
        isDefault: true
      },
      {
        id: 'config2',
        name: 'LM Studio',
        apiUrl: 'http://localhost:1234/v1/chat/completions',
        apiToken: 'lm-studio',
        modelName: 'mistral',
        temperature: 0.5,
        maxTokens: 2048,
        systemPrompt: 'You are a helpful assistant.',
        isDefault: false
      }
    ])
  })

  describe('rendering', () => {
    it('renders the settings header', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.settings-header h3').text()).toBe('LLM Configurations')
    })

    it('loads configs on mount', async () => {
      createWrapper()
      await vi.waitFor(() => {
        expect(api.getConfigs).toHaveBeenCalled()
      })
    })

    it('displays loaded configs', async () => {
      const { wrapper } = createWrapper()
      await wrapper.vm.$nextTick()
      await vi.waitFor(() => {
        const configs = wrapper.findAll('.config-item')
        expect(configs).toHaveLength(2)
      })
    })

    it('shows default badge for default config', async () => {
      const { wrapper } = createWrapper()
      await wrapper.vm.$nextTick()
      await vi.waitFor(() => {
        const badge = wrapper.find('.badge')
        expect(badge.text()).toBe('Default')
      })
    })

    it('displays config details', async () => {
      const { wrapper } = createWrapper()
      await wrapper.vm.$nextTick()
      await vi.waitFor(() => {
        const details = wrapper.find('.config-details')
        expect(details.text()).toContain('http://localhost:11434/v1/chat/completions')
        expect(details.text()).toContain('llama2')
        expect(details.text()).toContain('0.7')
      })
    })
  })

  describe('adding configuration', () => {
    it('shows add configuration button', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.add-button').exists()).toBeTruthy()
      expect(wrapper.find('.add-button').text()).toBe('+ Add Configuration')
    })

    it('toggles new config form when add button is clicked', async () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.new-config-form').exists()).toBeFalsy()

      await wrapper.find('.add-button').trigger('click')
      expect(wrapper.find('.new-config-form').exists()).toBeTruthy()

      await wrapper.find('.add-button').trigger('click')
      expect(wrapper.find('.new-config-form').exists()).toBeFalsy()
    })

    it('displays form fields in new config form', async () => {
      const { wrapper } = createWrapper()
      await wrapper.find('.add-button').trigger('click')

      expect(wrapper.find('input[type="text"]').exists()).toBeTruthy()
      expect(wrapper.find('input[type="password"]').exists()).toBeTruthy()
      expect(wrapper.find('input[type="number"]').exists()).toBeTruthy()
    })
  })

  describe('config actions', () => {
    it('calls setDefaultConfig when star button is clicked', async () => {
      vi.mocked(api.setDefaultConfig).mockResolvedValue(undefined)
      const { wrapper } = createWrapper()
      await wrapper.vm.$nextTick()

      await vi.waitFor(async () => {
        const configItems = wrapper.findAll('.config-item')
        const nonDefaultConfig = configItems[1]
        const starButton = nonDefaultConfig.findAll('.action-button')[0]
        await starButton.trigger('click')

        expect(api.setDefaultConfig).toHaveBeenCalledWith('config2')
      })
    })

    it('calls testConnection when test button is clicked', async () => {
      vi.mocked(api.testConnection).mockResolvedValue({ success: true, message: 'Connected' })
      const { wrapper } = createWrapper()
      await wrapper.vm.$nextTick()

      await vi.waitFor(async () => {
        const testButtons = wrapper.findAll('.action-button')
        const testButton = testButtons.find(btn => btn.attributes('title') === 'Test connection')
        await testButton?.trigger('click')

        expect(api.testConnection).toHaveBeenCalled()
      })
    })

    it('calls deleteConfig when delete button is clicked', async () => {
      vi.mocked(api.deleteConfig).mockResolvedValue(undefined)

      const { wrapper } = createWrapper()
      await wrapper.vm.$nextTick()

      await vi.waitFor(async () => {
        const deleteButtons = wrapper.findAll('.action-button.danger')
        await deleteButtons[0].trigger('click')

        expect(api.deleteConfig).toHaveBeenCalled()
      })
    })
  })

  describe('emitting events', () => {
    it('emits config-updated event after saving', async () => {
      vi.mocked(api.createConfig).mockResolvedValue({ id: 'new-config', name: 'New Config' } as any)
      const { wrapper } = createWrapper()
      await wrapper.find('.add-button').trigger('click')

      await wrapper.vm.$nextTick()
      const form = wrapper.find('.new-config-form')
      const inputs = form.findAll('input')

      await inputs[0].setValue('New Config')
      await inputs[1].setValue('http://localhost:11434/v1/chat/completions')
      await inputs[2].setValue('ollama')
      await inputs[3].setValue('llama2')

      const saveButton = wrapper.findAll('button').find(btn => btn.text().includes('Save'))
      if (saveButton) {
        await saveButton.trigger('click')

        await vi.waitFor(() => {
          expect(wrapper.emitted('config-updated')).toBeTruthy()
        })
      }
    })
  })
})

function createWrapper() {
  return {
    wrapper: mount(ConfigSettings, {
      global: {
        plugins: [...defaultPlugins()]
      }
    })
  }
}
