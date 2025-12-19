<template>
  <div>
    <h2>{{ $gettext('Your notes') }}</h2>
    <p>{{ $gettext('Please create or select a note on the left to start editing.') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'

const { $gettext } = useGettext()
</script>
