<template>
  <teleport :to="popup.target.elementBeforePopup.closest('.page')">
    <oc-card
      ref="root"
      class="pdf-studio-comment-popup ext:pointer-events-auto ext:absolute ext:z-[100001] ext:mt-1 ext:w-72 ext:rounded-xl! ext:border ext:border-role-outline-variant ext:font-sans ext:text-sm ext:shadow-md"
      :style="position"
      header-class="ext:flex-row! ext:items-center! ext:justify-between ext:gap-2 ext:min-h-7 ext:p-3! ext:pb-0!"
      body-class="ext:p-3!"
      role="dialog"
      :aria-label="$gettext('Comment')"
      tabindex="-1"
      @keydown.esc.stop.prevent="emit('close')"
    >
      <template #header>
        <pdf-comment-meta :comment="popup.data" />
        <div v-if="popup.isSelected && popup.isEditable" class="ext:flex ext:gap-0.5">
          <oc-button
            v-oc-tooltip="$gettext('Edit comment')"
            class="pdf-studio-comment-edit ext:p-1"
            :aria-label="$gettext('Edit comment')"
            appearance="raw"
            @click="emit('edit')"
          >
            <oc-icon name="pencil" fill-type="line" size-class="ext:size-4" />
          </oc-button>
          <oc-button
            v-oc-tooltip="$gettext('Delete comment')"
            class="pdf-studio-comment-delete ext:p-1"
            :aria-label="$gettext('Delete comment')"
            appearance="raw"
            @click="emit('delete')"
          >
            <oc-icon name="delete-bin" fill-type="line" size-class="ext:size-4" />
          </oc-button>
        </div>
      </template>
      <div
        ref="text"
        class="pdf-studio-comment-text ext:max-h-60 ext:overflow-y-auto ext:break-words ext:[&_*]:[color:inherit]! ext:[&_*]:[font-size:inherit]! ext:[&_*]:[line-height:inherit]! ext:[&_p]:my-0! ext:[&_.richText>*]:whitespace-pre-wrap"
      />
    </oc-card>
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, unref, useTemplateRef, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { getCommentPopupPosition, renderCommentText } from '../helpers/comments'
import type { CommentPopup } from '../composables/usePdfComments'
import PdfCommentMeta from './PdfCommentMeta.vue'

const { popup } = defineProps<{ popup: CommentPopup }>()

const emit = defineEmits<{ edit: []; delete: []; close: []; dismiss: [] }>()

const root = useTemplateRef<{ $el: HTMLElement }>('root')
const text = useTemplateRef<HTMLDivElement>('text')

// The width of the popup (ext:w-72).
const POPUP_WIDTH = 288

const position = computed(() =>
  getCommentPopupPosition(
    popup.target,
    POPUP_WIDTH,
    document.getElementById('pdf-studio-comments')?.getBoundingClientRect(),
    popup.target.elementBeforePopup.closest('.pdf-studio-viewer-container')?.getBoundingClientRect()
  )
)

// Rich text like in the PDF.js viewer, in the size and color of the popup, not of the page.
watch(
  () => popup.data,
  async () => {
    await nextTick()
    renderCommentText(popup.data, unref(text))
  },
  { immediate: true }
)

// Opened by clicking, not on updates like a changed color.
watch(
  () => [popup.target, popup.isSelected],
  async () => {
    await nextTick()
    if (popup.isSelected) {
      unref(root)?.$el.focus()
    }
  },
  { immediate: true }
)

// Clicking elsewhere closes an opened comment. Its button toggles it by itself, and dialogs
// (e.g. editing it) belong to it.
onClickOutside(
  () => unref(root)?.$el,
  () => {
    if (popup.isSelected) {
      emit('dismiss')
    }
  },
  { ignore: ['.annotationCommentButton', '.oc-modal'] }
)
</script>
