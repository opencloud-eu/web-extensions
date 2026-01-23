<template>
  <main class="ext:flex ext:size-full ext:rounded-l-xl ext:p-4">
    <div class="ext:size-full">
      <h2>All your notebooks are belong to us</h2>
      <p>
        This page is supposed to fire a search query for all .ocnb folders. Those are "OpenCloud
        Notebook" root folders, each of which represents a dedicated notebook. Clicking a notebook
        opens it in render mode (`view-` route).
      </p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { AppConfigObject } from '@opencloud-eu/web-pkg'

defineProps<{ applicationConfig: AppConfigObject }>()

console.log("henlo fren. you've reached the notebooks overview page.")
</script>
