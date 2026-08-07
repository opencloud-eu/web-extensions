// Local storage keys
const CONVERSATIONS_KEY = 'local-llm-conversations'
const MESSAGES_KEY = 'local-llm-messages'
const CONFIGS_KEY = 'local-llm-configs'

// Types
export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface Conversation {
  id: string
  name: string
  configId: string
  createdAt: number
  updatedAt: number
}

export interface Config {
  id: string
  name: string
  apiUrl: string
  apiToken: string
  modelName: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  isDefault: boolean
}

// Helper functions for local storage
function getFromStorage<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(key)
  if (!data) return defaultValue
  try {
    return JSON.parse(data)
  } catch {
    return defaultValue
  }
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// Generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

// Conversations API
export async function getConversations(): Promise<Conversation[]> {
  const conversations = getFromStorage<Conversation[]>(CONVERSATIONS_KEY, [])
  return conversations.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const conversations = getFromStorage<Conversation[]>(CONVERSATIONS_KEY, [])
  return conversations.find(c => c.id === id) || null
}

export async function createConversation(name: string, configId: string): Promise<Conversation> {
  const conversations = getFromStorage<Conversation[]>(CONVERSATIONS_KEY, [])
  const newConversation: Conversation = {
    id: generateId(),
    name,
    configId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  conversations.push(newConversation)
  saveToStorage(CONVERSATIONS_KEY, conversations)
  return newConversation
}

export async function deleteConversation(id: string): Promise<void> {
  const conversations = getFromStorage<Conversation[]>(CONVERSATIONS_KEY, [])
  const filtered = conversations.filter(c => c.id !== id)
  saveToStorage(CONVERSATIONS_KEY, filtered)

  // Also delete associated messages
  const messages = getFromStorage<Message[]>(MESSAGES_KEY, [])
  const filteredMessages = messages.filter(m => m.conversationId !== id)
  saveToStorage(MESSAGES_KEY, filteredMessages)
}

// Messages API
export async function getMessages(conversationId: string): Promise<Message[]> {
  const messages = getFromStorage<Message[]>(MESSAGES_KEY, [])
  return messages
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => a.timestamp - b.timestamp)
}

export async function addMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
  const messages = getFromStorage<Message[]>(MESSAGES_KEY, [])
  const newMessage: Message = {
    ...message,
    id: generateId(),
    timestamp: Date.now(),
  }
  messages.push(newMessage)
  saveToStorage(MESSAGES_KEY, messages)
  return newMessage
}

// Send message to LLM
export async function sendMessage(
  conversationId: string | null,
  message: string,
  configId: string | null
): Promise<{
  conversationId: string
  userMessage: Message
  assistantMessage: Message
}> {
  // Get or create conversation
  let conversation: Conversation | null = null

  if (conversationId) {
    conversation = await getConversation(conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }
  } else {
    // Create new conversation
    if (!configId) {
      throw new Error('Config ID is required for new conversations')
    }
    const firstWords = message.split(' ').slice(0, 5).join(' ')
    conversation = await createConversation(
      firstWords.length > 30 ? firstWords.substring(0, 30) + '...' : firstWords,
      configId
    )
  }

  // Get config
  const config = await getConfig(conversation.configId)
  if (!config) {
    throw new Error('Configuration not found')
  }

  // Add user message
  const userMessage = await addMessage({
    conversationId: conversation.id,
    role: 'user',
    content: message,
  })

  // Get conversation history
  const history = await getMessages(conversation.id)

  // Build messages for LLM API
  const apiMessages = [
    { role: 'system', content: config.systemPrompt },
    ...history.filter(m => m.id !== userMessage.id).map(m => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  try {
    // Call LLM API directly
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: apiMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || errorData.message || `LLM API error: ${response.status}`)
    }

    const data = await response.json()
    const assistantContent = data.choices?.[0]?.message?.content

    if (!assistantContent) {
      throw new Error('No response from LLM')
    }

    // Add assistant message
    const assistantMessage = await addMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantContent,
    })

    // Update conversation timestamp
    const conversations = getFromStorage<Conversation[]>(CONVERSATIONS_KEY, [])
    const updated = conversations.map(c =>
      c.id === conversation!.id ? { ...c, updatedAt: Date.now() } : c
    )
    saveToStorage(CONVERSATIONS_KEY, updated)

    return {
      conversationId: conversation.id,
      userMessage,
      assistantMessage,
    }
  } catch (error: any) {
    console.error('Error calling LLM API:', error)

    // Provide helpful error messages
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to LLM server. Make sure the API URL is correct and the server is accessible.')
    }

    throw new Error(error.message || 'Failed to get response from LLM')
  }
}

