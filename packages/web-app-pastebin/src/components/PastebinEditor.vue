<template>
  <div
    class="ext:rounded-md ext:border ext:border-[var(--oc-role-outline-variant)] ext:overflow-hidden ext:bg-[var(--oc-role-surface)]"
  >
    <div
      class="ext:flex ext:items-center ext:justify-between ext:px-3 ext:py-2 ext:bg-[var(--oc-role-surface-container)] ext:border-b ext:border-[var(--oc-role-outline-variant)]"
    >
      <input
        :value="filename"
        type="text"
        :aria-label="$gettext('Filename')"
        class="ext:w-[260px] ext:border ext:border-[var(--oc-role-outline-variant)] ext:rounded ext:px-2 ext:py-0.5 ext:font-mono ext:text-xs ext:bg-[var(--oc-role-surface)] ext:text-[var(--oc-role-on-surface)] ext:outline-none focus:ext:border-[var(--oc-role-primary)]"
        :placeholder="$gettext('Filename including extension…')"
        @input="$emit('update:filename', ($event.target as HTMLInputElement).value)"
      />
      <oc-button
        v-if="removable"
        appearance="raw"
        size="small"
        class="ext:flex-shrink-0"
        @click="$emit('remove')"
      >
        <oc-icon name="close" size="small" />
      </oc-button>
    </div>
    <div class="editor-body ext:flex">
      <div
        ref="lineNumbersRef"
        class="line-numbers ext:bg-[var(--oc-role-surface-container)] ext:border-r ext:border-[var(--oc-role-outline-variant)]"
        aria-hidden="true"
      >
        <span
          v-for="n in lineCount"
          :key="n"
          class="ext:text-[var(--oc-role-on-surface-variant)]"
          >{{ n }}</span
        >
      </div>
      <textarea
        ref="textareaRef"
        :value="content"
        :aria-label="$gettext('File content')"
        class="code-textarea ext:flex-1 ext:text-[var(--oc-role-on-surface)] ext:bg-[var(--oc-role-surface)]"
        spellcheck="false"
        @input="$emit('update:content', ($event.target as HTMLTextAreaElement).value)"
        @scroll="syncScroll"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGettext } from 'vue3-gettext'

const { $gettext } = useGettext()

const props = defineProps<{
  filename: string
  content: string
  removable?: boolean
}>()

defineEmits<{
  'update:filename': [value: string]
  'update:content': [value: string]
  remove: []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const lineNumbersRef = ref<HTMLElement | null>(null)

const lineCount = computed(() => {
  if (!props.content) return 1
  const count = props.content.split('\n').length
  if (props.content.endsWith('\n')) return count - 1
  return count
})

const syncScroll = (e: Event) => {
  const textarea = e.target as HTMLTextAreaElement
  if (lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = textarea.scrollTop
  }
}
</script>

<style scoped>
.editor-body {
  min-height: 200px;
  max-height: 500px;
}

.line-numbers {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  user-select: none;
  overflow: hidden;
  min-width: 36px;
}

.line-numbers span {
  display: block;
  padding: 0 8px;
  text-align: right;
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 0.75rem;
  line-height: 1.25rem;
  font-variant-numeric: tabular-nums;
}

.code-textarea {
  border: none;
  outline: none;
  resize: none;
  padding: 8px 12px;
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 0.75rem;
  line-height: 1.25rem;
  white-space: pre;
  overflow: auto;
  tab-size: 2;
  scrollbar-width: thin;
}
</style>
