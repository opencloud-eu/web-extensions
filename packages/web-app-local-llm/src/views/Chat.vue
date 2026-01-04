<template>
  <main class="local-llm-chat">
    <button
      v-if="isSidebarCollapsed"
      class="sidebar-toggle-external"
      @click="toggleSidebar"
      title="Open navigation"
    >
      <span class="hamburger-icon">☰</span>
    </button>

    <aside :class="['sidebar', { 'sidebar--close': isSidebarCollapsed }]">
      <div class="sidebar-header">
        <div class="sidebar-header-top">
          <button class="new-chat-button" @click="createNewConversation">
            <span class="icon">+</span>
            New Conversation
          </button>
          <button
            class="sidebar-toggle"
            @click="toggleSidebar"
            title="Close navigation"
          >
            <span class="hamburger-icon">☰</span>
          </button>
        </div>
      </div>

      <div class="conversations-list">
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          :class="['conversation-item', { active: currentConversationId === conversation.id }]"
          @click="selectConversation(conversation.id)"
        >
          <span class="conversation-name">{{ conversation.name }}</span>
          <button
            class="delete-button"
            @click.stop="deleteConversation(conversation.id)"
            title="Delete conversation"
          >
            ×
          </button>
        </div>
      </div>

      <div class="sidebar-footer">
        <button class="settings-button" @click="showSettings = !showSettings">
          <span class="icon">⚙</span>
          Settings
        </button>

        <div v-if="showSettings" class="settings-area">
          <config-settings
            @config-updated="loadConversations"
          />
        </div>
      </div>
    </aside>

    <div class="main-content">
      <chat-window
        v-if="currentConversationId !== null || isNewConversation"
        :conversation-id="currentConversationId"
        :is-new="isNewConversation"
        @message-sent="handleMessageSent"
      />
      <div v-else class="empty-state">
        <div class="empty-icon">💬</div>
        <h2>Start a conversation</h2>
        <p>Click "New Conversation" to get started with your local LLM</p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ChatWindow from '../components/ChatWindow.vue'
import ConfigSettings from '../components/ConfigSettings.vue'
import { getConversations, deleteConversation as apiDeleteConversation } from '../services/api'

const conversations = ref<any[]>([])
const currentConversationId = ref<string | null>(null)
const isNewConversation = ref(false)
const showSettings = ref(false)
const isSidebarCollapsed = ref(false)

onMounted(() => {
  loadConversations()
})

async function loadConversations() {
  try {
    conversations.value = await getConversations()
  } catch (error) {
    console.error('Failed to load conversations:', error)
  }
}

function createNewConversation() {
  currentConversationId.value = null
  isNewConversation.value = true
}

function selectConversation(id: string) {
  currentConversationId.value = id
  isNewConversation.value = false
}

async function deleteConversation(id: string) {
  if (!confirm('Are you sure you want to delete this conversation?')) {
    return
  }

  try {
    await apiDeleteConversation(id)
    await loadConversations()
    if (currentConversationId.value === id) {
      currentConversationId.value = null
      isNewConversation.value = false
    }
  } catch (error) {
    console.error('Failed to delete conversation:', error)
  }
}

function handleMessageSent(conversationId: string) {
  if (isNewConversation.value) {
    currentConversationId.value = conversationId
    isNewConversation.value = false
    loadConversations()
  }
}

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
</script>

<style scoped>
.local-llm-chat {
  display: flex;
  width: 100%;
  min-height: calc(100vh - 60px);
  height: 100%;
  background: var(--oc-color-background-default);
  margin: 0;
  padding: 0;
  position: relative;
}