// Configs API
export async function getConfigs(): Promise<Config[]> {
  const configs = getFromStorage<Config[]>(CONFIGS_KEY, [])

  // If no configs exist, create a default one
  if (configs.length === 0) {
    const defaultConfig: Config = {
      id: generateId(),
      name: 'Default Ollama',
      apiUrl: 'http://localhost:11434/v1/chat/completions',
      apiToken: 'ollama',
      modelName: 'llama3.2',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: 'You are a helpful AI assistant. Help users with their tasks, answer questions, and provide insights. Keep responses clear, concise, and professional.',
      isDefault: true,
    }
    configs.push(defaultConfig)
    saveToStorage(CONFIGS_KEY, configs)
  }

  return configs
}

export async function getConfig(id: string): Promise<Config | null> {
  const configs = await getConfigs()
  return configs.find(c => c.id === id) || null
}

export async function createConfig(config: Omit<Config, 'id' | 'isDefault'>): Promise<Config> {
  const configs = getFromStorage<Config[]>(CONFIGS_KEY, [])
  const newConfig: Config = {
    ...config,
    id: generateId(),
    isDefault: configs.length === 0,
  }
  configs.push(newConfig)
  saveToStorage(CONFIGS_KEY, configs)
  return newConfig
}

export async function updateConfig(id: string, updates: Partial<Config>): Promise<Config> {
  const configs = getFromStorage<Config[]>(CONFIGS_KEY, [])
  const index = configs.findIndex(c => c.id === id)

  if (index === -1) {
    throw new Error('Config not found')
  }

  configs[index] = { ...configs[index], ...updates, id }
  saveToStorage(CONFIGS_KEY, configs)
  return configs[index]
}

export async function deleteConfig(id: string): Promise<void> {
  const configs = getFromStorage<Config[]>(CONFIGS_KEY, [])
  const filtered = configs.filter(c => c.id !== id)

  if (filtered.length === 0) {
    throw new Error('Cannot delete the last configuration')
  }

  saveToStorage(CONFIGS_KEY, filtered)
}

export async function testConnection(id: string): Promise<{ success: boolean; message?: string }> {
  const config = await getConfig(id)

  if (!config) {
    return { success: false, message: 'Configuration not found' }
  }

  try {
    // Test connection by sending a simple request to the LLM API
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 10,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || errorData.message || `Error: ${response.status}`
      return { success: false, message: errorMessage }
    }

    const data = await response.json()

    if (data.choices?.[0]?.message?.content) {
      return { success: true, message: 'Connection successful!' }
    } else {
      return { success: false, message: 'Unexpected response format from LLM API' }
    }
  } catch (error: any) {
    if (error.message.includes('Failed to fetch')) {
      return {
        success: false,
        message: 'Cannot connect to LLM server. Make sure the API URL is correct and the server is accessible.'
      }
    }

    return { success: false, message: error.message || 'Connection failed' }
  }
}

export async function setDefaultConfig(id: string): Promise<void> {
  const configs = getFromStorage<Config[]>(CONFIGS_KEY, [])
  const updated = configs.map(c => ({
    ...c,
    isDefault: c.id === id,
  }))
  saveToStorage(CONFIGS_KEY, updated)
}
