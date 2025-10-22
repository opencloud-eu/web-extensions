<template>
  <div class="oc-keepass oc-width-1-1 oc-height-1-1">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading KeePass database...</p>
    </div>

    <div v-if="showPasswordPrompt" class="password-prompt-overlay">
      <div class="password-prompt">
        <h2>Enter Database Password</h2>
        <form @submit.prevent="submitPassword">
          <div class="password-input-group">
            <input
              ref="passwordInput"
              v-model="enteredPassword"
              type="password"
              placeholder="Enter password..."
              :disabled="isValidatingPassword"
              autofocus
            />
            <div class="password-actions">
              <button type="submit" :disabled="!enteredPassword.trim() || isValidatingPassword">
                {{ isValidatingPassword ? 'Unlocking...' : 'Unlock' }}
              </button>
            </div>
          </div>
          <div v-if="passwordError" class="password-error">
            {{ passwordError }}
          </div>
        </form>
      </div>
    </div>

    <div v-else-if="database" class="database-container">
      <header class="db-header">
        <h1>{{ database.meta.name || 'KeePass Database' }}</h1>
        <div class="db-stats">
          <span>{{ totalEntries }} entries</span>
          <span>{{ totalGroups }} groups</span>
        </div>
      </header>

      <div class="db-content">
        <GroupComponent
          v-for="group in rootGroups"
          :key="group.uuid.toString()"
          :group="group"
          :level="0"
        />
      </div>
    </div>

    <div v-else-if="error" class="error-container">
      <h2>Failed to load database</h2>
      <p>{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import { AppConfigObject, useMessages, useThemeStore } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import * as kdbxweb from 'kdbxweb'
import GroupComponent from './components/GroupComponent.vue'

interface Props {
  applicationConfig: AppConfigObject
  currentContent: ArrayBuffer
  isReadOnly?: boolean
  resource: Resource
}

const props = defineProps<Props>()

const { $gettext } = useGettext()
const { showErrorMessage } = useMessages()
const themeStore = useThemeStore()

const database = ref<any>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const showPasswordPrompt = ref(false)
const enteredPassword = ref('')
const passwordError = ref('')
const isValidatingPassword = ref(false)
const passwordInput = ref<HTMLInputElement | null>(null)

const darkTheme = computed(() => {
  return themeStore.currentTheme.isDark
})

const rootGroups = computed(() => {
  if (!database.value) return []
  return database.value.groups || []
})

const totalEntries = computed(() => {
  if (!database.value) return 0
  let count = 0
  const countEntries = (group: any) => {
    count += group.entries.length
    group.groups.forEach(countEntries)
  }
  database.value.groups.forEach(countEntries)
  return count
})

const totalGroups = computed(() => {
  if (!database.value) return 0
  let count = 0
  const countGroups = (group: any) => {
    count += 1
    group.groups.forEach(countGroups)
  }
  database.value.groups.forEach(countGroups)
  return count - 1 // Don't count root
})

const getFileId = (): string => {
  // Create a unique ID based on the resource
  return `keepass_${props.resource.id || props.resource.name || 'unknown'}`
}

const getStoredPassword = (): string | null => {
  const fileId = getFileId()
  return sessionStorage.getItem(fileId)
}

const storePassword = (password: string): void => {
  const fileId = getFileId()
  sessionStorage.setItem(fileId, password)
}

const clearStoredPassword = (): void => {
  const fileId = getFileId()
  sessionStorage.removeItem(fileId)
}

const submitPassword = async (): Promise<void> => {
  if (!enteredPassword.value.trim()) return

  isValidatingPassword.value = true
  passwordError.value = ''

  try {
    await loadDatabase(enteredPassword.value)
    // If successful, store password and hide prompt
    storePassword(enteredPassword.value)
    showPasswordPrompt.value = false
    enteredPassword.value = ''
  } catch (err: any) {
    console.error('Password validation failed:', err)
    passwordError.value =
      err.code === 'InvalidKey'
        ? 'Invalid password. Please try again.'
        : 'Failed to unlock database. Please try again.'
  } finally {
    isValidatingPassword.value = false
  }
}

const loadDatabase = async (password: string): Promise<void> => {
  const credentials = new kdbxweb.Credentials(
    kdbxweb.ProtectedValue.fromString(password),
    undefined,
    undefined
  )

  const startTime = performance.now()
  console.log('Loading database with provided credentials', startTime)
  const db = await kdbxweb.Kdbx.load(props.currentContent, credentials)
  console.log(
    `Database loaded: ${performance.now() - startTime}ms`,
    performance.now() - startTime,
    db
  )

  database.value = db
  console.log('Database loaded successfully!')
}

watch(
  () => props.currentContent,
  async () => {
    console.log('Current content changed, reloading Keepass database', props.currentContent)

    // Reset state
    database.value = null
    error.value = null
    passwordError.value = ''

    // Check for stored password first
    const storedPassword = getStoredPassword()

    if (storedPassword) {
      console.log('Found stored password, attempting to load database')
      loading.value = true

      try {
        await loadDatabase(storedPassword)
      } catch (err: any) {
        console.error('Stored password failed, clearing and showing prompt:', err)
        clearStoredPassword()
        showPasswordPrompt.value = true
      } finally {
        loading.value = false
      }
    } else {
      console.log('No stored password found, showing password prompt')
      showPasswordPrompt.value = true
    }
  },
  {
    immediate: true
  }
)
</script>
<style lang="scss">
.oc-keepass {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;

  .loading-spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
}

.password-prompt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.password-prompt {
  background: var(--oc-color-background-default);
  border: 1px solid var(--oc-border-color);
  border-radius: 8px;
  padding: 2rem;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  h2 {
    margin: 0 0 1.5rem 0;
    color: var(--oc-color-text-default);
    text-align: center;
  }

  .password-input-group {
    margin-bottom: 1rem;

    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--oc-border-color);
      border-radius: 4px;
      font-size: 1rem;
      margin-bottom: 1rem;
      background: var(--oc-color-input-bg);
      color: var(--oc-color-text-default);

      &:focus {
        outline: none;
        border-color: var(--oc-color-swatch-primary-default);
        box-shadow: 0 0 0 2px rgba(var(--oc-color-swatch-primary-default-rgb), 0.2);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .password-actions {
      display: flex;
      justify-content: flex-end;

      button {
        background: var(--oc-color-swatch-primary-default);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        font-size: 1rem;
        cursor: pointer;
        transition: background-color 0.2s ease;

        &:hover:not(:disabled) {
          background: var(--oc-color-swatch-primary-hover);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        &:focus {
          outline: 2px solid var(--oc-color-swatch-primary-default);
          outline-offset: 2px;
        }
      }
    }
  }

  .password-error {
    color: var(--oc-color-swatch-danger-default);
    font-size: 0.875rem;
    text-align: center;
    margin-top: 0.5rem;
  }
}

.database-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.db-header {
  padding: 1rem;
  border-bottom: 1px solid var(--oc-border-color);
  background: var(--oc-color-background-highlight);
  flex-shrink: 0;

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: var(--oc-color-text-default);
  }

  .db-stats {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--oc-color-text-muted);

    span {
      padding: 0.25rem 0.5rem;
      background: var(--oc-color-background-default);
      border-radius: 4px;
    }
  }
}

