<template>
  <div class="config-settings-inline">
    <div class="settings-header">
      <h3>LLM Configurations</h3>
    </div>

    <div class="settings-body">
        <div v-if="loading" class="loading">
          <div class="loading-spinner"></div>
        </div>

        <div v-else>
          <div v-for="config in configs" :key="config.id" class="config-item">
            <div class="config-header">
              <h4>
                {{ config.name }}
                <span v-if="config.isDefault" class="badge">Default</span>
              </h4>
              <div class="config-actions">
                <button
                  v-if="!config.isDefault"
                  @click="setDefault(config.id)"
                  title="Set as default"
                  class="action-button"
                >
                  ⭐
                </button>
                <button
                  @click="editConfig(config)"
                  title="Edit"
                  class="action-button"
                >
                  ✏️
                </button>
                <button
                  @click="testConfig(config.id)"
                  title="Test connection"
                  class="action-button"
                >
                  ✓
                </button>
                <button
                  @click="deleteConfigItem(config.id)"
                  title="Delete"
                  class="action-button danger"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div class="config-details">
              <p><strong>API URL:</strong> {{ config.apiUrl }}</p>
              <p><strong>Model:</strong> {{ config.modelName }}</p>
              <p><strong>Temperature:</strong> {{ config.temperature }}</p>
            </div>
          </div>

          <button class="add-button" @click="showNewConfigForm = !showNewConfigForm">
            + Add Configuration
          </button>

          <div v-if="showNewConfigForm" class="new-config-form">
            <h4>{{ editingConfig ? 'Edit Configuration' : 'New Configuration' }}</h4>
            <div class="form-group">
              <label>Name</label>
              <input v-model="newConfig.name" type="text" required />
            </div>
            <div class="form-group">
              <label>API URL</label>
              <input
                v-model="newConfig.apiUrl"
                type="text"
                placeholder="http://localhost:11434/v1/chat/completions"
                required
              />
            </div>
            <div class="form-group">
              <label>API Token</label>
              <input
                v-model="newConfig.apiToken"
                type="password"
                placeholder="ollama"
                required
              />
            </div>
            <div class="form-group">
              <label>Model Name</label>
              <input
                v-model="newConfig.modelName"
                type="text"
                placeholder="llama3.2"
                required
              />
            </div>
            <div class="form-group">
              <label>Temperature (0-2)</label>
              <input
                v-model.number="newConfig.temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
              />
            </div>
            <div class="form-group">
              <label>Max Tokens</label>
              <input
                v-model.number="newConfig.maxTokens"
                type="number"
                min="128"
                max="32768"
              />
            </div>
            <div class="form-group">
              <label>System Prompt</label>
              <textarea v-model="newConfig.systemPrompt" rows="3" />
            </div>
            <div class="form-actions">
              <button class="save-button" @click="saveConfig">
                {{ editingConfig ? 'Update' : 'Save' }}
              </button>
              <button class="cancel-button" @click="cancelConfigForm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  testConnection,
  setDefaultConfig,
} from '../services/api'

const emit = defineEmits<{
  (e: 'config-updated'): void
}>()

const configs = ref<any[]>([])
const loading = ref(false)
const showNewConfigForm = ref(false)
const editingConfig = ref<string | null>(null)
const newConfig = ref(getEmptyConfig())

onMounted(() => {
  loadConfigs()
})

async function loadConfigs() {
  loading.value = true
  try {
    configs.value = await getConfigs()
  } catch (error) {
    console.error('Failed to load configs:', error)
    alert('Failed to load configurations')
  } finally {
    loading.value = false
  }
}

function getEmptyConfig() {
  return {
    name: '',
    apiUrl: 'http://localhost:11434/v1/chat/completions',
    apiToken: 'ollama',
    modelName: 'llama3.2',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful AI assistant. Help users with their tasks, answer questions, and provide insights. Keep responses clear, concise, and professional.',
  }
}

