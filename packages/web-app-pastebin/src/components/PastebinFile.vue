<template>
  <div
    :data-item-id="resource.name"
    class="pastebin-file ext:rounded-lg ext:border ext:border-[var(--oc-role-outline-variant)] ext:overflow-hidden ext:bg-[var(--oc-role-surface)] ext:mb-6"
  >
    <div
      class="ext:flex ext:items-center ext:px-4 ext:py-2.5 ext:bg-[var(--oc-role-surface-container)] ext:border-b ext:border-[var(--oc-role-outline-variant)] ext:cursor-pointer"
      @click="scrollToSelf"
    >
      <ResourceIcon :resource="resource" size="small" class="ext:mr-2" />
      <span
        class="ext:font-mono ext:text-sm ext:font-medium ext:text-[var(--oc-role-on-surface)]"
        >{{ resource.name }}</span
      >
      <!-- Using <a> intentionally: the href enables standard browser link interactions
           (open in new tab, copy link address) while @click.prevent adds clipboard copy -->
      <a
        v-if="anchorHref"
        :href="anchorHref"
        class="ext:inline-flex ext:items-center ext:ml-1.5 ext:opacity-30 hover:ext:opacity-100 ext:align-middle"
        :title="$gettext('Link to this file')"
        @click.prevent="copyAnchorLink"
      >
        <oc-icon :name="anchorCopied ? 'checkbox-circle' : 'link'" size="small" />
      </a>
      <div class="ext:ml-auto ext:flex ext:items-center ext:gap-2">
        <oc-button
          v-if="content"
          appearance="raw"
          size="small"
          :title="$gettext('Copy content')"
          @click="copyContent"
        >
          <oc-icon :name="copied ? 'checkbox-circle' : 'file-copy'" size="small" />
        </oc-button>
        <oc-button
          v-if="content"
          appearance="raw"
          size="small"
          :title="$gettext('Download raw file')"
          @click="downloadRaw"
        >
          <oc-icon name="download" size="small" />
        </oc-button>
      </div>
    </div>
    <div>
      <div v-if="loading" class="ext:flex ext:justify-center ext:py-8">
        <oc-spinner size="small" :aria-label="$gettext('Loading pastebin')" />
      </div>
      <div
        v-else-if="error"
        class="ext:p-6 ext:text-center ext:text-sm ext:text-[var(--oc-role-error)]"
      >
        {{ error }}
      </div>
      <div v-else-if="content" class="ext:overflow-x-auto">
        <table class="code-table ext:w-full ext:border-collapse">
          <tr v-for="(line, index) in lines" :key="index" class="line-row">
            <td class="line-number">{{ index + 1 }}</td>
            <td class="line-content" v-html="line" />
          </tr>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { ResourceIcon, useClientService } from '@opencloud-eu/web-pkg'
import { useClipboard } from '@vueuse/core'
import hljs from 'highlight.js/lib/core'
import { useGettext } from 'vue3-gettext'
import { scrollToFile } from '../utils'

// Register common languages
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import plaintext from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('plaintext', plaintext)

const props = defineProps<{
  resource: Resource
  space: SpaceResource
  shareUrl?: string
  folderFileId?: string
}>()

const emit = defineEmits<{ loaded: [] }>()

const { $gettext } = useGettext()
const clientService = useClientService()
const { copy, copied } = useClipboard({ legacy: true, copiedDuring: 1500 })

const anchorHref = computed(() => {
  // Use the share URL when available (authenticated view), fall back to the current URL
  // so anchor links also work on public link views
  const base = props.shareUrl || window.location.href
  const url = new URL(base)
  url.searchParams.set('scrollTo', props.resource.name)
  // fileId of the .ocpb folder is needed so AppWrapper's replaceInvalidFileRoute
  // doesn't strip scrollTo when rewriting the URL
  if (props.folderFileId) {
    url.searchParams.set('fileId', props.folderFileId)
  }
  return url.toString()
})

const { copy: copyAnchor, copied: anchorCopied } = useClipboard({
  legacy: true,
  copiedDuring: 1500
})

const scrollToSelf = () => scrollToFile(props.resource.name)
const copyAnchorLink = () => {
  if (anchorHref.value) copyAnchor(anchorHref.value)
}

const loading = ref(true)
const error = ref<string | null>(null)
const content = ref<string | null>(null)

const languageFromExtension = (name: string): string | undefined => {
  const ext = name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    json: 'json',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    css: 'css',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    md: 'markdown',
    go: 'go',
    rs: 'rust',
    sql: 'sql',
    txt: 'plaintext'
  }
  return ext ? map[ext] : undefined
}

const lines = computed(() => {
  if (!content.value) return []
  const lang = languageFromExtension(props.resource.name)
  try {
    const highlighted = lang
      ? hljs.highlight(content.value, { language: lang })
      : hljs.highlightAuto(content.value)
    return highlighted.value.split('\n')
  } catch {
    return content.value.split('\n').map((l) => escapeHtml(l))
  }
})

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const copyContent = () => {
  if (content.value) copy(content.value)
}

const downloadRaw = () => {
  if (!content.value) return
  const blob = new Blob([content.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = props.resource.name
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  try {
    loading.value = true
    const { webdav } = clientService
    const fileContent = await (
      await webdav.getFileContents(props.space, {
        fileId: props.resource.fileId,
        path: props.resource.path
      })
    ).body
    content.value = fileContent
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : $gettext('Failed to load content')
  } finally {
    loading.value = false
    emit('loaded')
  }
})
</script>

<style scoped>
.code-table {
  font-size: 0.85rem;
  line-height: 1.6;
}

.line-row:hover td {
  background: var(--oc-role-surface-container-high);
}

.line-number {
  user-select: none;
  text-align: right;
  padding: 0 12px;
  color: var(--oc-role-on-surface-variant);
  background: var(--oc-role-surface-container);
  border-right: 1px solid var(--oc-role-outline-variant);
  width: 1%;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  font-size: 0.75rem;
  vertical-align: top;
  padding-top: 2px;
}

.pastebin-file {
  scroll-margin-top: 80px;
}

.line-content {
  padding: 0 16px;
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  white-space: pre;
}
</style>
