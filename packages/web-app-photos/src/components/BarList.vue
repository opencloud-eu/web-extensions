<template>
  <ul class="ext:m-0 ext:flex ext:list-none ext:flex-col ext:gap-3 ext:p-0">
    <li v-for="bucket in buckets" :key="bucket.key" class="ext:flex ext:flex-col ext:gap-1">
      <div class="ext:flex ext:items-baseline ext:justify-between ext:gap-3">
        <span class="ext:truncate ext:text-sm ext:text-role-on-surface">{{
          formatKey ? formatKey(bucket.key) : bucket.key
        }}</span>
        <span class="ext:font-mono ext:text-xs ext:tabular-nums ext:text-role-on-surface-variant">
          {{ formatCount(bucket.count, currentLanguage) }}
        </span>
      </div>
      <div
        class="ext:h-1.5 ext:overflow-hidden ext:rounded-full ext:bg-role-surface-container-high"
      >
        <div
          class="ext:h-full ext:rounded-full"
          :class="isOther(bucket) ? 'ext:bg-role-outline' : 'ext:bg-role-primary'"
          :style="{ width: `${(bucket.count / max) * 100}%` }"
        />
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { SearchAggregation, SearchBucket } from '../types'
import { formatCount } from '../helpers'

const { aggregation, formatKey = undefined } = defineProps<{
  aggregation: SearchAggregation
  formatKey?: (key: string) => string
}>()

const { current: currentLanguage } = useGettext()

const buckets = computed(() => aggregation.buckets ?? [])
const max = computed(() => Math.max(...buckets.value.map((b) => b.count), 1))

function isOther(bucket: SearchBucket): boolean {
  return bucket.key === 'Other'
}
</script>
