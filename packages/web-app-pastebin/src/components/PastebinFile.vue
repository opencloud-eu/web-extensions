<template>
  <div class="file-item">
    <div class="file-header">
      <div class="file-icon">📄</div>
      <div class="file-details">
        <div class="file-name">{{ resource.name }}</div>
        <div class="file-meta">
          <span class="file-size">{{ formatFileSize(resource.size as any) }}</span>
          <span class="file-modified">{{ formatDate(resource.mdate) }}</span>
        </div>
      </div>
    </div>
    <div class="file-content">
      <div v-if="loading" class="content-loading">Loading content...</div>
      <div v-else-if="error" class="content-error">Failed to load content: {{ error }}</div>
      <pre
        v-else-if="content"
        class="content-display"
      ><code v-for="(line, index) in content.split('\n')" :key="index" class="line"><span class="line-number">{{ String(index + 1).padStart(3, ' ') }}</span><span class="line-content">{{ line }}</span></code></pre>
      <div v-else class="content-debug">
        Debug: Resource ID: {{ resource.id }}, FileID: {{ resource.fileId }}, Loading:
        {{ loading }}, Error: {{ error }}, Content length: {{ content?.length || 0 }} {{ content }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { useClientService } from '@opencloud-eu/web-pkg'
import { WebDAV } from '@opencloud-eu/web-client/webdav'

interface Props {
  resource: Resource
  space: SpaceResource
}

const props = defineProps<Props>()

const clientService = useClientService()

const loading = ref(true)
const error = ref<string | null>(null)
const content = ref<string | null>(null)

const loadFileContent = async () => {
  try {
    loading.value = true
    error.value = null

    console.log(
      'Loading content for file:',
      props.resource,
      'ID:',
      props.resource.id,
      'FileID:',
      props.resource.fileId
    )

    if (!props.space) {
      throw new Error('Space not provided')
    }

    const webdav = clientService.webdav as WebDAV
    const fileContent = await (
      await webdav.getFileContents(props.space, {
        fileId: props.resource.fileId,
        path: props.resource.path
      })
    ).body
    console.log('Got content:', typeof fileContent, fileContent)

    content.value = fileContent
  } catch (err: any) {
    console.error('Failed to load file content:', err)
    error.value = err.message || 'Failed to load content'
  } finally {
    loading.value = false
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (date: string): string => {
  return new Date(date).toLocaleString()
}

// Load content on mount
onMounted(loadFileContent)
</script>

<style lang="scss" scoped>
.file-item {
  border: 2px solid var(--oc-border-color);
  border-radius: 8px;
  background: var(--oc-color-background-default);
  margin-bottom: 1rem;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  .file-header {
    display: flex;
    align-items: center;
    padding: 1rem;
    background: var(--oc-color-background-highlight);
    border-bottom: 1px solid var(--oc-border-color);

    .file-icon {
      font-size: 1.5rem;
      margin-right: 1rem;
      flex-shrink: 0;
    }

    .file-details {
      flex: 1;
      min-width: 0;

      .file-name {
        font-weight: 500;
        color: var(--oc-color-text-default);
        margin-bottom: 0.25rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-meta {
        display: flex;
        gap: 1rem;
        font-size: 0.875rem;
        color: var(--oc-color-text-muted);

        .file-size {
          font-family: monospace;
        }
      }
    }
  }

  .file-content {
    .content-loading,
    .content-error,
    .content-debug {
      padding: 1rem;
      text-align: center;
      font-style: italic;
      color: var(--oc-color-text-muted);
      font-size: 0.875rem;
    }

    .content-error {
      color: var(--oc-color-swatch-danger-default);
    }

    .content-debug {
      background: var(--oc-color-background-highlight);
      border: 1px dashed var(--oc-border-color);
      font-family: monospace;
    }

    .content-display {
      margin: 0;
      padding: 0;
      background: var(--oc-color-background-default);
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre;

      .line {
        display: block;
        padding: 0;
        margin: 0;

        &:hover {
          background: var(--oc-color-background-hover);
        }

        .line-number {
          display: inline-block;
          width: 3rem;
          padding: 0 0.5rem;
          background: var(--oc-color-background-highlight);
          color: var(--oc-color-text-muted);
          text-align: right;
          border-right: 1px solid var(--oc-border-color);
          user-select: none;
          font-size: 0.75rem;
        }

        .line-content {
          padding-left: 0.5rem;
          color: var(--oc-color-text-default);
        }
      }
    }
  }
}
</style>
