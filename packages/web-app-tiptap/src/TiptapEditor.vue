<script setup lang="ts">
import { onBeforeUnmount, type PropType } from 'vue'
import type * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor'
import { Markdown } from 'tiptap-markdown'

const props = defineProps({
  ydoc: { type: Object as PropType<Y.Doc>, required: true },
  awareness: { type: Object as PropType<Awareness>, required: true },
  isReadOnly: { type: Boolean, default: false }
})

const editor = useEditor({
  editable: !props.isReadOnly,
  // enableContentCheck flags schema mismatches that would otherwise silently
  // strip unknown ProseMirror nodes — the failure mode when two clients run
  // different Tiptap versions in the same Y.Doc room. The wrapper already
  // handles app-version pinning, but Tiptap internals can also diverge, so
  // we keep this belt-and-braces on. onContentError tears down collab; the
  // wrapper's onAuthenticationFailed pathway surfaces the reload prompt.
  enableContentCheck: true,
  onContentError({ disableCollaboration }) {
    disableCollaboration()
  },
  extensions: [
    StarterKit.configure({ history: false }),
    Markdown.configure({
      html: true,
      tightLists: true,
      linkify: true,
      breaks: false,
      transformPastedText: true
    }),
    Collaboration.configure({ document: props.ydoc, field: 'default' }),
    CollaborationCursor.configure({
      provider: { awareness: props.awareness },
      user: {}
    })
  ]
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="tiptap-shell oc-width-1-1 oc-height-1-1">
    <div class="tiptap-page">
      <EditorContent :editor="editor" class="tiptap-content" />
    </div>
  </div>
</template>

<style scoped>
.tiptap-shell {
  display: flex;
  justify-content: center;
  overflow: auto;
  background: var(--oc-role-surface-container-lowest, #f6f7f8);
  padding: 2rem 1rem;
}

.tiptap-page {
  width: 100%;
  max-width: 820px;
  min-height: calc(100% - 4rem);
  background: var(--oc-role-surface, #ffffff);
  border: 1px solid var(--oc-role-outline-variant, #e2e4e9);
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 2.5rem 3rem;
}

.tiptap-content :deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--oc-role-on-surface, #1d1f23);
}

.tiptap-content :deep(.ProseMirror h1) {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem;
  line-height: 1.25;
}
.tiptap-content :deep(.ProseMirror h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem;
  line-height: 1.3;
}
.tiptap-content :deep(.ProseMirror h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
}
.tiptap-content :deep(.ProseMirror p) {
  margin: 0 0 0.75rem;
}
.tiptap-content :deep(.ProseMirror p:last-child) {
  margin-bottom: 0;
}
.tiptap-content :deep(.ProseMirror ul),
.tiptap-content :deep(.ProseMirror ol) {
  padding-left: 1.5rem;
  margin: 0 0 0.75rem;
}
.tiptap-content :deep(.ProseMirror li > p) {
  margin: 0;
}
.tiptap-content :deep(.ProseMirror blockquote) {
  border-left: 3px solid var(--oc-role-outline-variant, #d4d7dd);
  padding-left: 1rem;
  margin: 0 0 0.75rem;
  color: var(--oc-role-on-surface-variant, #5b616b);
}
.tiptap-content :deep(.ProseMirror code) {
  background: var(--oc-role-surface-container-low, #f1f2f4);
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 0.9em;
}
.tiptap-content :deep(.ProseMirror pre) {
  background: var(--oc-role-surface-container, #ebedef);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  overflow: auto;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 0.875rem;
}
.tiptap-content :deep(.ProseMirror pre code) {
  background: transparent;
  padding: 0;
}
.tiptap-content :deep(.ProseMirror hr) {
  border: none;
  border-top: 1px solid var(--oc-role-outline-variant, #e2e4e9);
  margin: 1.5rem 0;
}
.tiptap-content :deep(.ProseMirror a) {
  color: var(--oc-role-primary, #2c5ae8);
  text-decoration: underline;
}

/* Awareness cursor styling (other users' carets + labels) */
.tiptap-content :deep(.collaboration-cursor__caret) {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 1px solid;
  border-right: 1px solid;
  word-break: normal;
  pointer-events: none;
}
.tiptap-content :deep(.collaboration-cursor__label) {
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  user-select: none;
  color: white;
  padding: 0.1rem 0.3rem;
  border-radius: 3px 3px 3px 0;
  white-space: nowrap;
}
</style>
