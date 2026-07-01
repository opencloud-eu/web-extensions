import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Chat from '../../src/views/Chat.vue'
import * as api from '../../src/services/api'

vi.mock('../../src/services/api', () => ({
  getConversations: vi.fn(),
  deleteConversation: vi.fn()
}))

describe('Chat view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getConversations).mockResolvedValue([
      { id: '1', name: 'Conversation 1', configId: 'config1', createdAt: Date.now(), updatedAt: Date.now() },
      { id: '2', name: 'Conversation 2', configId: 'config1', createdAt: Date.now(), updatedAt: Date.now() }
    ])
  })

  describe('rendering', () => {
    it('renders the empty state when no conversation is selected', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.empty-state').exists()).toBeTruthy()
      expect(wrapper.find('.empty-state h2').text()).toBe('Start a conversation')
    })

    it('renders the new chat button', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.new-chat-button').exists()).toBeTruthy()
      expect(wrapper.find('.new-chat-button').text()).toContain('New Conversation')
    })

    it('renders the settings button', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.settings-button').exists()).toBeTruthy()
      expect(wrapper.find('.settings-button').text()).toContain('Settings')
    })
  })

  describe('conversations', () => {
    it('loads conversations on mount', async () => {
      createWrapper()
      await vi.waitFor(() => {
        expect(api.getConversations).toHaveBeenCalled()
      })
    })

    it('displays loaded conversations', async () => {
      const { wrapper } = createWrapper()
      await wrapper.vm.$nextTick()
      await vi.waitFor(() => {
        expect(wrapper.findAll('.conversation-item')).toHaveLength(2)
      })
    })

    it('selects a conversation when clicked', async () => {
      const { wrapper } = createWrapper()
      await wrapper.vm.$nextTick()
      await vi.waitFor(async () => {
        const conversations = wrapper.findAll('.conversation-item')
        await conversations[0].trigger('click')
        expect(conversations[0].classes()).toContain('active')
      })
    })
  })

  describe('sidebar', () => {
    it('toggles sidebar when toggle button is clicked', async () => {
      const { wrapper } = createWrapper()
      const sidebar = wrapper.find('.sidebar')
      expect(sidebar.classes()).not.toContain('sidebar--close')

      await wrapper.find('.sidebar-toggle').trigger('click')
      expect(sidebar.classes()).toContain('sidebar--close')

      await wrapper.find('.sidebar-toggle-external').trigger('click')
      expect(sidebar.classes()).not.toContain('sidebar--close')
    })
  })

  describe('settings', () => {
    it('toggles settings area when settings button is clicked', async () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.settings-area').exists()).toBeFalsy()

      await wrapper.find('.settings-button').trigger('click')
      expect(wrapper.find('.settings-area').exists()).toBeTruthy()
    })
  })

  describe('new conversation', () => {
    it('creates a new conversation when new chat button is clicked', async () => {
      const { wrapper } = createWrapper()
      await wrapper.find('.new-chat-button').trigger('click')
      expect(wrapper.find('.empty-state').exists()).toBeFalsy()
      expect(wrapper.findComponent({ name: 'ChatWindow' }).exists()).toBeTruthy()
    })
  })
})

function createWrapper() {
  return {
    wrapper: mount(Chat, {
      global: {
        plugins: [...defaultPlugins()],
        stubs: {
          ChatWindow: true,
          ConfigSettings: true
        }
      }
    })
  }
}
