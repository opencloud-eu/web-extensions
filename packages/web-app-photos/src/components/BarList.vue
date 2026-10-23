<template>
  <ul
    class="ext:m-0 ext:flex ext:list-none ext:flex-col ext:gap-3 ext:p-0"
    @mouseleave="hovered = null"
  >
    <li
      v-for="bucket in buckets"
      :key="bucket.key"
      class="ext:flex ext:flex-col ext:gap-1"
      @mouseenter="hovered = bucket.key"
    >
      <component
        :is="selectable && !isOther(bucket) ? 'button' : 'div'"
        :type="selectable && !isOther(bucket) ? 'button' : undefined"
        class="ext:m-0 ext:flex ext:w-full ext:flex-col ext:gap-1 ext:border-0 ext:bg-transparent ext:p-0 ext:text-left"
        :class="selectable && !isOther(bucket) ? 'ext:cursor-pointer' : ''"
        @click="selectable && !isOther(bucket) && emit('select', bucket.key)"
      >
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
            class="ext:h-full ext:rounded-full ext:transition-opacity"
            :class="[
              isOther(bucket) ? 'ext:bg-role-outline' : 'ext:bg-role-primary',
              hovered && hovered !== bucket.key ? 'ext:opacity-55' : 'ext:opacity-90'
            ]"
            :style="{ width: `${(bucket.count / max) * 100}%` }"
          />
        </div>
      </component>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { SearchAggregation, SearchBucket } from '../types'
import { formatCount } from '../helpers'

const {
  aggregation,
  formatKey = undefined,
  selectable = false
} = defineProps<{
  aggregation: SearchAggregation
  formatKey?: (key: string) => string
  selectable?: boolean
}>()

const emit = defineEmits<{ select: [key: string] }>()

const { current: currentLanguage } = useGettext()

const hovered = ref<string | null>(null)

const buckets = computed(() => aggregation.buckets ?? [])
const max = computed(() => Math.max(...buckets.value.map((b) => b.count), 1))

function isOther(bucket: SearchBucket): boolean {
  return bucket.key === 'Other'
}
</script>
