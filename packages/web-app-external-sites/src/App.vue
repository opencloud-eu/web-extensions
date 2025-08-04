<template>
  <main class="external-site-container">
    <iframe :title="$gettext(name)" :src="url" class="oc-width-1-1 oc-height-1-1" />
  </main>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { useGettext } from 'vue3-gettext'

export default defineComponent({
  name: 'ExternalSite',
  props: {
    name: { type: String, required: true },
    url: { type: String, required: true }
  },
  setup() {
    const { $gettext } = useGettext()

    return {
      $gettext
    }
  }
})
</script>