.sidebar-toggle-external {
  position: fixed;
  top: 72px;
  left: 16px;
  width: 44px;
  height: 44px;
  background: var(--oc-color-background-default);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.sidebar-toggle-external:hover {
  background: var(--oc-color-background-hover);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: light) {
  .sidebar-toggle-external {
    border-color: rgba(0, 0, 0, 0.2);
  }

  .sidebar-toggle-external:hover {
    border-color: rgba(0, 0, 0, 0.3);
  }
}

.sidebar-header-top {
  display: flex;
  gap: 8px;
  align-items: center;
}

.sidebar-toggle {
  width: 44px;
  height: 44px;
  min-width: 44px;
  background: var(--oc-color-background-default);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.sidebar-toggle:hover {
  background: var(--oc-color-background-hover);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: light) {
  .sidebar-toggle {
    border-color: rgba(0, 0, 0, 0.2);
  }

  .sidebar-toggle:hover {
    border-color: rgba(0, 0, 0, 0.3);
  }
}

.hamburger-icon {
  font-size: 22px;
  color: var(--oc-color-text-default);
  line-height: 1;
  user-select: none;
}

.sidebar {
  width: 420px;
  min-width: 420px;
  max-width: 420px;
  background: var(--oc-color-background-muted);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  position: relative;
  transition: margin-left 0.2s ease-in-out;
  margin-left: 0;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.sidebar.sidebar--close {
  margin-left: -420px;
}

@media (prefers-color-scheme: light) {
  .sidebar {
    border-right-color: rgba(0, 0, 0, 0.15);
  }
}

.sidebar-header {
  padding: 16px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

@media (prefers-color-scheme: light) {
  .sidebar-header {
    border-bottom-color: rgba(0, 0, 0, 0.1);
  }
}

.new-chat-button {
  flex: 1;
  padding: 12px;
  background: transparent;
  color: var(--oc-color-text-default);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  box-shadow: none;
  height: 44px;
}

.new-chat-button:hover {
  background: var(--oc-color-background-hover);
  border-color: rgba(255, 255, 255, 0.3);
}

@media (prefers-color-scheme: light) {
  .new-chat-button {
    border-color: rgba(0, 0, 0, 0.2);
  }

  .new-chat-button:hover {
    border-color: rgba(0, 0, 0, 0.3);
  }
}

.conversations-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.conversation-item {
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease-in-out;
  border: 2px solid rgba(255, 255, 255, 0.15);
  background: transparent;
}

.conversation-item:hover {
  background: var(--oc-color-background-hover);
  border-color: rgba(255, 255, 255, 0.25);
}

.conversation-item.active {
  background: var(--oc-color-swatch-primary-muted);
  border-color: rgba(255, 255, 255, 0.3);
}

@media (prefers-color-scheme: light) {
  .conversation-item {
    border-color: rgba(0, 0, 0, 0.15);
  }

  .conversation-item:hover {
    border-color: rgba(0, 0, 0, 0.25);
  }

  .conversation-item.active {
    border-color: rgba(0, 0, 0, 0.3);
  }
}

.conversation-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-button {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  font-size: 20px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.2s;
}

.conversation-item:hover .delete-button {
  opacity: 0.6;
}

.delete-button:hover {
  opacity: 1 !important;
  background: var(--oc-color-background-danger);
  color: white;
}

.sidebar-footer {
  border-top: 2px solid rgba(255, 255, 255, 0.1);
  max-height: 70vh;
  overflow-y: auto;
}

@media (prefers-color-scheme: light) {
  .sidebar-footer {
    border-top-color: rgba(0, 0, 0, 0.1);
  }
}

.settings-button {
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  text-align: left;
  transition: all 0.2s ease-in-out;
}

.settings-button:hover {
  background: var(--oc-color-background-hover);
}

@media (prefers-color-scheme: light) {
  .settings-button {
    border-bottom-color: rgba(0, 0, 0, 0.1);
  }
}

.settings-area {
  padding: 0;
  background: var(--oc-color-background-default);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: calc(100vh - 60px);
  overflow: hidden;
  transition: margin-left 0.2s ease-in-out;
  margin-left: 0;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
}

.sidebar--close ~ .main-content {
  margin-left: 60px;
}

@media (prefers-color-scheme: light) {
  .main-content {
    border-left-color: rgba(0, 0, 0, 0.1);
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--oc-color-text-muted);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h2 {
  margin: 0 0 8px 0;
  color: var(--oc-color-text-default);
}

.empty-state p {
  margin: 0;
}

.icon {
  font-size: 18px;
}
</style>
