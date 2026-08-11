<template>
  <ul class="ext:m-0 ext:flex ext:list-none ext:flex-wrap ext:gap-2 ext:p-0">
    <li v-for="bucket in buckets" :key="bucket.key">
      <span
        class="ext:inline-flex ext:items-baseline ext:gap-1.5 ext:rounded-full ext:border ext:border-role-outline-variant ext:bg-role-surface-container ext:px-3 ext:py-1 ext:text-sm ext:text-role-on-surface"
      >
        {{ bucket.key }}
        <span class="ext:font-mono ext:text-xs ext:tabular-nums ext:text-role-on-surface-variant">
          {{ formatCount(bucket.count, currentLanguage) }}
        </span>
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { SearchAggregation } from '../types'
import { formatCount } from '../helpers'

const { aggregation } = defineProps<{ aggregation: SearchAggregation }>()

const { current: currentLanguage } = useGettext()

const buckets = computed(() => aggregation.buckets ?? [])
</script>
