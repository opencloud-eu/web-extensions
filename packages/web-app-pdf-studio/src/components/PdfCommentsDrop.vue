<template>
  <oc-drop
    ref="drop"
    drop-id="pdf-studio-comments"
    toggle="#pdf-studio-comments-toggle"
    mode="manual"
    padding-size="remove"
    :title="title"
    class="pdf-studio-comments ext:w-80"
    @show-drop="isShown = true"
    @hide-drop="onHide"
  >
    <div v-if="!isMobile" class="ext:flex ext:items-center ext:gap-2 ext:px-4 ext:pt-3 ext:pb-2">
      <h2 class="ext:m-0 ext:text-base ext:font-semibold" v-text="$gettext('Comments')" />
      <oc-tag
        class="pdf-studio-comments-count ext:tabular-nums"
        size="xsmall"
        rounded
        appearance="filled"
      >
        {{ comments?.length ?? 0 }}
      </oc-tag>
    </div>
    <p
      v-if="!comments?.length"
      class="ext:m-0 ext:px-4 ext:pb-4 ext:text-sm ext:text-role-on-surface-variant"
      :class="{ 'ext:pt-3': isMobile }"
      v-text="$gettext('No comments yet. Select an annotation and add a comment in its toolbar.')"
    />
    <oc-list
      v-else
      ref="list"
      raw
      class="ext:flex ext:max-h-[60vh] ext:flex-col ext:gap-2 ext:overflow-y-auto ext:px-3 ext:pb-3"
      :class="{ 'ext:pt-3': isMobile }"
    >
      <li v-for="comment in comments" :key="comment.id">
        <oc-button
          class="pdf-studio-comment-item ext:w-full ext:flex-col! ext:items-start! ext:rounded-xl ext:p-3 ext:text-left"
          :class="{
            'ext:bg-role-surface-container ext:hover:bg-role-surface-container-high':
              comment.id !== selectedId
          }"
          :aria-current="comment.id === selectedId || undefined"
          :appearance="comment.id === selectedId ? 'filled' : 'raw-inverse'"
          :color-role="comment.id === selectedId ? 'secondaryContainer' : 'surface'"
          gap-size="small"
          no-hover
          @click="openComment(comment)"
        >
          <pdf-comment-meta :comment="comment" />
          <span
            class="ext:line-clamp-4 ext:whitespace-pre-line ext:text-sm"
            dir="auto"
            v-text="getCommentText(comment)"
          />
        </oc-button>
      </li>
    </oc-list>
  </oc-drop>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, unref, useTemplateRef, watch } from 'vue'
import { useIsMobile } from '@opencloud-eu/design-system/composables'
import { useGettext } from 'vue3-gettext'
import { useEventListener } from '@vueuse/core'
import { getCommentText, type CommentData } from '../helpers/comments'
import PdfCommentMeta from './PdfCommentMeta.vue'

const { comments = undefined, selectedId = undefined } = defineProps<{
  /** Provided by PDF.js while its comments tool is active. */
  comments?: CommentData[]
  selectedId?: string
}>()

const emit = defineEmits<{
  open: [comment: CommentData]
  close: []
}>()

// The drawer on phones has its own title, the count goes in there.
const { isMobile } = useIsMobile()
const { $gettext } = useGettext()
const title = computed(() =>
  unref(isMobile) && comments
    ? $gettext('Comments (%{count})', { count: String(comments.length) })
    : $gettext('Comments')
)

const isShown = ref(false)
const drop = useTemplateRef<{ show(options?: { noFocus?: boolean }): void; hide(): void }>('drop')
const list = useTemplateRef<{ $el: HTMLElement }>('list')

// Working with the comments on the page keeps the list, like the sidebar of the PDF.js viewer:
// their popups, their buttons (or the annotations that are their own, e.g. sticky notes) and
// the dialog to edit them.
const COMMENT_ELEMENTS =
  '.pdf-studio-comment-popup, .annotationCommentButton, .popupTriggerArea, .oc-modal'
let isClickOnComment = false
useEventListener(
  document,
  'click',
  (event: MouseEvent) => {
    isClickOnComment = !!(event.target as Element).closest?.(COMMENT_ELEMENTS)
  },
  { capture: true }
)

// On small screens the list is a bottom drawer covering the page, it makes room for the
// comment, the comments tool stays active.
let isMakingRoom = false
function openComment(comment: CommentData) {
  emit('open', comment)
  if (unref(isMobile)) {
    isMakingRoom = true
    unref(drop)?.hide()
  }
}

// Closed by the user, e.g. clicking elsewhere. Without comments, PDF.js closed it already.
function onHide() {
  isShown.value = false
  if (!comments || isMakingRoom) {
    isMakingRoom = false
    return
  }
  if (isClickOnComment) {
    isClickOnComment = false
    unref(drop)?.show({ noFocus: true })
    return
  }
  emit('close')
}

watch(
  () => !!comments,
  (hasComments) => (hasComments ? unref(drop)?.show() : unref(drop)?.hide())
)

// Comments selected on the page get scrolled into view, like in the PDF.js viewer.
watch(
  () => selectedId,
  async () => {
    await nextTick()
    unref(list)?.$el.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }
)

/** Shows the list again, e.g. after it made room for a comment on a small screen. */
function show() {
  unref(drop)?.show()
}

defineExpose({ isShown, show })
</script>
