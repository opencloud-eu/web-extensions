<template>
  <span class="ext:flex ext:items-center ext:gap-2">
    <span
      class="ext:size-2.5 ext:shrink-0 ext:rounded-full ext:border ext:border-role-outline-variant"
      :style="{ backgroundColor: getCommentColor(comment) ?? 'transparent' }"
    />
    <time
      class="ext:text-xs ext:text-role-on-surface-variant"
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
