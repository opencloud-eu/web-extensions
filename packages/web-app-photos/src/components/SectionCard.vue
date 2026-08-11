<template>
  <section
    class="ext:flex ext:flex-col ext:gap-4 ext:rounded-xl ext:border ext:border-role-outline-variant ext:bg-role-surface ext:p-5"
  >
    <header>
      <h3 class="ext:m-0 ext:text-sm ext:font-semibold ext:text-role-on-surface">
        {{ title }}
      </h3>
    </header>
    <div class="ext:flex-1 ext:min-h-0">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
const { title } = defineProps<{ title: string }>()
</script>
