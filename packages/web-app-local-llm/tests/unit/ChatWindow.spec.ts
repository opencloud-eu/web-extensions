import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ChatWindow from '../../src/components/ChatWindow.vue'
import * as api from '../../src/services/api'

vi.mock('../../src/services/api', () => ({
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  getConfigs: vi.fn()
}))

// Mock global alert
global.alert = vi.fn()

describe('ChatWindow component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getConfigs).mockResolvedValue([
      {
        id: 'config1',
        name: 'Config 1',
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
        name: 'Config 2',
        apiUrl: 'http://localhost:1234/v1/chat/completions',
        apiToken: 'lm-studio',
        modelName: 'mistral',
        temperature: 0.5,
        maxTokens: 2048,
        systemPrompt: 'You are a helpful assistant.',
        isDefault: false
      }
    ])
    vi.mocked(api.getMessages).mockResolvedValue([
      { id: '1', conversationId: 'conv1', role: 'user', content: 'Hello', timestamp: Date.now() },
      { id: '2', conversationId: 'conv1', role: 'assistant', content: 'Hi there!', timestamp: Date.now() }
    ])
  })

  describe('new conversation', () => {
    it('shows model selector for new conversations', () => {
      const { wrapper } = createWrapper({ conversationId: null, isNew: true })
      expect(wrapper.find('.model-selector').exists()).toBeTruthy()
    })

    it('loads available configs on mount', async () => {
      createWrapper({ conversationId: null, isNew: true })
      await vi.waitFor(() => {
        expect(api.getConfigs).toHaveBeenCalled()
      })
    })

    it('shows empty state when no messages', () => {
      vi.mocked(api.getMessages).mockResolvedValue([])
      const { wrapper } = createWrapper({ conversationId: null, isNew: true })
      expect(wrapper.find('.empty-messages').exists()).toBeTruthy()
    })
  })

  describe('existing conversation', () => {
    it('loads messages for existing conversation', async () => {
      createWrapper({ conversationId: 'conv1', isNew: false })
      await vi.waitFor(() => {
        expect(api.getMessages).toHaveBeenCalledWith('conv1')
      })
    })

    it('displays loaded messages', async () => {
      const { wrapper } = createWrapper({ conversationId: 'conv1', isNew: false })
      await wrapper.vm.$nextTick()
      await vi.waitFor(() => {
        const messages = wrapper.findAll('.message')
        expect(messages).toHaveLength(2)
        expect(messages[0].classes()).toContain('message-user')
        expect(messages[1].classes()).toContain('message-assistant')
      })
    })

    it('does not show model selector for existing conversation', () => {
      const { wrapper } = createWrapper({ conversationId: 'conv1', isNew: false })
      expect(wrapper.find('.model-selector').exists()).toBeFalsy()
    })
  })

  describe('message input', () => {
    it('renders message input textarea', () => {
      const { wrapper } = createWrapper({ conversationId: null, isNew: true })
      expect(wrapper.find('textarea').exists()).toBeTruthy()
      expect(wrapper.find('textarea').attributes('placeholder')).toBe('Type your message...')
    })

    it('renders send button', () => {
      const { wrapper } = createWrapper({ conversationId: null, isNew: true })
      expect(wrapper.find('.send-button').exists()).toBeTruthy()
    })

    it('disables send button when message is empty', () => {
      const { wrapper } = createWrapper({ conversationId: null, isNew: true })
      expect(wrapper.find('.send-button').attributes('disabled')).toBeDefined()
    })

    it('enables send button when message has content', async () => {
      const { wrapper } = createWrapper({ conversationId: null, isNew: true })
      await wrapper.find('textarea').setValue('Hello')
      expect(wrapper.find('.send-button').attributes('disabled')).toBeUndefined()
    })
  })

  describe('sending messages', () => {
    it('calls sendMessage API when send button is clicked', async () => {
      vi.mocked(api.sendMessage).mockResolvedValue({
        conversationId: 'new-conv',
        userMessage: { id: '3', conversationId: 'new-conv', role: 'user', content: 'Test message', timestamp: Date.now() },
        assistantMessage: { id: '4', conversationId: 'new-conv', role: 'assistant', content: 'Response', timestamp: Date.now() }
      })

      const { wrapper } = createWrapper({ conversationId: null, isNew: true })
      await wrapper.vm.$nextTick()

      await wrapper.find('textarea').setValue('Test message')
      await wrapper.find('.send-button').trigger('click')

      await vi.waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalled()
      })
    })

    it('emits message-sent event after sending', async () => {
      vi.mocked(api.sendMessage).mockResolvedValue({
        conversationId: 'new-conv',
        userMessage: { id: '3', conversationId: 'new-conv', role: 'user', content: 'Test', timestamp: Date.now() },
        assistantMessage: { id: '4', conversationId: 'new-conv', role: 'assistant', content: 'Response', timestamp: Date.now() }
      })

      const { wrapper } = createWrapper({ conversationId: null, isNew: true })
      await wrapper.vm.$nextTick()

      await wrapper.find('textarea').setValue('Test')
      await wrapper.find('.send-button').trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.emitted('message-sent')).toBeTruthy()
        expect(wrapper.emitted('message-sent')?.[0]).toEqual(['new-conv'])
      })
    })
  })
})

function createWrapper({ conversationId, isNew }: { conversationId: string | null; isNew: boolean }) {
  return {
    wrapper: mount(ChatWindow, {
      props: {
        conversationId,
        isNew
      },
      global: {
        plugins: [...defaultPlugins()]
      }
    })
  }
}