function editConfig(config: any) {
  editingConfig.value = config.id
  newConfig.value = {
    name: config.name,
    apiUrl: config.apiUrl,
    apiToken: '',
    modelName: config.modelName,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    systemPrompt: config.systemPrompt,
  }
  showNewConfigForm.value = true
}

async function saveConfig() {
  try {
    if (editingConfig.value) {
      await updateConfig(editingConfig.value, newConfig.value)
      alert('Configuration updated')
    } else {
      await createConfig(newConfig.value)
      alert('Configuration created')
    }
    await loadConfigs()
    cancelConfigForm()
    emit('config-updated')
  } catch (error: any) {
    console.error('Failed to save config:', error)
    alert(error.message || (editingConfig.value ? 'Failed to update configuration' : 'Failed to create configuration'))
  }
}

function cancelConfigForm() {
  showNewConfigForm.value = false
  editingConfig.value = null
  newConfig.value = getEmptyConfig()
}

async function deleteConfigItem(id: string) {
  if (!confirm('Are you sure you want to delete this configuration?')) {
    return
  }

  try {
    await deleteConfig(id)
    await loadConfigs()
    alert('Configuration deleted')
    emit('config-updated')
  } catch (error: any) {
    console.error('Failed to delete config:', error)
    alert(error.message || 'Failed to delete configuration')
  }
}

async function testConfig(id: string) {
  try {
    const result = await testConnection(id)
    if (result.success) {
      alert('Connection successful!')
    } else {
      alert(result.message || 'Connection failed')
    }
  } catch (error: any) {
    console.error('Failed to test connection:', error)
    alert(error.message || 'Connection failed')
  }
}

async function setDefault(id: string) {
  try {
    await setDefaultConfig(id)
    await loadConfigs()
    alert('Default configuration updated')
    emit('config-updated')
  } catch (error) {
    console.error('Failed to set default:', error)
    alert('Failed to update default configuration')
  }
}
</script>

<style scoped>
.config-settings-inline {
  display: flex;
  flex-direction: column;
}

.settings-header {
  padding: 16px;
  border-bottom: 1px solid var(--oc-color-border);
}

.settings-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.settings-body {
  padding: 16px;
  overflow-y: auto;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.config-item {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--oc-color-border);
  border-radius: 6px;
  background: var(--oc-color-background-muted);
  font-size: 0.875rem;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.config-header h4 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.badge {
  background: var(--oc-color-swatch-primary-default);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.action-button {
  background: transparent;
  border: 1px solid var(--oc-color-border);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.action-button:hover {
  background: var(--oc-color-background-hover);
}

.action-button.danger:hover {
  background: var(--oc-color-background-danger);
  border-color: var(--oc-color-background-danger);
}

.config-details p {
  margin: 4px 0;
  font-size: 0.8rem;
  line-height: 1.4;
}

.add-button {
  width: 100%;
  padding: 10px;
  background: var(--oc-color-swatch-primary-default);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  margin-top: 12px;
}

.add-button:hover {
  background: var(--oc-color-swatch-primary-hover);
}

.new-config-form {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--oc-color-border);
  border-radius: 6px;
  background: var(--oc-color-background-muted);
}

.new-config-form h4 {
  margin-top: 0;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 600;
  font-size: 0.8rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--oc-color-border);
  border-radius: 4px;
  background: var(--oc-color-background-default);
  box-sizing: border-box;
  font-size: 0.875rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--oc-color-swatch-primary-default);
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.save-button {
  flex: 1;
  padding: 8px;
  background: var(--oc-color-swatch-primary-default);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
}

.save-button:hover {
  background: var(--oc-color-swatch-primary-hover);
}

.cancel-button {
  flex: 1;
  padding: 8px;
  background: transparent;
  border: 1px solid var(--oc-color-border);
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
}

.cancel-button:hover {
  background: var(--oc-color-background-hover);
}
</style>
