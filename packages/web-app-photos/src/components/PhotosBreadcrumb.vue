<template>
  <oc-breadcrumb :items="allItems" :max-width="-1" class="ext:-ml-2" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface PhotosBreadcrumbItem {
  text: string
  to?: { name: string; query?: Record<string, unknown> }
}

const { items } = defineProps<{ items: PhotosBreadcrumbItem[] }>()

const allItems = computed(() => items.map((item) => ({ ...item, isStaticNav: true })))
</script>
