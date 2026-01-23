<template>
  <div class="ext:w-full ext:flex ext:justify-between">
    <div>
      <span v-if="hasWriteAccess">{{ $gettext('Create your first note.') }}</span>
      <span v-else>{{ $gettext('There are no notes in this notebook, yet.') }}</span>
    </div>
    <div v-if="hasWriteAccess" class="ext:min-w-[77px] ext:h-[3rem] ext:-mt-5" :aria-hidden="true">
      <svg
        viewBox="0 0 77 50"
        width="100%"
        height="100%"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        preserveAspectRatio="none"
      >
        <!-- Horizontal stroke taking full width -->
        <!-- Goes right, then curves up slightly and points to the top -->
        <path d="M 0 38 H 52 Q 66 38 66 24 V 10" />
        <!-- Arrow head pointing upward at the end of the curve -->
        <path d="M 66 10 L 60 18" />
        <path d="M 66 10 L 70 18" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'
import { useNotebookStore } from '../composables'
import { storeToRefs } from 'pinia'

const { $gettext } = useGettext()
const notebookStore = useNotebookStore()
const { hasWriteAccess } = storeToRefs(notebookStore)
</script>
