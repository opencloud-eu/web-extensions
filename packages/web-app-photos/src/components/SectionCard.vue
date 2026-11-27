<template>
  <oc-card
    :title="title"
    class="ext:border ext:border-role-outline-variant"
    body-class="ext:flex-1 ext:min-h-0"
  >
    <slot />
  </oc-card>
</template>

<script setup lang="ts">
const { title } = defineProps<{ title: string }>()
</script>
