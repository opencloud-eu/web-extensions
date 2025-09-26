<template>
  <main>
    <iframe :title="$gettext(name)" :src="url" class="ext:size-full" />
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