.db-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.group-container {
  margin-bottom: 0.5rem;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--oc-color-background-hover);
  }

  &.expandable {
    cursor: pointer;
  }

  .expand-icon {
    margin-right: 0.5rem;
    transition: transform 0.2s ease;
    font-size: 0.75rem;
    color: var(--oc-color-text-muted);

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .no-expand-icon {
    width: 1rem;
    margin-right: 0.5rem;
  }

  .group-icon {
    margin-right: 0.5rem;
    font-size: 1rem;
  }

  .group-name {
    font-weight: 500;
    color: var(--oc-color-text-default);
    margin-right: 0.5rem;
  }

  .group-counts {
    font-size: 0.75rem;
    color: var(--oc-color-text-muted);

    span {
      margin-left: 0.25rem;
    }
  }
}

.group-content {
  border-left: 1px solid var(--oc-border-color);
  margin-left: 0.5rem;
  padding-left: 0.5rem;
}

.entries-table {
  margin-bottom: 1rem;
  border: 1px solid var(--oc-border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--oc-color-background-default);
}

.entries-table-header {
  display: grid;
  grid-template-columns: 40px 1fr 150px 180px 200px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--oc-color-background-highlight);
  border-bottom: 1px solid var(--oc-border-color);
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--oc-color-text-default);
}

.entry-row {
  display: grid;
  grid-template-columns: 40px 1fr 150px 180px 200px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--oc-border-color);
  transition: background-color 0.2s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: var(--oc-color-background-hover);
  }

  .col-icon {
    display: flex;
    align-items: center;
    justify-content: center;

    .entry-icon {
      font-size: 0.875rem;
    }
  }

  .col-title {
    display: flex;
    align-items: center;

    .entry-title {
      font-weight: 500;
      color: var(--oc-color-text-default);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .col-username {
    display: flex;
    align-items: center;

    .entry-username {
      color: var(--oc-color-text-muted);
      font-size: 0.875rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .col-password {
    display: flex;
    align-items: center;

    .password-cell {
      display: flex;
      align-items: center;
      width: 100%;

      .password-hidden {
        color: var(--oc-color-text-muted);
        font-size: 0.875rem;
        font-family: monospace;
        flex: 1;
      }

      .password-visible {
        color: var(--oc-color-text-default);
        font-size: 0.875rem;
        font-family: monospace;
        background: var(--oc-color-background-highlight);
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid var(--oc-border-color);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .password-toggle {
        margin-left: 0.5rem;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.875rem;
        padding: 4px 6px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
        flex-shrink: 0;

        &:hover {
          background-color: var(--oc-color-background-hover);
        }

        &:focus {
          outline: 2px solid var(--oc-color-swatch-primary-default);
          outline-offset: 1px;
        }
      }
    }
  }

  .col-url {
    display: flex;
    align-items: center;

    .entry-url {
      color: var(--oc-color-text-muted);
      font-size: 0.875rem;
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 2rem;

  h2 {
    color: var(--oc-color-swatch-danger-default);
    margin-bottom: 1rem;
  }

  p {
    color: var(--oc-color-text-muted);
  }
}
</style>
