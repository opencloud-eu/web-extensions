<template>
  <span class="ext:flex ext:min-w-0 ext:flex-wrap ext:items-center ext:gap-x-2 ext:gap-y-0.5">
    <span
      class="ext:size-2.5 ext:shrink-0 ext:rounded-full ext:border ext:border-role-outline-variant"
      :style="{ backgroundColor: getCommentColor(comment) ?? 'transparent' }"
    />
    <span
      v-if="comment.titleObj?.str"
      class="pdf-studio-comment-author ext:truncate ext:text-xs ext:font-semibold"
      :dir="comment.titleObj.dir || 'auto'"
      :title="comment.titleObj.str"
      v-text="comment.titleObj.str"
    />
    <time
      class="ext:shrink-0 ext:text-xs ext:text-role-on-surface-variant"
      :datetime="date?.toISOString()"
      v-text="date ? formatDateFromJSDate(date, language.current) : ''"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { formatDateFromJSDate } from '@opencloud-eu/web-pkg'
import { getCommentColor, getCommentDate, type CommentData } from '../helpers/comments'

const { comment } = defineProps<{ comment: CommentData }>()

const language = useGettext()
// Date and time like elsewhere in OpenCloud, e.g. "Oct 8, 2026, 7:46 PM".
const date = computed(() => getCommentDate(comment))
</script>
