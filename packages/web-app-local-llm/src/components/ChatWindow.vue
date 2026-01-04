<template>
  <div class="chat-window">
    <div v-if="isNew && !conversationId" class="model-selector">
      <label>Choose Model:</label>
      <select v-model="selectedConfigId">
        <option v-for="config in availableConfigs" :key="config.id" :value="config.id">
          {{ config.name }} - {{ config.modelName }}
        </option>
      </select>
    </div>

    <div class="messages-container" ref="messagesContainer">
      <div v-if="loading" class="loading">
        <div class="loading-spinner"></div>
        Loading messages...
      </div>
      <div v-else-if="messages.length === 0" class="empty-messages">
        <p>No messages yet. Start the conversation!</p>
      </div>
      <div v-else>
        <div
          v-for="message in messages"
          :key="message.id"
          :class="['message', `message-${message.role}`]"
        >
          <div class="message-header">
            <span class="message-role">
              {{ message.role === 'user' ? 'You' : 'Assistant' }}
            </span>
            <span class="message-time">
              {{ formatTime(message.timestamp) }}
            </span>
          </div>
          <div class="message-content">
            {{ message.content }}
          </div>
        </div>
      </div>
    </div>

    <div class="input-container">
      <textarea
        v-model="currentMessage"
        placeholder="Type your message..."
        :disabled="sending"
        @keydown.enter.exact.prevent="sendMessage"
        @keydown.enter.shift.exact="addNewLine"
        rows="3"
      />
      <button
        :disabled="!currentMessage.trim() || sending"
        @click="sendMessage"
        class="send-button"
      >
        <span v-if="sending" class="loading-spinner-small"></span>
        <span v-else>Send</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { sendMessage as apiSendMessage, getMessages, getConfigs } from '../services/api'

const props = defineProps<{
  conversationId: string | null
  isNew: boolean
}>()

const emit = defineEmits<{
  (e: 'message-sent', conversationId: string): void
}>()

const messages = ref<any[]>([])
const currentMessage = ref('')
const sending = ref(false)
const loading = ref(false)
const availableConfigs = ref<any[]>([])
const selectedConfigId = ref<string | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  loadConfigs()
})

watch(() => props.conversationId, (newId) => {
  if (newId) {
    loadMessages()
  } else {
    messages.value = []
  }
}, { immediate: true })

async function loadConfigs() {
  try {
    availableConfigs.value = await getConfigs()
    const defaultConfig = availableConfigs.value.find(c => c.isDefault)
    if (defaultConfig) {
      selectedConfigId.value = defaultConfig.id
    } else if (availableConfigs.value.length > 0) {
      selectedConfigId.value = availableConfigs.value[0].id
    }
  } catch (error) {
    console.error('Failed to load configs:', error)
  }
}

async function loadMessages() {
  if (!props.conversationId) {
    return
  }

  loading.value = true
  try {
    messages.value = await getMessages(props.conversationId)
    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('Failed to load messages:', error)
  } finally {
    loading.value = false
  }
}

async function sendMessage() {
  if (!currentMessage.value.trim() || sending.value) {
    return
  }

  const messageText = currentMessage.value.trim()
  currentMessage.value = ''
  sending.value = true

  try {
    const configId = (props.isNew && !props.conversationId) ? selectedConfigId.value : null
    const response = await apiSendMessage(props.conversationId, messageText, configId)

    messages.value.push(response.userMessage)
    messages.value.push(response.assistantMessage)

    if (props.isNew || !props.conversationId) {
      emit('message-sent', response.conversationId)
    }

    await nextTick()
    scrollToBottom()
  } catch (error: any) {
    console.error('Failed to send message:', error)
    alert(error.message || 'Failed to send message')
  } finally {
    sending.value = false
  }
}

function addNewLine() {
  currentMessage.value += '\n'
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function formatTime(timestamp: number) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.chat-window {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.model-selector {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--oc-color-background-muted);
  border-radius: 8px;
  border: 1px solid var(--oc-color-border);
}

.model-selector label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.model-selector select {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--oc-color-border);
  border-radius: 4px;
  background: var(--oc-color-background-default);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
  padding: 16px;
  background: var(--oc-color-background-default);
  border-radius: 8px;
  border: 1px solid var(--oc-color-border);
}

.loading,
.empty-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--oc-color-text-muted);
  gap: 12px;
}

.message {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.2s ease-in-out;
}

.message-user {
  background: #14232c;
  border-color: rgba(255, 255, 255, 0.15);
  margin-left: 20%;
}

.message-assistant {
  background: #292929;
  border-color: rgba(255, 255, 255, 0.1);
  margin-right: 20%;
}

@media (prefers-color-scheme: light) {
  .message-user {
    border-color: rgba(0, 0, 0, 0.15);
  }

  .message-assistant {
    border-color: rgba(0, 0, 0, 0.1);
  }
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.875rem;
  opacity: 0.8;
}

.message-role {
  font-weight: 600;
}

.message-content {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.input-container {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  border: 1px solid var(--oc-color-border);
}

.input-container textarea {
  flex: 1;
  padding: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  resize: vertical;
  font-family: inherit;
  font-size: 14px;
  background: var(--oc-color-background-default);
  color: var(--oc-color-text-default);
  transition: border-color 0.2s ease-in-out;
}

.input-container textarea:focus {
  outline: none;
  border-color: var(--oc-color-swatch-primary-default);
}

@media (prefers-color-scheme: light) {
  .input-container textarea {
    border-color: rgba(0, 0, 0, 0.2);
  }
}

.send-button {
  padding: 12px 24px;
  background: var(--oc-color-swatch-primary-default);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
  min-width: 80px;
  transition: all 0.2s ease-in-out;
}

.send-button:hover:not(:disabled) {
  background: var(--oc-color-swatch-primary-hover);
  border-color: rgba(255, 255, 255, 0.3);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-color-scheme: light) {
  .send-button {
    border-color: rgba(0, 0, 0, 0.2);
  }

  .send-button:hover:not(:disabled) {
    border-color: rgba(0, 0, 0, 0.3);
  }
}
</style>
